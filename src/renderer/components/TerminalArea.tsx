import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useTerminalTabStore } from '../lib/stores/terminalTabStore'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { SplitContainer } from './SplitContainer'
import { ProjectToolbar } from './ProjectToolbar'

export function TerminalArea() {
  const {
    tabs: allTabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    renameTab,
    reorderTabs,
    activateNext,
    activatePrev,
    activateByIndex,
    splitPane,
    closePane,
    toggleZoomPane,
    focusDirection,
  } = useTerminalTabStore()

  const { activeWorkspaceId, activeProjectId, projects } = useWorkspaceStore()

  // Filter tabs for the active workspace
  const tabs = useMemo(
    () => allTabs.filter((t) => t.workspaceId === activeWorkspaceId),
    [allTabs, activeWorkspaceId],
  )

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const projectCwd = activeProject?.path || ''

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey

      // Cmd+T: new tab
      if (isMeta && !e.shiftKey && e.key === 't') {
        e.preventDefault()
        if (activeWorkspaceId && projectCwd) {
          createTab(activeWorkspaceId, projectCwd)
        }
        return
      }

      // Cmd+W: close active pane (or tab if only one pane)
      if (isMeta && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          const tab = useTerminalTabStore.getState().tabs.find((t) => t.id === activeTabId)
          if (tab) {
            closePane(activeTabId, tab.activePaneId)
          }
        }
        return
      }

      // Cmd+Shift+[ : previous tab (workspace-scoped)
      if (isMeta && e.shiftKey && e.code === 'BracketLeft') {
        e.preventDefault()
        activatePrev(activeWorkspaceId ?? undefined)
        return
      }

      // Cmd+Shift+] : next tab (workspace-scoped)
      if (isMeta && e.shiftKey && e.code === 'BracketRight') {
        e.preventDefault()
        activateNext(activeWorkspaceId ?? undefined)
        return
      }

      // Cmd+1-9: switch to tab by index (workspace-scoped)
      if (isMeta && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key, 10) - 1
        activateByIndex(index, activeWorkspaceId ?? undefined)
        return
      }

      // Cmd+D: split horizontal
      if (isMeta && !e.shiftKey && e.key === 'd') {
        e.preventDefault()
        if (activeTabId) {
          const tab = useTerminalTabStore.getState().tabs.find((t) => t.id === activeTabId)
          if (tab) {
            splitPane(activeTabId, tab.activePaneId, 'horizontal')
          }
        }
        return
      }

      // Cmd+Shift+D: split vertical
      if (isMeta && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        if (activeTabId) {
          const tab = useTerminalTabStore.getState().tabs.find((t) => t.id === activeTabId)
          if (tab) {
            splitPane(activeTabId, tab.activePaneId, 'vertical')
          }
        }
        return
      }

      // Cmd+Shift+Enter: toggle zoom pane
      if (isMeta && e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        if (activeTabId) {
          const tab = useTerminalTabStore.getState().tabs.find((t) => t.id === activeTabId)
          if (tab) {
            toggleZoomPane(activeTabId, tab.activePaneId)
          }
        }
        return
      }

      // Cmd+Alt+Arrow: navigate between panes
      if (isMeta && e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        if (activeTabId) {
          const dirMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
            ArrowLeft: 'left',
            ArrowRight: 'right',
            ArrowUp: 'up',
            ArrowDown: 'down',
          }
          focusDirection(activeTabId, dirMap[e.key]!)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeTabId,
    activeWorkspaceId,
    projectCwd,
    createTab,
    closePane,
    activateNext,
    activatePrev,
    activateByIndex,
    splitPane,
    toggleZoomPane,
    focusDirection,
  ])

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTabId])

  const handleDoubleClick = useCallback(
    (tabId: string, currentLabel: string) => {
      setEditingTabId(tabId)
      setEditingLabel(currentLabel)
    },
    [],
  )

  const commitRename = useCallback(() => {
    if (editingTabId) {
      const trimmed = editingLabel.trim()
      if (trimmed) {
        renameTab(editingTabId, trimmed)
      }
      setEditingTabId(null)
      setEditingLabel('')
    }
  }, [editingTabId, editingLabel, renameTab])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitRename()
      } else if (e.key === 'Escape') {
        setEditingTabId(null)
        setEditingLabel('')
      }
    },
    [commitRename],
  )

  // Drag & drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '0.5'
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
    dragIndexRef.current = null
    setDragOverIndex(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault()
      const fromIndex = dragIndexRef.current
      if (fromIndex !== null && fromIndex !== toIndex) {
        reorderTabs(fromIndex, toIndex)
      }
      dragIndexRef.current = null
      setDragOverIndex(null)
    },
    [reorderTabs],
  )

  const handleTabClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation()
      closeTab(tabId)
    },
    [closeTab],
  )

  const handleNewTab = useCallback(() => {
    if (activeWorkspaceId && projectCwd) {
      createTab(activeWorkspaceId, projectCwd)
    }
  }, [activeWorkspaceId, projectCwd, createTab])

  if (!activeWorkspaceId) {
    return (
      <main className="terminal-area">
        <div className="terminal-content">
          <div className="terminal-empty">
            <p>Aucun workspace sélectionné</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Sélectionnez ou créez un workspace pour ouvrir un terminal.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="terminal-area">
      <div className="terminal-tabs">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${
              dragOverIndex === index ? 'tab-drag-over' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id, tab.label)}
            draggable={editingTabId !== tab.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
          >
            {tab.color && (
              <span className="tab-color-dot" style={{ background: tab.color }} />
            )}
            {tab.hasActivity && tab.id !== activeTabId && (
              <span className="tab-activity-dot" />
            )}
            {editingTabId === tab.id ? (
              <input
                ref={editInputRef}
                className="tab-rename-input"
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tab-label">{tab.label}</span>
            )}
            <button
              className="tab-close"
              title="Fermer"
              onClick={(e) => handleTabClose(e, tab.id)}
            >
              x
            </button>
          </div>
        ))}
        <button className="btn-icon tab-add" title="Nouveau terminal (Cmd+T)" onClick={handleNewTab}>
          +
        </button>
      </div>
      <ProjectToolbar />
      <div className="terminal-content">
        {allTabs.map((tab) => (
          <div
            key={tab.id}
            className="terminal-tab-content"
            style={{
              display:
                tab.workspaceId === activeWorkspaceId && tab.id === activeTabId
                  ? 'flex'
                  : 'none',
            }}
          >
            <SplitContainer tabId={tab.id} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="terminal-empty">
            <p>Aucun terminal ouvert</p>
            <button className="terminal-empty-btn" onClick={handleNewTab}>
              Nouveau terminal (Cmd+T)
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
