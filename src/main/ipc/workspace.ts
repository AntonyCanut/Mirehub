import { IpcMain } from 'electron'
import { v4 as uuid } from 'uuid'
import { IPC_CHANNELS, Workspace } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, async () => {
    return storage.getWorkspaces()
  })

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE,
    async (_event, data: { name: string; color?: string }) => {
      const workspace: Workspace = {
        id: uuid(),
        name: data.name,
        color: data.color || '#3b82f6',
        projectIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      storage.addWorkspace(workspace)
      return workspace
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE,
    async (_event, data: { id: string } & Partial<Workspace>) => {
      const workspace = storage.getWorkspace(data.id)
      if (!workspace) throw new Error(`Workspace ${data.id} not found`)
      const updated = { ...workspace, ...data, updatedAt: Date.now() }
      storage.updateWorkspace(updated)
      return updated
    },
  )

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (_event, { id }: { id: string }) => {
    storage.deleteWorkspace(id)
  })
}
