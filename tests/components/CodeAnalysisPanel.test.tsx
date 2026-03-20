import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock CSS
vi.mock('../../src/renderer/styles/analysis.css', () => ({}))

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

// Mock sub-components
vi.mock('../../src/renderer/components/code-analysis/analysis-sidebar', () => ({
  AnalysisSidebar: ({ t, relevantTools, runAll, isAnyRunning }: Record<string, unknown>) => (
    <div data-testid="analysis-sidebar">
      <span>{(t as (k: string) => string)('analysis.sidebar')}</span>
      {Array.isArray(relevantTools) && relevantTools.map((tool: { id: string; name: string }) => (
        <div key={tool.id} data-testid={`tool-${tool.id}`}>{tool.name}</div>
      ))}
      <button onClick={runAll as () => void} disabled={isAnyRunning as boolean}>
        {(t as (k: string) => string)('analysis.runAll')}
      </button>
    </div>
  ),
}))

vi.mock('../../src/renderer/components/code-analysis/analysis-findings-list', () => ({
  AnalysisFindingsList: ({ t, filteredFindings, severityFilter }: Record<string, unknown>) => (
    <div data-testid="analysis-findings-list">
      <span>severity: {severityFilter as string}</span>
      {Array.isArray(filteredFindings) && filteredFindings.map((f: { id: string; message: string; severity: string }) => (
        <div key={f.id} data-testid={`finding-${f.id}`}>
          <span className="finding-severity">{f.severity}</span>
          <span className="finding-message">{f.message}</span>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../src/renderer/components/code-analysis/analysis-install-buffer', () => ({
  AnalysisInstallBuffer: () => <div data-testid="analysis-install-buffer" />,
}))

vi.mock('../../src/renderer/components/code-analysis/analysis-ticket-modal', () => ({
  AnalysisTicketModal: () => <div data-testid="analysis-ticket-modal" />,
}))

// Mock useCodeAnalysis hook
const mockDetectTools = vi.fn()
const mockRunAll = vi.fn()
const mockSetSeverityFilter = vi.fn()

const defaultHookState = {
  t: (key: string, params?: Record<string, string>) => {
    if (params) return `${key}:${JSON.stringify(params)}`
    return key
  },
  activeProject: { id: 'proj-1', name: 'My Project', path: '/my-project', workspaceId: 'ws-1' },
  tools: [
    { id: 'eslint', name: 'ESLint', languages: ['javascript', 'typescript'], installed: true },
    { id: 'ruff', name: 'Ruff', languages: ['python'], installed: false },
  ],
  relevantTools: [
    { id: 'eslint', name: 'ESLint', languages: ['javascript', 'typescript'], installed: true },
  ],
  reports: [],
  activeReportId: null,
  setActiveReportId: vi.fn(),
  activeReport: null,
  aggregatedReport: null,
  reportsByTool: {},
  runningTools: new Set<string>(),
  isAnyRunning: false,
  runningToolName: null,
  installingTools: new Set<string>(),
  installedCount: 1,
  detectingTools: false,
  detectTools: mockDetectTools,
  runTool: vi.fn(),
  cancelTool: vi.fn(),
  runAll: mockRunAll,
  installTool: vi.fn(),
  severityFilter: 'all' as const,
  setSeverityFilter: mockSetSeverityFilter,
  filteredFindings: [],
  grouped: {},
  collapsedGroups: new Set<string>(),
  toggleGroup: vi.fn(),
  selectedFinding: null,
  handleClickFinding: vi.fn(),
  handleNavigateToFile: vi.fn(),
  selectedFindings: new Set<string>(),
  toggleFinding: vi.fn(),
  selectAll: vi.fn(),
  deselectAll: vi.fn(),
  showTicketModal: false,
  setShowTicketModal: vi.fn(),
  ticketGroupBy: 'individual' as const,
  setTicketGroupBy: vi.fn(),
  ticketPriority: 'medium' as const,
  setTicketPriority: vi.fn(),
  ticketPreviewCount: 0,
  handleCreateTickets: vi.fn(),
  toastMessage: null,
  copiedError: false,
  copyError: vi.fn(),
  projectGrade: null,
  activeInstallTool: null,
  installOutput: {},
  copiedInstallOutput: false,
  copyInstallOutput: vi.fn(),
  setActiveInstallTool: vi.fn(),
  installBufferRef: { current: null },
  reanalyze: vi.fn(),
  deleteReport: vi.fn(),
}

let hookState = { ...defaultHookState }

vi.mock('../../src/renderer/components/code-analysis/use-code-analysis', () => ({
  useCodeAnalysis: () => hookState,
}))

import { CodeAnalysisPanel } from '../../src/renderer/components/CodeAnalysisPanel'

describe('CodeAnalysisPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState = { ...defaultHookState }
  })

  describe('rendu initial', () => {
    it('affiche le titre de l analyse', () => {
      render(<CodeAnalysisPanel />)
      expect(screen.getByText('analysis.title')).toBeInTheDocument()
    })

    it('affiche le bouton de rafraichissement des outils', () => {
      render(<CodeAnalysisPanel />)
      expect(screen.getByTitle('common.refresh')).toBeInTheDocument()
    })

    it('affiche le message quand aucun projet n est actif', () => {
      hookState = { ...defaultHookState, activeProject: null }
      render(<CodeAnalysisPanel />)
      expect(screen.getByText('analysis.noProject')).toBeInTheDocument()
    })
  })

  describe('affichage des outils', () => {
    it('affiche la sidebar avec les outils pertinents', () => {
      render(<CodeAnalysisPanel />)
      expect(screen.getByTestId('analysis-sidebar')).toBeInTheDocument()
      expect(screen.getByTestId('tool-eslint')).toBeInTheDocument()
    })

    it('affiche l etat vide quand il n y a pas de rapports', () => {
      render(<CodeAnalysisPanel />)
      expect(screen.getByText('analysis.emptyTitle')).toBeInTheDocument()
      expect(screen.getByText('analysis.emptyHint')).toBeInTheDocument()
    })

    it('affiche le bouton lancer l analyse quand des outils sont installes', () => {
      render(<CodeAnalysisPanel />)
      expect(screen.getByText(/analysis.launchAnalysis/)).toBeInTheDocument()
    })
  })

  describe('rendu des findings', () => {
    it('affiche la liste des findings quand un rapport est actif', () => {
      hookState = {
        ...defaultHookState,
        activeReport: {
          id: 'report-1',
          toolId: 'eslint',
          toolName: 'ESLint',
          timestamp: Date.now(),
          findings: [
            { id: 'f-1', message: 'Unused variable', severity: 'warning', file: 'src/index.ts', line: 10, rule: 'no-unused-vars' },
          ],
          summary: { total: 1, error: 0, warning: 1, info: 0, hint: 0 },
        },
        filteredFindings: [
          { id: 'f-1', message: 'Unused variable', severity: 'warning', file: 'src/index.ts', line: 10, rule: 'no-unused-vars' },
        ],
        reports: [{ id: 'report-1' }],
        activeReportId: 'report-1',
      }
      render(<CodeAnalysisPanel />)
      expect(screen.getByTestId('analysis-findings-list')).toBeInTheDocument()
    })

    it('affiche le nombre de findings dans le header', () => {
      hookState = {
        ...defaultHookState,
        activeReport: {
          id: 'report-1',
          toolId: 'eslint',
          toolName: 'ESLint',
          timestamp: Date.now(),
          findings: [],
          summary: { total: 5, error: 2, warning: 3, info: 0, hint: 0 },
        },
        reports: [{ id: 'report-1' }],
        activeReportId: 'report-1',
      }
      render(<CodeAnalysisPanel />)
      expect(screen.getByText(/5.*analysis.findings/)).toBeInTheDocument()
    })
  })

  describe('filtrage par severite', () => {
    it('passe le filtre de severite a la liste des findings', () => {
      hookState = {
        ...defaultHookState,
        severityFilter: 'error',
        activeReport: {
          id: 'report-1',
          toolId: 'eslint',
          toolName: 'ESLint',
          timestamp: Date.now(),
          findings: [],
          summary: { total: 0, error: 0, warning: 0, info: 0, hint: 0 },
        },
        filteredFindings: [],
        reports: [{ id: 'report-1' }],
        activeReportId: 'report-1',
      }
      render(<CodeAnalysisPanel />)
      expect(screen.getByText('severity: error')).toBeInTheDocument()
    })
  })

  describe('etat vide', () => {
    it('affiche l indicateur d execution quand un outil tourne', () => {
      hookState = {
        ...defaultHookState,
        isAnyRunning: true,
        runningToolName: 'ESLint',
      }
      render(<CodeAnalysisPanel />)
      expect(screen.getByText(/analysis.runningTool/)).toBeInTheDocument()
    })

    it('cache le bouton lancer quand aucun outil n est installe', () => {
      hookState = { ...defaultHookState, installedCount: 0 }
      render(<CodeAnalysisPanel />)
      expect(screen.queryByText(/analysis.launchAnalysis/)).not.toBeInTheDocument()
    })
  })

  describe('detection des outils', () => {
    it('appelle detectTools au clic sur le bouton refresh', async () => {
      const user = userEvent.setup()
      render(<CodeAnalysisPanel />)

      await user.click(screen.getByTitle('common.refresh'))

      expect(mockDetectTools).toHaveBeenCalled()
    })
  })

  describe('grade du projet', () => {
    it('affiche le badge de grade quand il est disponible', () => {
      hookState = { ...defaultHookState, projectGrade: 'A' }
      render(<CodeAnalysisPanel />)
      expect(screen.getByText('A')).toBeInTheDocument()
    })
  })
})
