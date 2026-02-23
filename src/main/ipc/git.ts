import { IpcMain } from 'electron'
import { execSync } from 'child_process'
import { IPC_CHANNELS, GitLogEntry, GitStatus, GitTag, GitBlameLine, GitRemote } from '../../shared/types'

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

  ipcMain.handle(IPC_CHANNELS.GIT_FETCH, async (_event, { cwd }: { cwd: string }) => {
    try {
      exec('git fetch --all --prune', cwd)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_STAGE,
    async (_event, { cwd, files }: { cwd: string; files: string[] }) => {
      try {
        for (const file of files) {
          exec(`git add "${file}"`, cwd)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_UNSTAGE,
    async (_event, { cwd, files }: { cwd: string; files: string[] }) => {
      try {
        if (!hasCommits(cwd)) {
          for (const file of files) {
            exec(`git rm --cached "${file}"`, cwd)
          }
        } else {
          for (const file of files) {
            exec(`git reset HEAD -- "${file}"`, cwd)
          }
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_DISCARD,
    async (_event, { cwd, files }: { cwd: string; files: string[] }) => {
      try {
        for (const file of files) {
          exec(`git checkout -- "${file}"`, cwd)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_SHOW,
    async (_event, { cwd, hash }: { cwd: string; hash: string }) => {
      try {
        if (!hasCommits(cwd)) return { files: [], diff: '' }
        // Get list of changed files with status
        const filesOutput = exec(`git diff-tree --no-commit-id --name-status -r "${hash}"`, cwd)
        const files = filesOutput
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [status, ...nameParts] = line.split('\t')
            return { status: status || '?', file: nameParts.join('\t') || '' }
          })
        // Get full diff
        const diff = exec(`git show --format="" --patch "${hash}"`, cwd)
        return { files, diff }
      } catch {
        return { files: [], diff: '' }
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.GIT_STASH_LIST, async (_event, { cwd }: { cwd: string }) => {
    try {
      const output = exec('git stash list --format="%gd|%gs|%ci"', cwd)
      if (!output) return []
      return output.split('\n').filter(Boolean).map((line) => {
        const [ref, message, date] = line.split('|')
        return { ref: ref || '', message: message || '', date: date || '' }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_RENAME_BRANCH,
    async (_event, { cwd, oldName, newName }: { cwd: string; oldName: string; newName: string }) => {
      try {
        exec(`git branch -m "${oldName}" "${newName}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  // --- Tag management ---

  ipcMain.handle(IPC_CHANNELS.GIT_TAGS, async (_event, { cwd }: { cwd: string }) => {
    try {
      if (!hasCommits(cwd)) return []
      const SEP = '\x1f'
      const output = exec(
        `git tag -l --sort=-creatordate --format="%(refname:short)${SEP}%(objectname:short)${SEP}%(contents:subject)${SEP}%(creatordate:iso)${SEP}%(objecttype)"`,
        cwd,
      )
      if (!output) return []
      const tags: GitTag[] = output.split('\n').filter(Boolean).map((line) => {
        const parts = line.split(SEP)
        return {
          name: parts[0] || '',
          hash: parts[1] || '',
          message: parts[2] || '',
          date: parts[3] || '',
          isAnnotated: parts[4] === 'tag',
        }
      })
      return tags
    } catch {
      return []
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_CREATE_TAG,
    async (
      _event,
      { cwd, name, message }: { cwd: string; name: string; message?: string },
    ) => {
      try {
        if (message) {
          exec(`git tag -a "${name}" -m "${message.replace(/"/g, '\\"')}"`, cwd)
        } else {
          exec(`git tag "${name}"`, cwd)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_DELETE_TAG,
    async (_event, { cwd, name }: { cwd: string; name: string }) => {
      try {
        exec(`git tag -d "${name}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  // --- Cherry-pick ---

  ipcMain.handle(
    IPC_CHANNELS.GIT_CHERRY_PICK,
    async (_event, { cwd, hash }: { cwd: string; hash: string }) => {
      try {
        exec(`git cherry-pick "${hash}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  // --- Branch comparison ---

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF_BRANCHES,
    async (
      _event,
      { cwd, branch1, branch2 }: { cwd: string; branch1: string; branch2: string },
    ) => {
      try {
        const output = exec(`git diff "${branch1}"..."${branch2}" --stat`, cwd)
        return output
      } catch (err) {
        return String(err)
      }
    },
  )

  // --- Blame ---

  ipcMain.handle(
    IPC_CHANNELS.GIT_BLAME,
    async (_event, { cwd, file }: { cwd: string; file: string }) => {
      try {
        if (!hasCommits(cwd)) return []
        const output = exec(`git blame --porcelain "${file}"`, cwd)
        const lines: GitBlameLine[] = []
        const blocks = output.split('\n')
        let currentHash = ''
        let currentAuthor = ''
        let currentDate = ''
        let currentLineNumber = 0

        for (const line of blocks) {
          // Commit header line: <hash> <orig-line> <final-line> [<num-lines>]
          const headerMatch = line.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/)
          if (headerMatch) {
            currentHash = headerMatch[1]!
            currentLineNumber = parseInt(headerMatch[2]!, 10)
            continue
          }
          if (line.startsWith('author ')) {
            currentAuthor = line.slice(7)
            continue
          }
          if (line.startsWith('author-time ')) {
            const timestamp = parseInt(line.slice(12), 10)
            currentDate = new Date(timestamp * 1000).toISOString()
            continue
          }
          // Content line starts with a tab
          if (line.startsWith('\t')) {
            lines.push({
              hash: currentHash.slice(0, 8),
              author: currentAuthor,
              date: currentDate,
              lineNumber: currentLineNumber,
              content: line.slice(1),
            })
          }
        }
        return lines
      } catch {
        return []
      }
    },
  )

  // --- Remote management ---

  ipcMain.handle(IPC_CHANNELS.GIT_REMOTES, async (_event, { cwd }: { cwd: string }) => {
    try {
      const output = exec('git remote -v', cwd)
      if (!output) return []
      const remoteMap = new Map<string, GitRemote>()
      for (const line of output.split('\n')) {
        if (!line) continue
        const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
        if (!match) continue
        const [, name, url, type] = match
        if (!remoteMap.has(name!)) {
          remoteMap.set(name!, { name: name!, fetchUrl: '', pushUrl: '' })
        }
        const remote = remoteMap.get(name!)!
        if (type === 'fetch') remote.fetchUrl = url!
        else remote.pushUrl = url!
      }
      return Array.from(remoteMap.values())
    } catch {
      return []
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_ADD_REMOTE,
    async (_event, { cwd, name, url }: { cwd: string; name: string; url: string }) => {
      try {
        exec(`git remote add "${name}" "${url}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_REMOVE_REMOTE,
    async (_event, { cwd, name }: { cwd: string; name: string }) => {
      try {
        exec(`git remote remove "${name}"`, cwd)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )
}
