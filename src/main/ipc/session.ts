import { IpcMain } from 'electron'
import { IPC_CHANNELS, SessionData } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerSessionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE, async (_event, session: SessionData) => {
    storage.saveSession(session)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, async () => {
    return storage.getSession()
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_CLEAR, async () => {
    storage.clearSession()
    return { success: true }
  })
}
