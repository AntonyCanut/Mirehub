import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { WorkspaceContext } from '../lib/context.js'

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function execCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 10_000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

export function registerProjectTools(server: McpServer, ctx: WorkspaceContext): void {
  // project_list
  server.tool(
    'project_list',
    'List projects in the current workspace (symlinks in env directory)',
    {},
    async () => {
      const projects: { name: string; path: string; realPath: string }[] = []

      if (!fs.existsSync(ctx.envPath)) {
        return {
          content: [{ type: 'text' as const, text: `Workspace env not found: ${ctx.envPath}` }],
          isError: true,
        }
      }

      const entries = fs.readdirSync(ctx.envPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(ctx.envPath, entry.name)
        if (entry.isSymbolicLink()) {
          try {
            const realPath = fs.realpathSync(fullPath)
            projects.push({ name: entry.name, path: fullPath, realPath })
          } catch {
            projects.push({ name: entry.name, path: fullPath, realPath: '(broken symlink)' })
          }
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(projects, null, 2) }],
      }
    },
  )

  // project_scan_info
  server.tool(
    'project_scan_info',
    'Scan a project for info: git, Makefile, package.json, languages',
    {
      projectPath: z.string().describe('Absolute path to the project'),
    },
    async ({ projectPath }) => {
      const info: Record<string, unknown> = { projectPath }

      // Git
      const gitDir = path.join(projectPath, '.git')
      info.hasGit = fs.existsSync(gitDir)
      if (info.hasGit) {
        try {
          info.gitBranch = await execCommand('git', ['branch', '--show-current'], projectPath)
          info.gitRemotes = (await execCommand('git', ['remote', '-v'], projectPath)).split('\n').filter(Boolean)
        } catch {
          info.gitBranch = null
        }
      }

      // Makefile
      const makefilePath = path.join(projectPath, 'Makefile')
      info.hasMakefile = fs.existsSync(makefilePath)
      if (info.hasMakefile) {
        try {
          const makeContent = fs.readFileSync(makefilePath, 'utf-8')
          const targets = makeContent.match(/^([a-zA-Z_-]+):/gm)
          info.makeTargets = targets?.map((t) => t.replace(':', '')) || []
        } catch {
          info.makeTargets = []
        }
      }

      // package.json
      const pkgPath = path.join(projectPath, 'package.json')
      info.hasPackageJson = fs.existsSync(pkgPath)
      if (info.hasPackageJson) {
        const pkg = readJsonSafe<Record<string, unknown>>(pkgPath)
        if (pkg) {
          info.packageName = pkg.name
          info.packageVersion = pkg.version
          info.scripts = pkg.scripts ? Object.keys(pkg.scripts as Record<string, string>) : []
          info.dependencyCount = pkg.dependencies ? Object.keys(pkg.dependencies as Record<string, string>).length : 0
          info.devDependencyCount = pkg.devDependencies ? Object.keys(pkg.devDependencies as Record<string, string>).length : 0
        }
      }

      // Python
      info.hasPyproject = fs.existsSync(path.join(projectPath, 'pyproject.toml'))
      info.hasRequirements = fs.existsSync(path.join(projectPath, 'requirements.txt'))

      // Go
      info.hasGoMod = fs.existsSync(path.join(projectPath, 'go.mod'))

      // Rust
      info.hasCargoToml = fs.existsSync(path.join(projectPath, 'Cargo.toml'))

      // Docker
      info.hasDockerfile = fs.existsSync(path.join(projectPath, 'Dockerfile'))
      info.hasDockerCompose = fs.existsSync(path.join(projectPath, 'docker-compose.yml')) ||
        fs.existsSync(path.join(projectPath, 'docker-compose.yaml'))

      // Claude
      info.hasClaude = fs.existsSync(path.join(projectPath, '.claude'))
      info.hasClaudeMd = fs.existsSync(path.join(projectPath, 'CLAUDE.md'))

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      }
    },
  )

  // project_setup_claude_rules
  server.tool(
    'project_setup_claude_rules',
    'Setup/update CLAUDE.md and .claude/settings.json for a project',
    {
      projectPath: z.string().describe('Absolute path to the project'),
      claudeMdContent: z.string().optional().describe('Content for CLAUDE.md (creates or overwrites)'),
      settings: z.record(z.string(), z.unknown()).optional().describe('Settings to merge into .claude/settings.json'),
    },
    async ({ projectPath, claudeMdContent, settings }) => {
      const results: string[] = []

      // Write CLAUDE.md if provided
      if (claudeMdContent !== undefined) {
        const claudeMdPath = path.join(projectPath, 'CLAUDE.md')
        fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf-8')
        results.push(`Wrote CLAUDE.md (${claudeMdContent.length} chars)`)
      }

      // Merge settings into .claude/settings.json if provided
      if (settings !== undefined) {
        const claudeDir = path.join(projectPath, '.claude')
        if (!fs.existsSync(claudeDir)) {
          fs.mkdirSync(claudeDir, { recursive: true })
        }
        const settingsPath = path.join(claudeDir, 'settings.json')
        let existing: Record<string, unknown> = {}
        if (fs.existsSync(settingsPath)) {
          const parsed = readJsonSafe<Record<string, unknown>>(settingsPath)
          if (parsed) existing = parsed
        }
        const merged = { ...existing, ...settings }
        fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8')
        results.push(`Merged ${Object.keys(settings).length} key(s) into .claude/settings.json`)
      }

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No changes requested (both claudeMdContent and settings are empty).' }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: results.join('\n') }],
      }
    },
  )

  // workspace_info
  server.tool(
    'workspace_info',
    'Get current workspace info (ID, name, env path, kanban path)',
    {},
    async () => {
      const info = {
        workspaceId: ctx.workspaceId,
        workspaceName: ctx.workspaceName,
        envPath: ctx.envPath,
        kanbanDir: ctx.kanbanDir,
        analysisDir: ctx.analysisDir,
        envExists: fs.existsSync(ctx.envPath),
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      }
    },
  )
}
