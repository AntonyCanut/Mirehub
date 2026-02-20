import { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { IPC_CHANNELS, FileEntry } from '../../shared/types'

export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, async (_event, { path: dirPath }: { path: string }) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const result: FileEntry[] = []

      for (const entry of entries) {
        try {
          result.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            isDirectory: entry.isDirectory(),
            isSymlink: entry.isSymbolicLink(),
          })
        } catch {
          // Skip entries that can't be stat'd (broken symlinks, etc.)
        }
      }

      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return result
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, { path: filePath }: { path: string }) => {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size > 5 * 1024 * 1024) {
        return { content: null, error: 'Fichier trop volumineux (>5 Mo)' }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { content, error: null }
    } catch (err) {
      return { content: null, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, { path: filePath, content }: { path: string; content: string }) => {
      try {
        fs.writeFileSync(filePath, content, 'utf-8')
        return { success: true, error: null }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_RENAME,
    async (_event, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
      fs.renameSync(oldPath, newPath)
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_DELETE,
    async (_event, { path: targetPath }: { path: string }) => {
      fs.rmSync(targetPath, { recursive: true, force: true })
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_COPY,
    async (_event, { src, dest }: { src: string; dest: string }) => {
      fs.cpSync(src, dest, { recursive: true })
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_MKDIR,
    async (_event, { path: targetPath }: { path: string }) => {
      fs.mkdirSync(targetPath, { recursive: true })
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_EXISTS,
    async (_event, { path: targetPath }: { path: string }) => {
      return fs.existsSync(targetPath)
    },
  )
}
