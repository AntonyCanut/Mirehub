import { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

function sendStatusToRenderer(
  status: string,
  data?: Record<string, unknown>,
): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send(IPC_CHANNELS.APP_UPDATE_STATUS, { status, ...data })
  }
}

export function registerAppUpdateHandlers(ipcMain: IpcMain): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Forward autoUpdater events to renderer
  autoUpdater.on('checking-for-update', () => {
    sendStatusToRenderer('checking')
  })

  autoUpdater.on('update-available', (info) => {
    sendStatusToRenderer('available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatusToRenderer('not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToRenderer('downloading', {
      percent: Math.round(progress.percent),
    })
  })

  autoUpdater.on('update-downloaded', () => {
    sendStatusToRenderer('downloaded')
  })

  autoUpdater.on('error', (err) => {
    sendStatusToRenderer('error', { message: String(err.message ?? err) })
  })

  // IPC handlers
  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_CHECK, async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo.version ?? null }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.APP_UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })

  // Auto-check on startup (5s delay)
  const settings = storage.getSettings()
  if (settings.checkUpdatesOnLaunch) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        // Silently fail — expected in dev mode or without network
      })
    }, 5000)
  }
}
