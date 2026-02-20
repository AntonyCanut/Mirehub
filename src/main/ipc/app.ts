import { IpcMain, Notification } from 'electron'
import { IPC_CHANNELS, AppSettings } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerAppHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.APP_SETTINGS_GET, async () => {
    return storage.getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.APP_SETTINGS_SET,
    async (_event, settings: Partial<AppSettings>) => {
      storage.updateSettings(settings)
      return storage.getSettings()
    },
  )

  ipcMain.on(
    IPC_CHANNELS.APP_NOTIFICATION,
    (_event, data: { title: string; body: string }) => {
      const notification = new Notification({
        title: data.title,
        body: data.body,
        silent: false,
      })
      notification.show()
    },
  )
}
