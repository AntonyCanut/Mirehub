import { IpcMain, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC_CHANNELS, UpdateInfo } from '../../shared/types'

const execFileAsync = promisify(execFile)

interface ToolCheck {
  name: string
  checkCommand: string
  checkArgs: string[]
  latestCommand?: string
  latestArgs?: string[]
}

const TOOLS_TO_CHECK: ToolCheck[] = [
  {
    name: 'node',
    checkCommand: 'node',
    checkArgs: ['--version'],
  },
  {
    name: 'npm',
    checkCommand: 'npm',
    checkArgs: ['--version'],
  },
  {
    name: 'claude',
    checkCommand: 'claude',
    checkArgs: ['--version'],
  },
  {
    name: 'git',
    checkCommand: 'git',
    checkArgs: ['--version'],
  },
]

async function getVersion(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 10000 })
    const version = stdout
      .trim()
      .replace(/^v/, '')
      .replace(/^git version /, '')
      .replace(/^Claude Code /, '')
    return version
  } catch {
    return null
  }
}

function extractVersion(v: string): string {
  const match = v.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1]! : v
}

function compareVersions(current: string, latest: string): boolean {
  const c = extractVersion(current)
  const l = extractVersion(latest)
  if (c === l) return false
  const cParts = c.split('.').map(Number)
  const lParts = l.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((lParts[i] ?? 0) > (cParts[i] ?? 0)) return true
    if ((lParts[i] ?? 0) < (cParts[i] ?? 0)) return false
  }
  return false
}

async function getLatestNpmVersion(pkg: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('npm', ['view', pkg, 'version'], { timeout: 15000 })
    return stdout.trim()
  } catch {
    return null
  }
}

async function getLatestBrewVersion(formula: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('brew', ['info', '--json=v2', formula], {
      timeout: 15000,
    })
    const data = JSON.parse(stdout)
    return data.formulae?.[0]?.versions?.stable || null
  } catch {
    return null
  }
}

async function checkToolUpdates(): Promise<UpdateInfo[]> {
  const results: UpdateInfo[] = []

  for (const tool of TOOLS_TO_CHECK) {
    const currentVersion = await getVersion(tool.checkCommand, tool.checkArgs)
    if (!currentVersion) continue

    let latestVersion: string | null = null

    // Try to get latest version based on tool
    if (tool.name === 'node') {
      latestVersion = await getLatestBrewVersion('node')
    } else if (tool.name === 'npm') {
      latestVersion = await getLatestNpmVersion('npm')
    } else if (tool.name === 'claude') {
      latestVersion = await getLatestNpmVersion('@anthropic-ai/claude-code')
    }

    results.push({
      tool: tool.name,
      currentVersion: extractVersion(currentVersion),
      latestVersion: latestVersion ? extractVersion(latestVersion) : extractVersion(currentVersion),
      updateAvailable: latestVersion !== null && compareVersions(currentVersion, latestVersion),
      scope: 'global',
    })
  }

  return results
}

export function registerUpdateHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    return checkToolUpdates()
  })

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_INSTALL,
    async (
      _event,
      { tool, scope }: { tool: string; scope: string; projectId?: string },
    ) => {
      const windows = BrowserWindow.getAllWindows()

      const sendStatus = (status: string, progress?: number) => {
        for (const win of windows) {
          win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, { tool, scope, status, progress })
        }
      }

      sendStatus('starting')

      try {
        let command: string
        let args: string[]

        switch (tool) {
          case 'node':
            command = 'brew'
            args = ['upgrade', 'node']
            break
          case 'npm':
            command = 'npm'
            args = ['install', '-g', 'npm@latest']
            break
          case 'claude':
            command = 'npm'
            args = ['install', '-g', '@anthropic-ai/claude-code@latest']
            break
          default:
            throw new Error(`Unknown tool: ${tool}`)
        }

        sendStatus('installing', 50)
        await execFileAsync(command, args, { timeout: 120000 })
        sendStatus('completed', 100)

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        sendStatus('failed')
        return { success: false, error: message }
      }
    },
  )
}
