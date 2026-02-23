import { IpcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { IPC_CHANNELS, FileEntry, SearchResult } from '../../shared/types'

export function registerFilesystemHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, async (_event, { path: dirPath }: { path: string }) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const result: FileEntry[] = []

      for (const entry of entries) {
        try {
          const fullPath = path.join(dirPath, entry.name)
          const fileEntry: FileEntry = {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isSymlink: entry.isSymbolicLink(),
          }
          try {
            const stat = fs.statSync(fullPath)
            fileEntry.size = stat.size
            fileEntry.modifiedAt = stat.mtimeMs
          } catch {
            // stat may fail for broken symlinks, keep entry without size/modifiedAt
          }
          result.push(fileEntry)
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

  ipcMain.handle(
    IPC_CHANNELS.FS_READ_BASE64,
    async (_event, { path: filePath }: { path: string }) => {
      try {
        const stat = fs.statSync(filePath)
        if (stat.size > 20 * 1024 * 1024) {
          return { data: null, error: 'Fichier trop volumineux (>20 Mo)' }
        }
        const buffer = fs.readFileSync(filePath)
        const base64 = buffer.toString('base64')
        const ext = path.extname(filePath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
        }
        const mime = mimeTypes[ext] || 'application/octet-stream'
        return { data: `data:${mime};base64,${base64}`, error: null }
      } catch (err) {
        return { data: null, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_OPEN_IN_FINDER,
    async (_event, { path: targetPath }: { path: string }) => {
      shell.showItemInFolder(targetPath)
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FS_SEARCH,
    async (
      _event,
      { cwd, query, fileTypes, caseSensitive }: { cwd: string; query: string; fileTypes?: string[]; caseSensitive?: boolean },
    ): Promise<SearchResult[]> => {
      if (!query || query.trim().length === 0) return []

      return new Promise((resolve) => {
        const args: string[] = [
          '-r',
          '-n',
          '--column',
          '--line-buffered',
        ]

        if (!caseSensitive) {
          args.push('-i')
        }

        // Exclude common directories
        const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage']
        for (const dir of excludeDirs) {
          args.push(`--exclude-dir=${dir}`)
        }

        // File type filter
        if (fileTypes && fileTypes.length > 0) {
          for (const ft of fileTypes) {
            args.push(`--include=*.${ft}`)
          }
        }

        args.push('--', query, '.')

        const proc = execFile('grep', args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 10000 }, (err, stdout) => {
          if (err || !stdout) {
            resolve([])
            return
          }

          const results: SearchResult[] = []
          const lines = stdout.split('\n')
          const limit = 200

          for (const line of lines) {
            if (results.length >= limit) break
            if (!line.trim()) continue

            // grep --column output format: ./file:line:column:text
            const match = line.match(/^\.\/(.+?):(\d+):(\d+):(.*)$/)
            if (match) {
              results.push({
                file: path.join(cwd, match[1]!),
                line: parseInt(match[2]!, 10),
                column: parseInt(match[3]!, 10),
                text: match[4]!,
              })
            }
          }

          resolve(results)
        })

        proc.on('error', () => resolve([]))
      })
    },
  )
}
