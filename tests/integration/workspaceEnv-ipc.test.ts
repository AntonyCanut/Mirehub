import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createMockIpcMain } from '../mocks/electron'

const TEST_DIR = path.join(os.tmpdir(), `.theone-wsenv-ipc-test-${process.pid}-${Date.now()}`)
const projectDir1 = path.join(TEST_DIR, 'projects', 'project-alpha')
const projectDir2 = path.join(TEST_DIR, 'projects', 'project-beta')

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

describe('WorkspaceEnv IPC Handlers', () => {
  let mockIpcMain: ReturnType<typeof createMockIpcMain>

  beforeEach(async () => {
    vi.resetModules()

    // Clean up
    if (fs.existsSync(path.join(TEST_DIR, '.theone'))) {
      fs.rmSync(path.join(TEST_DIR, '.theone'), { recursive: true, force: true })
    }

    // Create test project directories
    fs.mkdirSync(projectDir1, { recursive: true })
    fs.mkdirSync(projectDir2, { recursive: true })

    const { registerWorkspaceEnvHandlers } = await import('../../src/main/ipc/workspaceEnv')

    mockIpcMain = createMockIpcMain()
    registerWorkspaceEnvHandlers(mockIpcMain as never)
  })

  afterEach(() => {
    if (fs.existsSync(path.join(TEST_DIR, '.theone'))) {
      fs.rmSync(path.join(TEST_DIR, '.theone'), { recursive: true, force: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('enregistre les 2 handlers workspace env', () => {
    expect(mockIpcMain._handlers.has('workspace:envSetup')).toBe(true)
    expect(mockIpcMain._handlers.has('workspace:envPath')).toBe(true)
  })

  describe('workspace:envSetup', () => {
    it('cree un env avec des symlinks vers les projets', async () => {
      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-1',
        projectPaths: [projectDir1, projectDir2],
      })

      expect(result.success).toBe(true)
      expect(result.envPath).toBeDefined()

      // Verifier que les symlinks existent
      const envDir = result.envPath
      const entries = fs.readdirSync(envDir)
      expect(entries).toHaveLength(2)
      expect(entries).toContain('project-alpha')
      expect(entries).toContain('project-beta')

      // Verifier que ce sont des symlinks
      const stat = fs.lstatSync(path.join(envDir, 'project-alpha'))
      expect(stat.isSymbolicLink()).toBe(true)
    })

    it('gere les noms de dossiers dupliques', async () => {
      // Deux projets avec le meme nom de dossier
      const dup1 = path.join(TEST_DIR, 'workspace-a', 'myproject')
      const dup2 = path.join(TEST_DIR, 'workspace-b', 'myproject')
      fs.mkdirSync(dup1, { recursive: true })
      fs.mkdirSync(dup2, { recursive: true })

      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-dup',
        projectPaths: [dup1, dup2],
      })

      expect(result.success).toBe(true)

      const entries = fs.readdirSync(result.envPath)
      expect(entries).toHaveLength(2)
      // Le deuxieme devrait avoir un suffixe
      expect(entries).toContain('myproject')
      expect(entries).toContain('myproject-2')
    })

    it('nettoie les symlinks existants avant de recreer', async () => {
      // Premier setup
      await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-clean',
        projectPaths: [projectDir1],
      })

      // Deuxieme setup avec un projet different
      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-clean',
        projectPaths: [projectDir2],
      })

      expect(result.success).toBe(true)
      const entries = fs.readdirSync(result.envPath)
      expect(entries).toHaveLength(1)
      expect(entries).toContain('project-beta')
    })

    it('gere un workspace avec un seul projet', async () => {
      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-single',
        projectPaths: [projectDir1],
      })

      expect(result.success).toBe(true)
      const entries = fs.readdirSync(result.envPath)
      expect(entries).toHaveLength(1)
      expect(entries).toContain('project-alpha')

      // Verifier que le symlink pointe vers le bon dossier
      const target = fs.readlinkSync(path.join(result.envPath, 'project-alpha'))
      expect(target).toBe(projectDir1)
    })

    it('gere un workspace avec un projet contenant .claude', async () => {
      // Creer un .claude dans le projet
      const claudeDir = path.join(projectDir1, '.claude')
      fs.mkdirSync(claudeDir, { recursive: true })
      fs.writeFileSync(path.join(projectDir1, 'CLAUDE.md'), '# Project Config')
      fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{"key":"val"}')

      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-claude',
        projectPaths: [projectDir1],
      })

      expect(result.success).toBe(true)

      // Le symlink doit pointer vers le projet qui contient .claude
      const linkTarget = fs.readlinkSync(path.join(result.envPath, 'project-alpha'))
      expect(linkTarget).toBe(projectDir1)

      // Via le symlink, on doit pouvoir acceder au .claude
      const claudeMd = fs.readFileSync(path.join(result.envPath, 'project-alpha', 'CLAUDE.md'), 'utf-8')
      expect(claudeMd).toBe('# Project Config')
    })

    it('gere une liste de projets vide', async () => {
      const result = await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-empty',
        projectPaths: [],
      })

      expect(result.success).toBe(true)
      const entries = fs.readdirSync(result.envPath)
      expect(entries).toHaveLength(0)
    })
  })

  describe('workspace:envPath', () => {
    it('retourne le chemin de l env existant', async () => {
      await mockIpcMain._invoke('workspace:envSetup', {
        workspaceId: 'ws-path',
        projectPaths: [projectDir1],
      })

      const envPath = await mockIpcMain._invoke('workspace:envPath', {
        workspaceId: 'ws-path',
      })

      expect(envPath).toBeDefined()
      expect(envPath).toContain('ws-path')
    })

    it('retourne null si l env n existe pas', async () => {
      const envPath = await mockIpcMain._invoke('workspace:envPath', {
        workspaceId: 'ws-nonexistent',
      })

      expect(envPath).toBeNull()
    })
  })
})
