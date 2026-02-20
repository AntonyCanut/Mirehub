import { IpcMain, dialog } from 'electron'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { execSync, execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
import { IPC_CHANNELS, Project, NpmPackageInfo } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return storage.getProjects()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_DIR, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Sélectionner un dossier projet',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_ADD,
    async (_event, data: { workspaceId: string; path: string }) => {
      const hasClaude = fs.existsSync(path.join(data.path, '.claude'))
      const hasGit = fs.existsSync(path.join(data.path, '.git'))
      const project: Project = {
        id: uuid(),
        name: path.basename(data.path),
        path: data.path,
        hasClaude,
        hasGit,
        workspaceId: data.workspaceId,
        createdAt: Date.now(),
      }
      storage.addProject(project)
      return project
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE, async (_event, { id }: { id: string }) => {
    storage.deleteProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_SCAN_CLAUDE, async (_event, { path: projectPath }: { path: string }) => {
    const claudeDir = path.join(projectPath, '.claude')
    const hasClaude = fs.existsSync(claudeDir)
    let claudeMd: string | null = null
    let settings: Record<string, unknown> | null = null

    if (hasClaude) {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md')
      if (fs.existsSync(claudeMdPath)) {
        claudeMd = fs.readFileSync(claudeMdPath, 'utf-8')
      }
      const settingsPath = path.join(claudeDir, 'settings.json')
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      }
    }

    return { hasClaude, claudeMd, settings }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_SCAN_INFO, async (_event, { path: projectPath }: { path: string }) => {
    // Detect Makefile
    const makefilePath = path.join(projectPath, 'Makefile')
    const hasMakefile = fs.existsSync(makefilePath)
    let makeTargets: string[] = []

    if (hasMakefile) {
      try {
        const content = fs.readFileSync(makefilePath, 'utf-8')
        // Extract target names (lines matching "targetname:" at beginning)
        const targetRegex = /^([a-zA-Z_][\w-]*)\s*:/gm
        let match: RegExpExecArray | null
        while ((match = targetRegex.exec(content)) !== null) {
          makeTargets.push(match[1]!)
        }
      } catch {
        // Read failure is non-blocking
      }
    }

    // Detect Git
    const gitDir = path.join(projectPath, '.git')
    const hasGit = fs.existsSync(gitDir)
    let gitBranch: string | null = null

    if (hasGit) {
      try {
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 5000,
        }).trim()
      } catch {
        // HEAD resolution failed — repo exists but may have no commits
        try {
          execSync('git rev-parse --git-dir', {
            cwd: projectPath,
            encoding: 'utf-8',
            timeout: 5000,
          })
          gitBranch = '(aucun commit)'
        } catch {
          // Not a valid git repo after all
        }
      }
    }

    return { hasMakefile, makeTargets, hasGit, gitBranch }
  })

  // Check NPM packages for updates and deprecations
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CHECK_PACKAGES,
    async (_event, { path: projectPath }: { path: string }) => {
      const pkgPath = path.join(projectPath, 'package.json')
      if (!fs.existsSync(pkgPath)) {
        return { packages: [] }
      }

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        const allDeps: Record<string, string> = { ...pkg.dependencies }
        const allDevDeps: Record<string, string> = { ...pkg.devDependencies }

        // Use npm outdated --json (single call, much faster than per-package npm view)
        let outdatedData: Record<string, { current: string; wanted: string; latest: string; deprecated?: string }> = {}
        try {
          const { stdout } = await execFileAsync('npm', ['outdated', '--json'], { cwd: projectPath, timeout: 30000 })
          outdatedData = JSON.parse(stdout || '{}')
        } catch (err: unknown) {
          // npm outdated returns exit code 1 when there are outdated packages, that's normal
          const execErr = err as { stdout?: string }
          if (execErr.stdout) {
            outdatedData = JSON.parse(execErr.stdout || '{}')
          }
        }

        const packages: NpmPackageInfo[] = []
        const addPackages = (deps: Record<string, string>, type: 'dependency' | 'devDependency') => {
          for (const [name, version] of Object.entries(deps)) {
            const outdated = outdatedData[name]
            const info: NpmPackageInfo = {
              name,
              currentVersion: outdated?.current || version.replace(/^[\^~]/, ''),
              latestVersion: outdated?.latest || null,
              isDeprecated: !!outdated?.deprecated,
              updateAvailable: !!outdated?.latest && outdated.current !== outdated.latest,
              type,
            }
            if (outdated?.deprecated) {
              info.deprecationMessage = outdated.deprecated
            }
            packages.push(info)
          }
        }
        addPackages(allDeps, 'dependency')
        addPackages(allDevDeps, 'devDependency')

        return { packages }
      } catch {
        return { packages: [] }
      }
    },
  )

  // Update NPM packages
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE_PACKAGE,
    async (_event, { projectPath, packageName }: { projectPath: string; packageName?: string }) => {
      try {
        const args = packageName ? ['update', packageName] : ['update']
        const { stdout } = await execFileAsync('npm', args, { cwd: projectPath, timeout: 60000 })
        return { success: true, output: stdout }
      } catch (err: unknown) {
        const execErr = err as { stderr?: string; message?: string }
        return { success: false, error: execErr.stderr || execErr.message || 'npm update failed' }
      }
    },
  )

  // Check if a project already has a .claude folder
  ipcMain.handle(IPC_CHANNELS.PROJECT_CHECK_CLAUDE, async (_event, { path: projectPath }: { path: string }) => {
    const claudeDir = path.join(projectPath, '.claude')
    return fs.existsSync(claudeDir)
  })

  // Write Claude settings.json
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_WRITE_CLAUDE_SETTINGS,
    async (_event, { projectPath, settings }: { projectPath: string; settings: Record<string, unknown> }) => {
      const claudeDir = path.join(projectPath, '.claude')
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true })
      }
      fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
      return { success: true }
    },
  )

  // Write CLAUDE.md
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_WRITE_CLAUDE_MD,
    async (_event, { projectPath, content }: { projectPath: string; content: string }) => {
      fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), content, 'utf-8')
      return { success: true }
    },
  )

  // Deploy current app's .claude to a target project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DEPLOY_CLAUDE,
    async (_event, { targetPath, force }: { targetPath: string; force: boolean }) => {
      const appRoot = process.cwd()
      const sourceClaudeDir = path.join(appRoot, '.claude')
      const sourceCLAUDEMD = path.join(appRoot, 'CLAUDE.md')
      const targetClaudeDir = path.join(targetPath, '.claude')
      const targetCLAUDEMD = path.join(targetPath, 'CLAUDE.md')

      if (!fs.existsSync(sourceClaudeDir)) {
        return { success: false, error: 'No .claude folder found in theOne project' }
      }

      // If target already has .claude, backup it
      if (fs.existsSync(targetClaudeDir)) {
        if (!force) {
          return { success: false, error: 'exists', hasExisting: true }
        }
        const backupDir = path.join(targetPath, '.claude-backup')
        // Remove old backup if exists
        if (fs.existsSync(backupDir)) {
          fs.rmSync(backupDir, { recursive: true })
        }
        fs.renameSync(targetClaudeDir, backupDir)
        // Also backup CLAUDE.md if exists
        if (fs.existsSync(targetCLAUDEMD)) {
          fs.renameSync(targetCLAUDEMD, path.join(targetPath, 'CLAUDE-backup.md'))
        }
      }

      // Copy .claude folder
      fs.cpSync(sourceClaudeDir, targetClaudeDir, { recursive: true })

      // Copy CLAUDE.md if exists
      if (fs.existsSync(sourceCLAUDEMD)) {
        fs.copyFileSync(sourceCLAUDEMD, targetCLAUDEMD)
      }

      return { success: true }
    },
  )
}
