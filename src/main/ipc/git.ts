import { IpcMain } from 'electron'
import { execSync } from 'child_process'
import { IPC_CHANNELS, GitLogEntry, GitStatus } from '../../shared/types'

function exec(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

function hasCommits(cwd: string): boolean {
  try {
    exec('git rev-parse HEAD', cwd)
    return true
  } catch {
    return false
  }
}

export function registerGitHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git init', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_event, { cwd }: { cwd: string }) => {
    try {
      let branch: string
      try {
        branch = exec('git rev-parse --abbrev-ref HEAD', cwd)
      } catch {
        // HEAD resolution failed — check if it's still a git repo (no commits yet)
        try {
          exec('git rev-parse --git-dir', cwd)
          branch = '(aucun commit)'
        } catch {
          return null
        }
      }

      let ahead = 0
      let behind = 0
      if (branch !== '(aucun commit)') {
        try {
          const counts = exec('git rev-list --left-right --count HEAD...@{upstream}', cwd)
          const [a, b] = counts.split('\t')
          ahead = parseInt(a || '0', 10)
          behind = parseInt(b || '0', 10)
        } catch {
          // No upstream configured
        }
      }

      const statusOutput = exec('git status --porcelain', cwd)
      const staged: string[] = []
      const modified: string[] = []
      const untracked: string[] = []

      for (const line of statusOutput.split('\n')) {
        if (!line) continue
        const x = line[0]
        const y = line[1]
        const file = line.slice(3)

        if (x === '?' && y === '?') {
          untracked.push(file)
        } else {
          if (x && x !== ' ' && x !== '?') staged.push(file)
          if (y && y !== ' ' && y !== '?') modified.push(file)
        }
      }

      const status: GitStatus = { branch, ahead, behind, staged, modified, untracked }
      return status
    } catch {
      return null
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_LOG,
    async (_event, { cwd, limit }: { cwd: string; limit?: number }) => {
      try {
        // Return empty if no commits yet
        if (!hasCommits(cwd)) return []

        const n = limit || 50
        const SEP = '\x1f' // Unit separator - won't appear in normal git output
        const output = exec(
          `git log -${n} --pretty=format:"%H${SEP}%h${SEP}%an${SEP}%ai${SEP}%s${SEP}%P${SEP}%D"`,
          cwd,
        )
        const entries: GitLogEntry[] = output.split('\n').filter(Boolean).map((line) => {
          const parts = line.split(SEP)
          return {
            hash: parts[0] || '',
            shortHash: parts[1] || '',
            author: parts[2] || '',
            date: parts[3] || '',
            message: parts[4] || '',
            parents: (parts[5] || '').split(' ').filter(Boolean),
            refs: (parts[6] || '').split(',').map((r) => r.trim()).filter(Boolean),
          }
        })
        return entries
      } catch {
        return []
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, async (_event, { cwd }: { cwd: string }) => {
    try {
      // Return empty if no commits yet (branches reference commits)
      if (!hasCommits(cwd)) return []

      const output = exec('git branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)"', cwd)
      const branches = output.split('\n').map((line) => {
        const [name, hash, upstream] = line.split('|')
        return { name: name || '', hash: hash || '', upstream: upstream || '' }
      })
      return branches
    } catch {
      return []
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_CHECKOUT,
    async (_event, { cwd, branch }: { cwd: string; branch: string }) => {
      try {
        exec(`git checkout "${branch}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git push', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git pull', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT,
    async (
      _event,
      { cwd, message, files }: { cwd: string; message: string; files: string[] },
    ) => {
      try {
        for (const file of files) {
          exec(`git add "${file}"`, cwd)
        }
        exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF,
    async (_event, { cwd, file, staged }: { cwd: string; file?: string; staged?: boolean }) => {
      try {
        // For staged diff on repos with no commits, use --cached against empty tree
        if (staged && !hasCommits(cwd)) {
          let cmd = 'git diff --cached --diff-algorithm=minimal'
          if (file) cmd += ` -- "${file}"`
          return exec(cmd, cwd)
        }
        let cmd = 'git diff'
        if (staged) cmd += ' --cached'
        if (file) cmd += ` -- "${file}"`
        return exec(cmd, cwd)
      } catch {
        return ''
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.GIT_STASH, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git stash', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_POP, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git stash pop', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_CREATE_BRANCH,
    async (_event, { cwd, name }: { cwd: string; name: string }) => {
      try {
        if (!hasCommits(cwd)) {
          return { success: false, error: 'Impossible de creer une branche sans commit initial.' }
        }
        exec(`git checkout -b "${name}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_DELETE_BRANCH,
    async (_event, { cwd, name }: { cwd: string; name: string }) => {
      try {
        exec(`git branch -d "${name}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_MERGE,
    async (_event, { cwd, branch }: { cwd: string; branch: string }) => {
      try {
        exec(`git merge "${branch}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )
}
