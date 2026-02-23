import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockIpcMain } from '../mocks/electron'

// Track execFile calls
const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}))

vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util')
  return {
    ...actual,
    promisify: () => async (command: string, args: string[], _options?: unknown) => {
      return mockExecFile(command, args)
    },
  }
})

// Mock BrowserWindow
const mockWebContentsSend = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {
          send: mockWebContentsSend,
          isDestroyed: () => false,
        },
      },
    ],
  },
}))

describe('Update IPC Handlers', () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>

  beforeEach(async () => {
    mockExecFile.mockReset()
    mockWebContentsSend.mockClear()
    vi.resetModules()

    const { registerUpdateHandlers } = await import('../../src/main/ipc/updates')

    mockIpcMain = createMockIpcMain()
    registerUpdateHandlers(mockIpcMain as never)
  })

  it('enregistre les 2 handlers update', () => {
    expect(mockIpcMain._handlers.has('update:check')).toBe(true)
    expect(mockIpcMain._handlers.has('update:install')).toBe(true)
  })

  describe('check', () => {
    it('verifie les versions des outils', async () => {
      mockExecFile.mockImplementation((command: string, args: string[]) => {
        if (command === 'node' && args[0] === '--version') {
          return Promise.resolve({ stdout: 'v20.0.0\n' })
        }
        if (command === 'npm' && args[0] === '--version') {
          return Promise.resolve({ stdout: '10.0.0\n' })
        }
        if (command === 'claude' && args[0] === '--version') {
          return Promise.resolve({ stdout: '1.0.0\n' })
        }
        if (command === 'git' && args[0] === '--version') {
          return Promise.resolve({ stdout: 'git version 2.40.0\n' })
        }
        if (command === 'brew' && args[0] === 'info') {
          return Promise.resolve({
            stdout: JSON.stringify({
              formulae: [{ versions: { stable: '22.0.0' } }],
            }),
          })
        }
        if (command === 'npm' && args[0] === 'view') {
          if (args[1] === 'npm') return Promise.resolve({ stdout: '11.0.0\n' })
          if (args[1] === '@anthropic-ai/claude-code') return Promise.resolve({ stdout: '2.0.0\n' })
        }
        return Promise.reject(new Error(`Unknown command: ${command} ${args.join(' ')}`))
      })

      const results = await mockIpcMain._invoke('update:check')

      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)

      const nodeInfo = results.find((r: { tool: string }) => r.tool === 'node')
      expect(nodeInfo).toBeDefined()
      expect(nodeInfo.currentVersion).toBe('20.0.0')
      expect(nodeInfo.scope).toBe('global')
    })

    it('retourne les outils introuvables avec installed a false', async () => {
      mockExecFile.mockImplementation((command: string, args: string[]) => {
        if (command === 'node' && args[0] === '--version') {
          return Promise.resolve({ stdout: 'v20.0.0\n' })
        }
        // All other tools fail
        return Promise.reject(new Error('command not found'))
      })

      const results = await mockIpcMain._invoke('update:check')

      // All tools are returned, but only node is installed
      const installed = results.filter((r: { installed: boolean }) => r.installed)
      expect(installed).toHaveLength(1)
      expect(installed[0].tool).toBe('node')

      const notInstalled = results.filter((r: { installed: boolean }) => !r.installed)
      expect(notInstalled.length).toBeGreaterThan(0)
      notInstalled.forEach((r: { currentVersion: string }) => {
        expect(r.currentVersion).toBe('')
      })
    })

    it('retourne tous les outils comme non installes si aucun n est disponible', async () => {
      mockExecFile.mockRejectedValue(new Error('command not found'))

      const results = await mockIpcMain._invoke('update:check')

      // All tools returned but none installed
      expect(results.length).toBeGreaterThan(0)
      results.forEach((r: { installed: boolean; currentVersion: string }) => {
        expect(r.installed).toBe(false)
        expect(r.currentVersion).toBe('')
      })
    })
  })

  describe('install', () => {
    it('installe une mise a jour npm', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await mockIpcMain._invoke('update:install', {
        tool: 'npm',
        scope: 'global',
      })

      expect(result).toEqual({ success: true })
      expect(mockWebContentsSend).toHaveBeenCalledWith('update:status', expect.objectContaining({
        tool: 'npm',
        status: 'completed',
        progress: 100,
      }))
    })

    it('installe une mise a jour node via brew', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await mockIpcMain._invoke('update:install', {
        tool: 'node',
        scope: 'global',
      })

      expect(result).toEqual({ success: true })
    })

    it('installe une mise a jour claude', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

      const result = await mockIpcMain._invoke('update:install', {
        tool: 'claude',
        scope: 'global',
      })

      expect(result).toEqual({ success: true })
    })

    it('echoue pour un outil inconnu', async () => {
      const result = await mockIpcMain._invoke('update:install', {
        tool: 'unknown-tool',
        scope: 'global',
      })

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Unknown tool'),
      })
    })

    it('gere les erreurs d installation', async () => {
      mockExecFile.mockRejectedValue(new Error('Permission denied'))

      const result = await mockIpcMain._invoke('update:install', {
        tool: 'npm',
        scope: 'global',
      })

      expect(result).toEqual({
        success: false,
        error: 'Permission denied',
      })
      expect(mockWebContentsSend).toHaveBeenCalledWith('update:status', expect.objectContaining({
        status: 'failed',
      }))
    })

    it('envoie les notifications de progression', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' })

      await mockIpcMain._invoke('update:install', {
        tool: 'npm',
        scope: 'global',
      })

      // Should have sent: starting, installing (50%), completed (100%)
      const statusCalls = mockWebContentsSend.mock.calls.filter(
        (call: unknown[]) => call[0] === 'update:status',
      )
      expect(statusCalls.length).toBeGreaterThanOrEqual(3)

      expect(statusCalls[0][1]).toMatchObject({ status: 'starting' })
      expect(statusCalls[1][1]).toMatchObject({ status: 'installing', progress: 50 })
      expect(statusCalls[2][1]).toMatchObject({ status: 'completed', progress: 100 })
    })
  })
})
