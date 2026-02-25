import { IpcMain } from 'electron'
import { execFileSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import { IPC_CHANNELS, GitProfile } from '../../shared/types'
import { StorageService } from '../services/storage'

const storage = new StorageService()

/** Read a global git config value. Returns empty string if not set. */
function getGlobalGitConfig(key: string): string {
  try {
    return execFileSync('git', ['config', '--global', key], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return ''
  }
}

/** Write a global git config value. */
function setGlobalGitConfig(key: string, value: string): void {
  execFileSync('git', ['config', '--global', key, value], {
    encoding: 'utf-8',
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function registerGitConfigHandlers(ipcMain: IpcMain): void {
  /**
   * Get git config for a namespace.
   * - Default namespace: reads from git config --global
   * - Other namespaces: reads stored profile, falling back to global config
   */
  ipcMain.handle(
    IPC_CHANNELS.GIT_CONFIG_GET,
    async (_event, { namespaceId }: { namespaceId: string }) => {
      const namespace = storage.getNamespace(namespaceId)
      if (!namespace) throw new Error(`Namespace ${namespaceId} not found`)

      if (namespace.isDefault) {
        return {
          userName: getGlobalGitConfig('user.name'),
          userEmail: getGlobalGitConfig('user.email'),
          isCustom: false,
        }
      }

      const profile = storage.getGitProfile(namespaceId)
      if (profile) {
        return {
          userName: profile.userName,
          userEmail: profile.userEmail,
          isCustom: true,
        }
      }

      // No custom profile: inherit from global
      return {
        userName: getGlobalGitConfig('user.name'),
        userEmail: getGlobalGitConfig('user.email'),
        isCustom: false,
      }
    },
  )

  /**
   * Set git config for a namespace.
   * - Default namespace: writes to git config --global
   * - Other namespaces: creates/updates a stored profile
   */
  ipcMain.handle(
    IPC_CHANNELS.GIT_CONFIG_SET,
    async (
      _event,
      { namespaceId, userName, userEmail }: { namespaceId: string; userName: string; userEmail: string },
    ) => {
      const namespace = storage.getNamespace(namespaceId)
      if (!namespace) throw new Error(`Namespace ${namespaceId} not found`)

      if (namespace.isDefault) {
        setGlobalGitConfig('user.name', userName)
        setGlobalGitConfig('user.email', userEmail)
        return { success: true, isCustom: false }
      }

      // Create or update stored profile for non-default namespace
      const existing = storage.getGitProfile(namespaceId)
      const profile: GitProfile = {
        id: existing?.id ?? uuid(),
        namespaceId,
        userName,
        userEmail,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      }
      storage.setGitProfile(profile)
      return { success: true, isCustom: true }
    },
  )

  /**
   * Delete a custom git profile for a namespace (revert to global).
   * Cannot delete the default namespace's config (it IS the global config).
   */
  ipcMain.handle(
    IPC_CHANNELS.GIT_CONFIG_DELETE,
    async (_event, { namespaceId }: { namespaceId: string }) => {
      const namespace = storage.getNamespace(namespaceId)
      if (!namespace) throw new Error(`Namespace ${namespaceId} not found`)
      if (namespace.isDefault) {
        throw new Error('Cannot delete default namespace git config')
      }
      storage.deleteGitProfile(namespaceId)
      return { success: true }
    },
  )
}
