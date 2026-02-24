import { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'downloaded'
let updatePhase: UpdatePhase = 'idle'

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
    updatePhase = 'checking'
    sendStatusToRenderer('checking')
  })

  autoUpdater.on('update-available', (info) => {
    sendStatusToRenderer('available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    updatePhase = 'idle'
    sendStatusToRenderer('not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    updatePhase = 'downloading'
    sendStatusToRenderer('downloading', {
      percent: Math.round(progress.percent),
    })
  })

  autoUpdater.on('update-downloaded', () => {
    updatePhase = 'downloaded'
    sendStatusToRenderer('downloaded')
  })

  autoUpdater.on('error', (err) => {
    if (updatePhase === 'downloaded') {
      // eslint-disable-next-line no-console
      console.warn('[appUpdate] Ignoring late error after download completed:', err.message)
      return
    }
    updatePhase = 'idle'
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
    // Defer quitAndInstall so the IPC response is sent before the app quits.
    // Without this, the synchronous quit blocks the IPC channel and nothing happens.
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
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
