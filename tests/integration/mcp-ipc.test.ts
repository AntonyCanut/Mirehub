import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockIpcMain } from '../mocks/electron'

// Mock child_process.execFile with callback-style signature
const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

describe('MCP IPC Handlers', () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>

  beforeEach(async () => {
    mockExecFile.mockReset()
    vi.resetModules()

    const { registerMcpHandlers } = await import('../../src/main/ipc/mcp')

    mockIpcMain = createMockIpcMain()
    registerMcpHandlers(mockIpcMain as never)
  })

  it('enregistre le handler MCP_GET_HELP', () => {
    expect(mockIpcMain._handlers.has('mcp:getHelp')).toBe(true)
  })

  describe('mcp:getHelp', () => {
    it('retourne le help depuis stdout', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          callback(null, 'Usage: my-tool [options]\n  --verbose  Enable verbose mode', '')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'my-tool',
        config: { command: 'my-tool', args: [] },
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe('Usage: my-tool [options]\n  --verbose  Enable verbose mode')
      expect(result.error).toBeUndefined()
    })

    it('retourne le help depuis stderr (certains CLI ecrivent le help sur stderr)', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          callback(null, '', 'Usage: tool [options]\n  --help  Show help')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'tool',
        config: { command: 'tool', args: [] },
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe('Usage: tool [options]\n  --help  Show help')
    })

    it('retourne stdout + stderr combines', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          callback(null, 'stdout content\n', 'stderr content\n')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'combined',
        config: { command: 'combined', args: [] },
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe('stdout content\nstderr content\n')
    })

    it('retourne une erreur quand la commande est introuvable', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: Error, stdout: string, stderr: string) => void) => {
          callback(new Error('spawn my-tool ENOENT'), '', '')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'my-tool',
        config: { command: 'my-tool', args: [] },
      })

      expect(result.success).toBe(false)
      expect(result.output).toBe('')
      expect(result.error).toBe('spawn my-tool ENOENT')
    })

    it('retourne un message par defaut quand aucune sortie n est produite', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          callback(null, '', '')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'silent-tool',
        config: { command: 'silent-tool', args: [] },
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe('No help output for "silent-tool"')
    })

    it('passe --help comme dernier argument', async () => {
      mockExecFile.mockImplementation(
        (cmd: string, args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          // Capture the args for assertion
          callback(null, `called: ${cmd} ${args.join(' ')}`, '')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'test-tool',
        config: { command: 'test-tool', args: [] },
      })

      expect(result.output).toBe('called: test-tool --help')
    })

    it('passe les args custom avant --help', async () => {
      let capturedArgs: string[] = []

      mockExecFile.mockImplementation(
        (_cmd: string, args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          capturedArgs = args
          callback(null, 'help output', '')
        },
      )

      await mockIpcMain._invoke('mcp:getHelp', {
        name: 'mcp-server',
        config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      })

      expect(capturedArgs).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '--help'])
    })

    it('passe les variables d environnement depuis la config', async () => {
      let capturedOptions: { env?: Record<string, string> } = {}

      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], opts: { env?: Record<string, string> }, callback: (err: null, stdout: string, stderr: string) => void) => {
          capturedOptions = opts
          callback(null, 'help', '')
        },
      )

      await mockIpcMain._invoke('mcp:getHelp', {
        name: 'env-tool',
        config: {
          command: 'env-tool',
          args: [],
          env: { API_KEY: 'secret-123', NODE_ENV: 'production' },
        },
      })

      expect(capturedOptions.env).toBeDefined()
      expect(capturedOptions.env!.API_KEY).toBe('secret-123')
      expect(capturedOptions.env!.NODE_ENV).toBe('production')
      // process.env variables should also be present (spread)
      expect(capturedOptions.env!.PATH).toBeDefined()
    })

    it('reussit meme avec une erreur si stdout ou stderr contiennent du contenu', async () => {
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, callback: (err: Error, stdout: string, stderr: string) => void) => {
          // Many CLI tools return exit code 1 for --help but still print help
          callback(new Error('exit code 1'), 'Usage: tool [options]', '')
        },
      )

      const result = await mockIpcMain._invoke('mcp:getHelp', {
        name: 'quirky-tool',
        config: { command: 'quirky-tool', args: [] },
      })

      expect(result.success).toBe(true)
      expect(result.output).toBe('Usage: tool [options]')
    })

    it('gere les args undefined dans la config', async () => {
      let capturedArgs: string[] = []

      mockExecFile.mockImplementation(
        (_cmd: string, args: string[], _opts: unknown, callback: (err: null, stdout: string, stderr: string) => void) => {
          capturedArgs = args
          callback(null, 'help', '')
        },
      )

      await mockIpcMain._invoke('mcp:getHelp', {
        name: 'no-args-tool',
        config: { command: 'no-args-tool' },
      })

      // With args undefined, config.args ?? [] should produce just ['--help']
      expect(capturedArgs).toEqual(['--help'])
    })
  })
})
