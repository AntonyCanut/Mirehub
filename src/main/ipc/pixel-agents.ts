import { IpcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { PixelAgentsService } from '../services/pixel-agents-service'
import { loadPixelAgentsAssets } from '../services/pixel-agents-assets'

let service: PixelAgentsService | null = null

/** Returns the singleton service, creating and starting it if needed. */
function getService(): PixelAgentsService {
  if (!service) {
    service = new PixelAgentsService()
    service.start()
  }
  return service
}

export function registerPixelAgentsHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null,
): void {
  // Start the background service immediately so it buffers agent state
  // even before the Pixel Agents UI is opened.
  try {
    getService()
  } catch (err) {
    console.error('[PixelAgents] Failed to start background service:', err)
  }

  ipcMain.handle(IPC_CHANNELS.PIXEL_AGENTS_START, async () => {
    const win = getMainWindow()
    if (!win) return { success: false, error: 'No main window' }
    const svc = getService()
    svc.attachEmitter((event) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.PIXEL_AGENTS_EVENT, event)
      }
    })
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PIXEL_AGENTS_STOP, async () => {
    if (service) {
      service.detachEmitter()
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PIXEL_AGENTS_WEBVIEW_READY, async () => {
    const assets = await loadPixelAgentsAssets()
    const agents = getService().getActiveAgents()
    return { assets, agents }
  })

  ipcMain.handle(IPC_CHANNELS.PIXEL_AGENTS_SAVE_LAYOUT, async (_event, layout: unknown) => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const os = await import('os')
    const dir = path.join(os.homedir(), '.kanbai', 'pixel-agents')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'layout.json'), JSON.stringify(layout, null, 2), 'utf-8')
    return { success: true }
  })
}

/** Fully shut down the pixel-agents service. Call on app quit. */
export function shutdownPixelAgentsService(): void {
  if (service) {
    service.shutdown()
    service = null
  }
}
