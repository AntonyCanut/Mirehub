import { IpcMain } from 'electron'
import { v4 as uuid } from 'uuid'
import { IPC_CHANNELS, Namespace } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerNamespaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.NAMESPACE_LIST, async () => {
    return storage.getNamespaces()
  })

  ipcMain.handle(
    IPC_CHANNELS.NAMESPACE_CREATE,
    async (_event, data: { name: string; color?: string }) => {
      const namespace: Namespace = {
        id: uuid(),
        name: data.name,
        color: data.color,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      storage.addNamespace(namespace)
      return namespace
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.NAMESPACE_UPDATE,
    async (_event, data: { id: string } & Partial<Namespace>) => {
      const namespace = storage.getNamespace(data.id)
      if (!namespace) throw new Error(`Namespace ${data.id} not found`)
      const updated = { ...namespace, ...data, updatedAt: Date.now() }
      storage.updateNamespace(updated)
      return updated
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.NAMESPACE_DELETE,
    async (_event, { id }: { id: string }) => {
      storage.deleteNamespace(id)
    },
  )

  ipcMain.handle(IPC_CHANNELS.NAMESPACE_ENSURE_DEFAULT, async () => {
    return storage.ensureDefaultNamespace()
  })
}
