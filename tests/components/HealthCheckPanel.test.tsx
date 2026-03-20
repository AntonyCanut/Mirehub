import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock i18n
vi.mock('../../src/renderer/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key}:${JSON.stringify(params)}`
      return key
    },
    locale: 'fr',
    setLocale: vi.fn(),
  }),
}))

// Mock healthCheckStore
const mockLoadData = vi.fn()
const mockRefreshData = vi.fn()
const mockAddCheck = vi.fn()
const mockUpdateCheck = vi.fn()
const mockDeleteCheck = vi.fn()
const mockExecuteCheck = vi.fn().mockResolvedValue(null)
const mockStartScheduler = vi.fn()
const mockStopScheduler = vi.fn()
const mockUpdateInterval = vi.fn()
const mockHandleStatusUpdate = vi.fn()
const mockClearHistory = vi.fn()
const mockSelectCheck = vi.fn()

const mockChecks = [
  {
    id: 'hc-1',
    name: 'API Production',
    url: 'https://api.example.com/health',
    method: 'GET' as const,
    expectedStatus: 200,
    notifyOnDown: true,
    headers: [],
    schedule: { enabled: true, interval: 30, unit: 'seconds' as const },
  },
  {
    id: 'hc-2',
    name: 'Staging Server',
    url: 'https://staging.example.com',
    method: 'HEAD' as const,
    expectedStatus: 200,
    notifyOnDown: false,
    headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
    schedule: { enabled: false, interval: 5, unit: 'minutes' as const },
  },
]

let mockStoreState = {
  data: { version: 1, checks: mockChecks, history: [], incidents: [] },
  statuses: {} as Record<string, { status: string; lastCheck?: number; nextCheck?: number }>,
  selectedCheckId: null as string | null,
  schedulerRunning: false,
  loading: false,
  loadData: mockLoadData,
  refreshData: mockRefreshData,
  addCheck: mockAddCheck,
  updateCheck: mockUpdateCheck,
  deleteCheck: mockDeleteCheck,
  executeCheck: mockExecuteCheck,
  startScheduler: mockStartScheduler,
  stopScheduler: mockStopScheduler,
  updateInterval: mockUpdateInterval,
  handleStatusUpdate: mockHandleStatusUpdate,
  clearHistory: mockClearHistory,
  selectCheck: mockSelectCheck,
}

vi.mock('../../src/renderer/lib/stores/healthCheckStore', () => ({
  useHealthCheckStore: () => mockStoreState,
}))

// Mock workspaceStore
vi.mock('../../src/renderer/lib/stores/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = {
        activeProjectId: 'proj-1',
        projects: [
          { id: 'proj-1', name: 'My Project', workspaceId: 'ws-1', path: '/my-project' },
        ],
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        activeProjectId: 'proj-1',
        projects: [
          { id: 'proj-1', name: 'My Project', workspaceId: 'ws-1', path: '/my-project' },
        ],
      }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
}))

import { HealthCheckPanel } from '../../src/renderer/components/HealthCheckPanel'

describe('HealthCheckPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock store state
    mockStoreState = {
      data: { version: 1, checks: mockChecks, history: [], incidents: [] },
      statuses: {},
      selectedCheckId: null,
      schedulerRunning: false,
      loading: false,
      loadData: mockLoadData,
      refreshData: mockRefreshData,
      addCheck: mockAddCheck,
      updateCheck: mockUpdateCheck,
      deleteCheck: mockDeleteCheck,
      executeCheck: mockExecuteCheck,
      startScheduler: mockStartScheduler,
      stopScheduler: mockStopScheduler,
      updateInterval: mockUpdateInterval,
      handleStatusUpdate: mockHandleStatusUpdate,
      clearHistory: mockClearHistory,
      selectCheck: mockSelectCheck,
    }

    // Ensure window.mirehub.healthcheck is available
    const mirehub = window.mirehub as Record<string, unknown>
    mirehub.healthcheck = {
      onStatusUpdate: vi.fn().mockReturnValue(() => {}),
      load: vi.fn().mockResolvedValue({ version: 1, checks: [], history: [], incidents: [] }),
      save: vi.fn().mockResolvedValue(undefined),
      export: vi.fn().mockResolvedValue(undefined),
      import: vi.fn().mockResolvedValue({ success: false }),
    }
  })

  describe('rendu initial', () => {
    it('affiche le titre du panneau healthcheck', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.title')).toBeInTheDocument()
    })

    it('affiche le badge du scheduler a l etat arrete', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.schedulerStopped')).toBeInTheDocument()
    })

    it('affiche la liste des checks existants', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('API Production')).toBeInTheDocument()
      expect(screen.getByText('Staging Server')).toBeInTheDocument()
    })

    it('affiche le message de selection quand aucun check n est selectionne', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.selectCheck')).toBeInTheDocument()
    })

    it('charge les donnees au montage', () => {
      render(<HealthCheckPanel />)
      expect(mockLoadData).toHaveBeenCalledWith('/my-project')
    })
  })

  describe('ajout de check', () => {
    it('affiche le bouton d ajout de check', () => {
      render(<HealthCheckPanel />)
      const addBtn = screen.getByTitle('healthcheck.addCheck')
      expect(addBtn).toBeInTheDocument()
    })

    it('appelle addCheck au clic sur le bouton d ajout', async () => {
      const user = userEvent.setup()
      render(<HealthCheckPanel />)

      await user.click(screen.getByTitle('healthcheck.addCheck'))

      expect(mockAddCheck).toHaveBeenCalledWith('/my-project')
    })
  })

  describe('affichage de la liste des checks', () => {
    it('affiche les informations de methode et interval pour chaque check', () => {
      render(<HealthCheckPanel />)
      // API Production has schedule enabled: "GET · 30s"
      expect(screen.getByText(/GET/)).toBeInTheDocument()
    })

    it('affiche un message vide quand il n y a pas de checks', () => {
      mockStoreState.data = { version: 1, checks: [], history: [], incidents: [] }
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.empty')).toBeInTheDocument()
    })
  })

  describe('execution d un check', () => {
    it('affiche le bouton play pour chaque check', () => {
      render(<HealthCheckPanel />)
      const playButtons = screen.getAllByTitle('healthcheck.executeNow')
      expect(playButtons.length).toBe(2)
    })

    it('appelle executeCheck au clic sur le bouton play', async () => {
      const user = userEvent.setup()
      render(<HealthCheckPanel />)

      const playButtons = screen.getAllByTitle('healthcheck.executeNow')
      await user.click(playButtons[0]!)

      expect(mockExecuteCheck).toHaveBeenCalledWith('/my-project', 'hc-1')
    })
  })

  describe('gestion du scheduler', () => {
    it('affiche le bouton de demarrage du scheduler', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.startScheduler')).toBeInTheDocument()
    })

    it('affiche le bouton d arret quand le scheduler tourne', () => {
      mockStoreState.schedulerRunning = true
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.stopScheduler')).toBeInTheDocument()
      expect(screen.getByText('healthcheck.schedulerActive')).toBeInTheDocument()
    })

    it('appelle startScheduler au clic sur le bouton demarrer', async () => {
      const user = userEvent.setup()
      render(<HealthCheckPanel />)

      await user.click(screen.getByText('healthcheck.startScheduler'))

      expect(mockStartScheduler).toHaveBeenCalledWith('/my-project')
    })

    it('appelle stopScheduler au clic sur le bouton arreter', async () => {
      mockStoreState.schedulerRunning = true
      const user = userEvent.setup()
      render(<HealthCheckPanel />)

      await user.click(screen.getByText('healthcheck.stopScheduler'))

      expect(mockStopScheduler).toHaveBeenCalledWith('/my-project')
    })
  })

  describe('detail d un check selectionne', () => {
    it('affiche le formulaire de configuration quand un check est selectionne', () => {
      mockStoreState.selectedCheckId = 'hc-1'
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.config')).toBeInTheDocument()
      expect(screen.getByText('healthcheck.schedule')).toBeInTheDocument()
    })

    it('affiche l etat vide de l historique pour un check sans historique', () => {
      mockStoreState.selectedCheckId = 'hc-1'
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.historyEmpty')).toBeInTheDocument()
    })
  })

  describe('etat de chargement', () => {
    it('affiche le message de chargement quand loading est true', () => {
      mockStoreState.loading = true
      render(<HealthCheckPanel />)
      expect(screen.getByText('common.loading')).toBeInTheDocument()
    })
  })

  describe('import et export', () => {
    it('affiche les boutons import et export', () => {
      render(<HealthCheckPanel />)
      expect(screen.getByText('healthcheck.importChecks')).toBeInTheDocument()
      expect(screen.getByText('healthcheck.exportChecks')).toBeInTheDocument()
    })
  })
})
