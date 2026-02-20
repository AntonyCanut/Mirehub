import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createMockIpcMain } from '../mocks/electron'

const TEST_DIR = path.join(os.tmpdir(), `.theone-ipc-test-${process.pid}-${Date.now()}`)
const dataDir = path.join(TEST_DIR, '.theone')

// Mock os.homedir to use temp directory
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => TEST_DIR,
    },
    homedir: () => TEST_DIR,
  }
})

// Mock uuid to return predictable IDs
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}))

describe('Workspace IPC Handlers', () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>

  beforeEach(async () => {
    uuidCounter = 0
    // Reset modules so StorageService gets re-instantiated fresh
    vi.resetModules()

    // Ensure clean data directory
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true })
    }
    fs.mkdirSync(dataDir, { recursive: true })

    // Re-import after module reset to get fresh StorageService instance
    const { registerWorkspaceHandlers } = await import('../../src/main/ipc/workspace')

    mockIpcMain = createMockIpcMain()
    registerWorkspaceHandlers(mockIpcMain as never)
  })

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('enregistre les 4 handlers workspace', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledTimes(4)
    expect(mockIpcMain._handlers.has('workspace:list')).toBe(true)
    expect(mockIpcMain._handlers.has('workspace:create')).toBe(true)
    expect(mockIpcMain._handlers.has('workspace:update')).toBe(true)
    expect(mockIpcMain._handlers.has('workspace:delete')).toBe(true)
  })

  it('liste les workspaces (vide au depart)', async () => {
    const result = await mockIpcMain._invoke('workspace:list')
    expect(result).toEqual([])
  })

  it('cree un workspace avec les valeurs par defaut', async () => {
    const result = await mockIpcMain._invoke('workspace:create', { name: 'Test Workspace' })

    expect(result).toMatchObject({
      id: 'test-uuid-1',
      name: 'Test Workspace',
      color: '#3b82f6',
      projectIds: [],
    })
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })

  it('cree un workspace avec une couleur personnalisee', async () => {
    const result = await mockIpcMain._invoke('workspace:create', {
      name: 'Custom',
      color: '#ff0000',
    })

    expect(result.color).toBe('#ff0000')
  })

  it('liste les workspaces apres creation', async () => {
    await mockIpcMain._invoke('workspace:create', { name: 'WS 1' })
    await mockIpcMain._invoke('workspace:create', { name: 'WS 2' })

    const list = await mockIpcMain._invoke('workspace:list')
    expect(list).toHaveLength(2)
  })

  it('met a jour un workspace existant', async () => {
    const ws = await mockIpcMain._invoke('workspace:create', { name: 'Original' })

    const updated = await mockIpcMain._invoke('workspace:update', {
      id: ws.id,
      name: 'Renamed',
    })

    expect(updated.name).toBe('Renamed')
    expect(updated.updatedAt).toBeGreaterThanOrEqual(ws.updatedAt)
  })

  it('echoue si on met a jour un workspace inexistant', async () => {
    await expect(
      mockIpcMain._invoke('workspace:update', { id: 'inexistant', name: 'Ghost' }),
    ).rejects.toThrow('Workspace inexistant not found')
  })

  it('supprime un workspace', async () => {
    const ws = await mockIpcMain._invoke('workspace:create', { name: 'To Delete' })

    await mockIpcMain._invoke('workspace:delete', { id: ws.id })

    const list = await mockIpcMain._invoke('workspace:list')
    expect(list).toHaveLength(0)
  })

  it('persiste les donnees sur disque', async () => {
    await mockIpcMain._invoke('workspace:create', { name: 'Persistent' })

    const dataPath = path.join(dataDir, 'data.json')
    expect(fs.existsSync(dataPath)).toBe(true)

    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    expect(raw.workspaces).toHaveLength(1)
    expect(raw.workspaces[0].name).toBe('Persistent')
  })
})
