import { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { IPC_CHANNELS } from '../../shared/types'

const ENVS_DIR = path.join(os.homedir(), '.theone', 'envs')

function ensureEnvsDir(): void {
  if (!fs.existsSync(ENVS_DIR)) {
    fs.mkdirSync(ENVS_DIR, { recursive: true })
  }
}

function getEnvDir(workspaceId: string): string {
  return path.join(ENVS_DIR, workspaceId)
}

export function registerWorkspaceEnvHandlers(ipcMain: IpcMain): void {
  // Setup workspace env: create symlinks to all project paths
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ENV_SETUP,
    async (
      _event,
      { workspaceId, projectPaths }: { workspaceId: string; projectPaths: string[] },
    ) => {
      try {
        ensureEnvsDir()
        const envDir = getEnvDir(workspaceId)

        // Clean existing env dir
        if (fs.existsSync(envDir)) {
          const existing = fs.readdirSync(envDir)
          for (const entry of existing) {
            const entryPath = path.join(envDir, entry)
            const stat = fs.lstatSync(entryPath)
            if (stat.isSymbolicLink()) {
              fs.unlinkSync(entryPath)
            }
          }
        } else {
          fs.mkdirSync(envDir, { recursive: true })
        }

        // Create symlinks for each project
        for (const projectPath of projectPaths) {
          const folderName = path.basename(projectPath)
          const linkPath = path.join(envDir, folderName)

          // Handle duplicate folder names by appending a suffix
          let finalLink = linkPath
          let suffix = 2
          while (fs.existsSync(finalLink)) {
            finalLink = `${linkPath}-${suffix++}`
          }

          fs.symlinkSync(projectPath, finalLink, 'dir')
        }

        return { success: true, envPath: envDir }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  // Get the env path for a workspace
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ENV_PATH,
    async (_event, { workspaceId }: { workspaceId: string }) => {
      const envDir = getEnvDir(workspaceId)
      if (fs.existsSync(envDir)) {
        return envDir
      }
      return null
    },
  )
}
