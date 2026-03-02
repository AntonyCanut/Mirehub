import { IpcMain } from 'electron'
import { IPC_CHANNELS, type AiDefaults } from '../../shared/types'
import type { AiProviderId } from '../../shared/types/ai-provider'
import { StorageService } from '../services/storage'

const storage = new StorageService()

export function registerAiProviderHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_SET,
    async (_event, { projectId, provider }: { projectId: string; provider: AiProviderId }) => {
      if (typeof projectId !== 'string') throw new Error('Invalid project ID')
      if (typeof provider !== 'string') throw new Error('Invalid provider')

      const projects = storage.getProjects()
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }

      project.aiProvider = provider
      // Keep hasClaude in sync for backward compatibility
      project.hasClaude = provider === 'claude'
      storage.updateProject(project)
      return { success: true }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_DEFAULTS_SET,
    async (_event, { projectId, defaults }: { projectId: string; defaults: AiDefaults }) => {
      if (typeof projectId !== 'string') throw new Error('Invalid project ID')

      const projects = storage.getProjects()
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }

      project.aiDefaults = defaults
      storage.updateProject(project)
      return { success: true }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_DEFAULTS_GET,
    async (_event, { projectId }: { projectId: string }) => {
      if (typeof projectId !== 'string') throw new Error('Invalid project ID')

      const projects = storage.getProjects()
      const project = projects.find((p) => p.id === projectId)
      return project?.aiDefaults ?? {}
    },
  )
}
