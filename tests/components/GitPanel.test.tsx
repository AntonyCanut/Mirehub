import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock CSS
vi.mock('../../src/renderer/styles/git.css', () => ({}))

// Mock sub-components
vi.mock('../../src/renderer/components/git-panel/git-toolbar', () => ({
  GitToolbar: () => <div data-testid="git-toolbar">toolbar</div>,
}))

vi.mock('../../src/renderer/components/git-panel/git-sidebar', () => ({
  GitSidebar: () => <div data-testid="git-sidebar">sidebar</div>,
}))

vi.mock('../../src/renderer/components/git-panel/git-center-view', () => ({
  GitCenterView: () => <div data-testid="git-center-view">center</div>,
}))

vi.mock('../../src/renderer/components/git-panel/git-changes-panel', () => ({
  GitChangesPanel: () => <div data-testid="git-changes-panel">changes</div>,
}))

vi.mock('../../src/renderer/components/ContextMenu', () => ({
  ContextMenu: () => <div data-testid="context-menu" />,
}))

// Mutable state object returned by useGitPanel
const mockHandleGitInit = vi.fn()
const mockRefresh = vi.fn()
const mockSetViewMode = vi.fn()

let mockState: Record<string, unknown> = {}

vi.mock('../../src/renderer/components/git-panel/use-git-panel', () => ({
  useGitPanel: () => mockState,
}))

vi.mock('../../src/renderer/lib/stores/viewStore', () => ({
  useViewStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { setHighlightedFilePath: vi.fn(), setViewMode: mockSetViewMode }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({ setHighlightedFilePath: vi.fn(), setViewMode: mockSetViewMode }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
}))

import { GitPanel } from '../../src/renderer/components/GitPanel'

function getDefaultMockState(): Record<string, unknown> {
  return {
    t: (key: string) => key,
    activeProject: null,
    status: null,
    log: [],
    branches: [],
    stashes: [],
    tags: [],
    remotes: [],
    loading: false,
    graphData: [],
    graphMaxLane: 0,
    selectedCommit: null,
    commitDetail: null,
    selectedCommitFile: null,
    setSelectedCommitFile: vi.fn(),
    selectedFile: null,
    setSelectedFile: vi.fn(),
    diffContent: '',
    setDiffContent: vi.fn(),
    commitMessage: '',
    setCommitMessage: vi.fn(),
    newBranchName: '',
    setNewBranchName: vi.fn(),
    showNewBranch: false,
    setShowNewBranch: vi.fn(),
    branchCtx: null,
    setBranchCtx: vi.fn(),
    commitCtx: null,
    setCommitCtx: vi.fn(),
    renamingBranch: null,
    setRenamingBranch: vi.fn(),
    renameValue: '',
    setRenameValue: vi.fn(),
    renameInputRef: { current: null },
    showNewTag: false,
    setShowNewTag: vi.fn(),
    newTagName: '',
    setNewTagName: vi.fn(),
    newTagMessage: '',
    setNewTagMessage: vi.fn(),
    showNewRemote: false,
    setShowNewRemote: vi.fn(),
    newRemoteName: '',
    setNewRemoteName: vi.fn(),
    newRemoteUrl: '',
    setNewRemoteUrl: vi.fn(),
    showBranchCompare: false,
    setShowBranchCompare: vi.fn(),
    compareBranch1: '',
    setCompareBranch1: vi.fn(),
    compareBranch2: '',
    setCompareBranch2: vi.fn(),
    branchDiffResult: '',
    setBranchDiffResult: vi.fn(),
    blameFile: null,
    setBlameFile: vi.fn(),
    blameData: [],
    setBlameData: vi.fn(),
    localCollapsed: false,
    setLocalCollapsed: vi.fn(),
    remoteCollapsed: false,
    setRemoteCollapsed: vi.fn(),
    stashCollapsed: false,
    setStashCollapsed: vi.fn(),
    tagsCollapsed: false,
    setTagsCollapsed: vi.fn(),
    remotesCollapsed: false,
    setRemotesCollapsed: vi.fn(),
    setSelectedCommit: vi.fn(),
    setCommitDetail: vi.fn(),
    refresh: mockRefresh,
    handleSelectCommit: vi.fn(),
    handleFileDiff: vi.fn(),
    handleStageFile: vi.fn(),
    handleStageAll: vi.fn(),
    handleUnstageFile: vi.fn(),
    handleUnstageAll: vi.fn(),
    handleDiscardFile: vi.fn(),
    handleCommit: vi.fn(),
    handleCheckout: vi.fn(),
    handleCreateBranch: vi.fn(),
    handleRenameBranch: vi.fn(),
    handlePush: vi.fn(),
    handlePull: vi.fn(),
    handleFetch: vi.fn(),
    handleStash: vi.fn(),
    handleStashPop: vi.fn(),
    handleGitInit: mockHandleGitInit,
    handleUndo: vi.fn(),
    handleSwitchToTerminal: vi.fn(),
    handleCreateTag: vi.fn(),
    handleDeleteTag: vi.fn(),
    handleCherryPick: vi.fn(),
    handleCompareBranches: vi.fn(),
    handleBlame: vi.fn(),
    handleAddRemote: vi.fn(),
    handleRemoveRemote: vi.fn(),
    getBranchContextItems: vi.fn().mockReturnValue([]),
    getCommitContextItems: vi.fn().mockReturnValue([]),
  }
}

describe('GitPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = getDefaultMockState()
  })

  describe('guard: pas de projet', () => {
    it('affiche le message de selection de projet quand pas de projet actif', () => {
      render(<GitPanel />)

      expect(screen.getByText('git.selectProject')).toBeInTheDocument()
      expect(document.querySelector('.git-empty')).toBeInTheDocument()
    })
  })

  describe('guard: pas de repo git', () => {
    it('affiche le chargement quand loading et pas de status', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, loading: true }

      render(<GitPanel />)

      expect(screen.getByText('common.loading')).toBeInTheDocument()
      expect(document.querySelector('.git-empty')).toBeInTheDocument()
    })

    it('affiche le message non-git avec bouton init quand pas de status', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' } }

      render(<GitPanel />)

      expect(screen.getByText('git.notGitRepo')).toBeInTheDocument()
      expect(screen.getByText('git.initGit')).toBeInTheDocument()
    })

    it('appelle handleGitInit au clic sur le bouton init', async () => {
      const user = userEvent.setup()
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' } }

      render(<GitPanel />)

      await user.click(screen.getByText('git.initGit'))

      expect(mockHandleGitInit).toHaveBeenCalledOnce()
    })
  })

  describe('panneau git complet', () => {
    const mockStatus = {
      branch: 'main',
      staged: [{ path: 'file1.ts', status: 'A' }],
      modified: [{ path: 'file2.ts', status: 'M' }],
      untracked: [{ path: 'file3.ts', status: '?' }],
      ahead: 0,
      behind: 0,
    }

    it('affiche le panneau git complet avec status', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, status: mockStatus }

      render(<GitPanel />)

      expect(document.querySelector('.git-panel')).toBeInTheDocument()
    })

    it('affiche la toolbar et le sidebar quand status present', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, status: mockStatus }

      render(<GitPanel />)

      expect(screen.getByTestId('git-toolbar')).toBeInTheDocument()
      expect(screen.getByTestId('git-sidebar')).toBeInTheDocument()
    })

    it('affiche le center view et le changes panel', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, status: mockStatus }

      render(<GitPanel />)

      expect(screen.getByTestId('git-center-view')).toBeInTheDocument()
      expect(screen.getByTestId('git-changes-panel')).toBeInTheDocument()
    })

    it('affiche la barre de statut avec les compteurs', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, status: mockStatus }

      render(<GitPanel />)

      const statusbar = document.querySelector('.git-statusbar')
      expect(statusbar).toBeInTheDocument()
    })

    it('affiche les compteurs corrects dans la statusbar', () => {
      mockState = {
        ...mockState,
        activeProject: { id: 'p1', name: 'Test', path: '/test' },
        status: mockStatus,
        log: [{ hash: 'abc', message: 'init' }, { hash: 'def', message: 'second' }],
        tags: [{ name: 'v1.0', hash: 'abc' }],
      }

      render(<GitPanel />)

      // totalChanges = staged(1) + modified(1) + untracked(1) = 3
      expect(screen.getByText('git.filesChanged')).toBeInTheDocument()
      expect(screen.getByText('git.stagedCount')).toBeInTheDocument()
      expect(screen.getByText('git.untrackedCount')).toBeInTheDocument()
      expect(screen.getByText('git.commitCount')).toBeInTheDocument()
      expect(screen.getByText('git.tagCount')).toBeInTheDocument()
    })

    it('ne rend pas de context menu quand branchCtx et commitCtx sont null', () => {
      mockState = { ...mockState, activeProject: { id: 'p1', name: 'Test', path: '/test' }, status: mockStatus }

      render(<GitPanel />)

      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument()
    })
  })
})
