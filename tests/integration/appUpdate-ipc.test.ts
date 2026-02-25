import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMockIpcMain } from '../mocks/electron'

// ---- Mocks ----

const mockQuitAndInstall = vi.fn()
const mockCheckForUpdates = vi.fn()
const mockDownloadUpdate = vi.fn()
const mockAutoUpdaterOn = vi.fn()

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    on: (...args: unknown[]) => mockAutoUpdaterOn(...args),
    checkForUpdates: (...args: unknown[]) => mockCheckForUpdates(...args),
    downloadUpdate: (...args: unknown[]) => mockDownloadUpdate(...args),
    quitAndInstall: (...args: unknown[]) => mockQuitAndInstall(...args),
  },
}))

const mockAppRelaunch = vi.fn()
const mockAppQuit = vi.fn()
const mockWebContentsSend = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          send: (...args: unknown[]) => mockWebContentsSend(...args),
        },
      },
    ],
  },
  app: {
    relaunch: (...args: unknown[]) => mockAppRelaunch(...args),
    quit: (...args: unknown[]) => mockAppQuit(...args),
  },
}))

// Mock StorageService to avoid file system access.
// Use a plain class so the mock survives vi.resetModules().
vi.mock('../../src/main/services/storage', () => {
  class MockStorageService {
    getSettings() {
      return { checkUpdatesOnLaunch: false }
    }
  }
  return {
    StorageService: MockStorageService,
    _resetForTesting: () => {},
  }
})

// ---- Tests ----

describe('AppUpdate IPC Handlers - APP_UPDATE_INSTALL', () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>

  beforeEach(async () => {
    vi.useFakeTimers()
    mockQuitAndInstall.mockReset()
    mockCheckForUpdates.mockReset()
    mockDownloadUpdate.mockReset()
    mockAutoUpdaterOn.mockReset()
    mockAppRelaunch.mockReset()
    mockAppQuit.mockReset()
    mockWebContentsSend.mockReset()
    vi.resetModules()

    // Re-import after resetModules to get fresh module state
    const { registerAppUpdateHandlers } = await import(
      '../../src/main/ipc/appUpdate'
    )

    mockIpcMain = createMockIpcMain()
    registerAppUpdateHandlers(mockIpcMain as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enregistre les 3 handlers appUpdate', () => {
    expect(mockIpcMain._handlers.has('appUpdate:check')).toBe(true)
    expect(mockIpcMain._handlers.has('appUpdate:download')).toBe(true)
    expect(mockIpcMain._handlers.has('appUpdate:install')).toBe(true)
  })

  describe('install - delai avant quitAndInstall', () => {
    it('ne appelle pas quitAndInstall immediatement', async () => {
      await mockIpcMain._invoke('appUpdate:install')

      // quitAndInstall should NOT be called yet (500ms cleanup + 300ms PTY teardown not elapsed)
      expect(mockQuitAndInstall).not.toHaveBeenCalled()
    })

    it('appelle quitAndInstall(false, true) apres 800ms', async () => {
      await mockIpcMain._invoke('appUpdate:install')

      // Advance past the 500ms cleanup + 300ms PTY teardown delay
      vi.advanceTimersByTime(800)

      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1)
      expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true)
    })

    it('ne appelle pas quitAndInstall avant 800ms', async () => {
      await mockIpcMain._invoke('appUpdate:install')

      // Advance just under 800ms (500ms cleanup + 300ms PTY teardown)
      vi.advanceTimersByTime(799)

      expect(mockQuitAndInstall).not.toHaveBeenCalled()

      // Now tick to exactly 800ms
      vi.advanceTimersByTime(1)

      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1)
    })
  })

  describe('install - gestion des erreurs de quitAndInstall', () => {
    it('catche l erreur si quitAndInstall lance une exception', async () => {
      mockQuitAndInstall.mockImplementation(() => {
        throw new Error('quitAndInstall failed: ENOENT')
      })

      await mockIpcMain._invoke('appUpdate:install')

      // Should not throw - the error is caught internally
      expect(() => vi.advanceTimersByTime(800)).not.toThrow()

      // quitAndInstall was called (and threw)
      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('log l erreur dans la console quand quitAndInstall echoue', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('install() returned false')

      mockQuitAndInstall.mockImplementation(() => {
        throw error
      })

      await mockIpcMain._invoke('appUpdate:install')
      vi.advanceTimersByTime(800)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[appUpdate] quitAndInstall failed:',
        error,
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('install - filet de securite (safety net)', () => {
    it('declenche app.relaunch + app.quit apres 3800ms total si le process n a pas quitte', async () => {
      // quitAndInstall succeeds but does not actually terminate the process
      mockQuitAndInstall.mockImplementation(() => {
        // No-op: simulates quitAndInstall returning without killing the process
      })

      await mockIpcMain._invoke('appUpdate:install')

      // Advance past the 500ms cleanup + 300ms PTY teardown -> triggers quitAndInstall
      vi.advanceTimersByTime(800)
      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1)

      // Safety net should NOT have fired yet
      expect(mockAppRelaunch).not.toHaveBeenCalled()
      expect(mockAppQuit).not.toHaveBeenCalled()

      // Advance 3000ms more (the safety net timeout)
      vi.advanceTimersByTime(3000)

      expect(mockAppRelaunch).toHaveBeenCalledTimes(1)
      expect(mockAppQuit).toHaveBeenCalledTimes(1)
    })

    it('declenche le filet de securite meme si quitAndInstall a lance une exception', async () => {
      mockQuitAndInstall.mockImplementation(() => {
        throw new Error('quitAndInstall crashed')
      })

      // Suppress console.error noise from the caught exception
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await mockIpcMain._invoke('appUpdate:install')

      // Advance past 800ms (500ms cleanup + 300ms PTY teardown) -> quitAndInstall (throws, caught)
      vi.advanceTimersByTime(800)
      expect(mockQuitAndInstall).toHaveBeenCalledTimes(1)

      // Safety net not yet
      expect(mockAppRelaunch).not.toHaveBeenCalled()
      expect(mockAppQuit).not.toHaveBeenCalled()

      // Advance 3000ms more for the safety net
      vi.advanceTimersByTime(3000)

      expect(mockAppRelaunch).toHaveBeenCalledTimes(1)
      expect(mockAppQuit).toHaveBeenCalledTimes(1)

      consoleErrorSpy.mockRestore()
    })

    it('ne declenche pas le filet de securite avant 3000ms apres quitAndInstall', async () => {
      mockQuitAndInstall.mockImplementation(() => {})

      await mockIpcMain._invoke('appUpdate:install')

      // Advance past 800ms (500ms cleanup + 300ms PTY teardown)
      vi.advanceTimersByTime(800)

      // Advance 2999ms (just under the safety net threshold)
      vi.advanceTimersByTime(2999)

      expect(mockAppRelaunch).not.toHaveBeenCalled()
      expect(mockAppQuit).not.toHaveBeenCalled()

      // One more ms triggers it
      vi.advanceTimersByTime(1)

      expect(mockAppRelaunch).toHaveBeenCalledTimes(1)
      expect(mockAppQuit).toHaveBeenCalledTimes(1)
    })

    it('log un warning dans la console quand le filet de securite se declenche', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockQuitAndInstall.mockImplementation(() => {})

      await mockIpcMain._invoke('appUpdate:install')

      vi.advanceTimersByTime(800) // quitAndInstall (500ms cleanup + 300ms teardown)
      vi.advanceTimersByTime(3000) // safety net

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[appUpdate] quitAndInstall did not exit — forcing relaunch',
      )

      consoleWarnSpy.mockRestore()
    })

    it('appelle relaunch avant quit (ordre correct)', async () => {
      const callOrder: string[] = []
      mockAppRelaunch.mockImplementation(() => callOrder.push('relaunch'))
      mockAppQuit.mockImplementation(() => callOrder.push('quit'))
      mockQuitAndInstall.mockImplementation(() => {})

      await mockIpcMain._invoke('appUpdate:install')

      vi.advanceTimersByTime(800) // quitAndInstall (500ms cleanup + 300ms teardown)
      vi.advanceTimersByTime(3000) // safety net

      expect(callOrder).toEqual(['relaunch', 'quit'])
    })
  })

  describe('install - retour du handler', () => {
    it('le handler retourne avant que quitAndInstall soit appele (asynchrone)', async () => {
      // The handler should return immediately (undefined), with the quit
      // happening asynchronously via setTimeout
      const result = await mockIpcMain._invoke('appUpdate:install')

      // Handler returns undefined (no explicit return value)
      expect(result).toBeUndefined()

      // quitAndInstall hasn't been called yet because setTimeout hasn't fired
      expect(mockQuitAndInstall).not.toHaveBeenCalled()
    })
  })
})
