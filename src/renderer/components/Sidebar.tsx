import React, { useCallback, useEffect } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { WorkspaceItem } from './WorkspaceItem'

export function Sidebar() {
  const { workspaces, projects, activeWorkspaceId, init, createWorkspaceFromFolder, navigateWorkspace } =
    useWorkspaceStore()

  useEffect(() => {
    init()
  }, [init])

  // Keyboard shortcuts: Cmd+Shift+[ / Cmd+Shift+] to navigate workspaces
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey) {
        if (e.key === '[') {
          e.preventDefault()
          navigateWorkspace('prev')
        } else if (e.key === ']') {
          e.preventDefault()
          navigateWorkspace('next')
        }
      }
      // Cmd+Shift+N for new workspace
      if (e.metaKey && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        createWorkspaceFromFolder()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateWorkspace, createWorkspaceFromFolder])

  const handleCreateStart = useCallback(() => {
    createWorkspaceFromFolder()
  }, [createWorkspaceFromFolder])

  const getProjectsForWorkspace = useCallback(
    (workspaceId: string) => {
      return projects.filter((p) => p.workspaceId === workspaceId)
    },
    [projects],
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Workspaces</h2>
        <button className="btn-icon" title="Nouveau workspace" onClick={handleCreateStart}>
          +
        </button>
      </div>
      {workspaces.length === 0 ? (
        <div className="sidebar-content">
          <p className="sidebar-empty">Aucun workspace. Cliquez sur + pour commencer.</p>
        </div>
      ) : (
        <div className="sidebar-workspaces">
          {workspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              projects={getProjectsForWorkspace(workspace.id)}
              isActive={activeWorkspaceId === workspace.id}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
