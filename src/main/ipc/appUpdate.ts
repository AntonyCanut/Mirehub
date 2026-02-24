import { IpcMain, BrowserWindow, app } from 'electron'
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
    // Use setTimeout instead of setImmediate so the IPC response is fully
    // transmitted to the renderer before the quit sequence starts.
    // setImmediate was unreliable in Electron's hybrid event loop on macOS.
    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[appUpdate] quitAndInstall failed:', err)
      }

      // Safety net: if quitAndInstall did not terminate the process
      // (e.g. install() returned false), force a relaunch + quit so
      // autoInstallOnAppQuit can apply the update on exit.
      setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn('[appUpdate] quitAndInstall did not exit — forcing relaunch')
        app.relaunch()
        app.quit()
      }, 3000)
    }, 500)
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
