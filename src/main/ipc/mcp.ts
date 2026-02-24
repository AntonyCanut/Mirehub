import { IpcMain } from 'electron'
import { execFile } from 'child_process'
import { IPC_CHANNELS, McpServerConfig, McpHelpResult } from '../../shared/types'

export function registerMcpHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.MCP_GET_HELP,
    async (_event, { name, config }: { name: string; config: McpServerConfig }): Promise<McpHelpResult> => {
      return new Promise((resolve) => {
        const args = [...(config.args ?? []), '--help']

        execFile(config.command, args, { timeout: 10_000, env: { ...process.env, ...config.env } }, (err, stdout, stderr) => {
          if (err && !stdout && !stderr) {
            resolve({ success: false, output: '', error: err.message })
            return
          }
          // Many CLI tools write help to stderr
          const output = (stdout || '') + (stderr || '')
          resolve({ success: true, output: output || `No help output for "${name}"` })
        })
      })
    },
  )
}
