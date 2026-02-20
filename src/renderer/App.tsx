import { useState, useEffect, useCallback } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/Sidebar'
import { TerminalArea } from './components/TerminalArea'
import { TitleBar } from './components/TitleBar'
import { KanbanBoard } from './components/KanbanBoard'
import { GitPanel } from './components/GitPanel'
import { FileViewer } from './components/FileViewer'
import { NpmPanel } from './components/NpmPanel'
import { FileDiffViewer } from './components/FileDiffViewer'
import { ClaudeRulesPanel } from './components/ClaudeRulesPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { SessionModal } from './components/SessionModal'
import { useWorkspaceStore } from './lib/stores/workspaceStore'
import { useTerminalTabStore } from './lib/stores/terminalTabStore'
import { useViewStore } from './lib/stores/viewStore'
import type { SessionData, SessionTab } from '../shared/types'

export function App() {
  const { viewMode, setViewMode, availableMagicTabs, setAvailableMagicTabs } = useViewStore()
  const { activeProjectId, projects } = useWorkspaceStore()
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  // Detect available magic tabs based on active project
  const activeProject = projects.find((p) => p.id === activeProjectId)
  useEffect(() => {
    if (!activeProject) {
      setAvailableMagicTabs([])
      return
    }
    // Check for package.json to enable NPM tab
    window.theone.fs.readFile(activeProject.path + '/package.json').then((result) => {
      if (result.content !== null) {
        setAvailableMagicTabs(['npm'])
      } else {
        setAvailableMagicTabs([])
      }
    })
  }, [activeProject, setAvailableMagicTabs])

  // Check for saved session on startup
  useEffect(() => {
    window.theone.session.load().then((session) => {
      if (session && session.tabs.length > 0) {
        setPendingSession(session)
      }
      setSessionChecked(true)
    })
  }, [])

  // Save session on before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { activeWorkspaceId, activeProjectId } = useWorkspaceStore.getState()
      const { tabs } = useTerminalTabStore.getState()

      const sessionTabs: SessionTab[] = tabs.map((tab) => ({
        workspaceId: tab.workspaceId,
        cwd: tab.cwd,
        label: tab.label,
        isSplit: tab.paneTree.type === 'split',
        leftCommand: tab.paneTree.type === 'split'
          ? (tab.paneTree.children[0].type === 'leaf' ? tab.paneTree.children[0].initialCommand : null)
          : (tab.paneTree.type === 'leaf' ? tab.paneTree.initialCommand : null),
        rightCommand: tab.paneTree.type === 'split'
          ? (tab.paneTree.children[1].type === 'leaf' ? tab.paneTree.children[1].initialCommand : null)
          : null,
      }))

      if (sessionTabs.length > 0) {
        const session: SessionData = {
          activeWorkspaceId,
          activeProjectId,
          tabs: sessionTabs,
          savedAt: Date.now(),
        }
        // Use sendBeacon-style sync save via IPC
        window.theone.session.save(session)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const handleResume = useCallback(() => {
    if (!pendingSession) return

    const { setActiveWorkspace, setActiveProject } = useWorkspaceStore.getState()
    const termStore = useTerminalTabStore.getState()

    // Restore tabs
    for (const tab of pendingSession.tabs) {
      if (tab.isSplit) {
        termStore.createSplitTab(tab.workspaceId, tab.cwd, tab.label, tab.leftCommand, tab.rightCommand)
      } else {
        termStore.createTab(tab.workspaceId, tab.cwd, tab.label, tab.leftCommand ?? undefined)
      }
    }

    // Restore active workspace/project
    if (pendingSession.activeWorkspaceId) {
      setActiveWorkspace(pendingSession.activeWorkspaceId)
    }
    if (pendingSession.activeProjectId) {
      setActiveProject(pendingSession.activeProjectId)
    }

    window.theone.session.clear()
    setPendingSession(null)
  }, [pendingSession])

  const handleClear = useCallback(() => {
    window.theone.session.clear()
    setPendingSession(null)
  }, [])

  const handleDismiss = useCallback(() => {
    // Keep session on disk for next time, just close the modal
    setPendingSession(null)
  }, [])

  return (
    <ErrorBoundary>
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <div className="sidebar-wrapper">
          <ErrorBoundary>
            <Sidebar />
          </ErrorBoundary>
        </div>
        <div className="main-content">
          <div className="view-switcher">
            <button
              className={`view-btn${viewMode === 'terminal' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('terminal')}
            >
              Terminal
            </button>
            <button
              className={`view-btn${viewMode === 'git' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('git')}
            >
              Git
            </button>
            <button
              className={`view-btn${viewMode === 'kanban' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </button>
            {availableMagicTabs.includes('npm') && (
              <button
                className={`view-btn${viewMode === 'npm' ? ' view-btn--active' : ''}`}
                onClick={() => setViewMode('npm')}
              >
                NPM
              </button>
            )}
            {activeProject?.hasClaude && (
              <button
                className={`view-btn${viewMode === 'claude' ? ' view-btn--active' : ''}`}
                onClick={() => setViewMode('claude')}
              >
                Claude
              </button>
            )}
            {viewMode === 'file' && (
              <button className="view-btn view-btn--active">
                Fichier
              </button>
            )}
            {viewMode === 'diff' && (
              <button className="view-btn view-btn--active">
                Diff
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              className={`view-btn view-btn--settings${viewMode === 'settings' ? ' view-btn--active' : ''}`}
              onClick={() => setViewMode('settings')}
              title="Preferences"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M13.5 8c0-.3-.2-.6-.4-.8l1-1.7-.9-.9-1.7 1c-.2-.2-.5-.4-.8-.4l-.5-1.8h-1.4l-.5 1.8c-.3 0-.6.2-.8.4l-1.7-1-.9.9 1 1.7c-.2.2-.4.5-.4.8l-1.8.5v1.4l1.8.5c0 .3.2.6.4.8l-1 1.7.9.9 1.7-1c.2.2.5.4.8.4l.5 1.8h1.4l.5-1.8c.3 0 .6-.2.8-.4l1.7 1 .9-.9-1-1.7c.2-.2.4-.5.4-.8l1.8-.5v-1.4l-1.8-.5z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
          <div className="view-content">
            <div className="view-panel" style={{ display: viewMode === 'terminal' ? 'flex' : 'none' }}>
              <TerminalArea />
            </div>
            <div className="view-panel" style={{ display: viewMode === 'git' ? 'flex' : 'none' }}>
              <GitPanel />
            </div>
            <div className="view-panel" style={{ display: viewMode === 'kanban' ? 'flex' : 'none' }}>
              <KanbanBoard />
            </div>
            {viewMode === 'npm' && (
              <div className="view-panel" style={{ display: 'flex' }}>
                <NpmPanel />
              </div>
            )}
            {viewMode === 'file' && (
              <div className="view-panel" style={{ display: 'flex' }}>
                <FileViewer />
              </div>
            )}
            {viewMode === 'diff' && (
              <div className="view-panel" style={{ display: 'flex' }}>
                <FileDiffViewer />
              </div>
            )}
            {viewMode === 'claude' && (
              <div className="view-panel" style={{ display: 'flex' }}>
                <ClaudeRulesPanel />
              </div>
            )}
            {viewMode === 'settings' && (
              <div className="view-panel" style={{ display: 'flex' }}>
                <SettingsPanel />
              </div>
            )}
          </div>
        </div>
      </div>
      {sessionChecked && pendingSession && (
        <SessionModal
          session={pendingSession}
          onResume={handleResume}
          onClear={handleClear}
          onDismiss={handleDismiss}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
