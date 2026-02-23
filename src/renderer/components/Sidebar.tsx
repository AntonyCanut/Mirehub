import { useCallback, useEffect, useState, useRef } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useViewStore } from '../lib/stores/viewStore'
import { useI18n } from '../lib/i18n'
import { WorkspaceItem } from './WorkspaceItem'

export function Sidebar() {
  const { t } = useI18n()
  const { workspaces, projects, activeWorkspaceId, init, createWorkspaceFromFolder, createWorkspaceFromNew, navigateWorkspace } =
    useWorkspaceStore()

  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const createMenuRef = useRef<HTMLDivElement>(null)
  const newProjectInputRef = useRef<HTMLInputElement>(null)

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

  // Close create menu on click outside
  useEffect(() => {
    if (!showCreateMenu) return
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCreateMenu])

  // Focus new project input when modal opens
  useEffect(() => {
    if (showNewProjectModal && newProjectInputRef.current) {
      newProjectInputRef.current.focus()
    }
  }, [showNewProjectModal])

  const handleCreateFromNew = useCallback(async () => {
    const name = newProjectName.trim()
    if (!name) return
    await createWorkspaceFromNew(name)
    setShowNewProjectModal(false)
    setNewProjectName('')
  }, [newProjectName, createWorkspaceFromNew])

  const getProjectsForWorkspace = useCallback(
    (workspaceId: string) => {
      return projects.filter((p) => p.workspaceId === workspaceId)
    },
    [projects],
  )

  const { recentFiles, bookmarks, openFile } = useViewStore()
  const [showRecent, setShowRecent] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>{t('sidebar.title')}</h2>
        <div className="sidebar-create-wrapper" ref={createMenuRef}>
          <button
            className="btn-icon"
            title={t('sidebar.newWorkspace')}
            onClick={() => setShowCreateMenu((prev) => !prev)}
          >
            +
          </button>
          {showCreateMenu && (
            <div className="workspace-add-menu">
              <button
                className="workspace-add-menu-item"
                onClick={() => {
                  setShowCreateMenu(false)
                  createWorkspaceFromFolder()
                }}
              >
                {t('sidebar.fromExisting')}
              </button>
              <button
                className="workspace-add-menu-item"
                onClick={() => {
                  setShowCreateMenu(false)
                  setNewProjectName('')
                  setShowNewProjectModal(true)
                }}
              >
                {t('sidebar.createNew')}
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">{t('sidebar.newWorkspaceProject')}</div>
            <div className="modal-body">
              <p style={{ marginBottom: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                {t('sidebar.chooseNameThenFolder')}
              </p>
              <input
                ref={newProjectInputRef}
                className="workspace-create-project-input"
                type="text"
                placeholder={t('sidebar.projectNamePlaceholder')}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) handleCreateFromNew()
                  if (e.key === 'Escape') setShowNewProjectModal(false)
                }}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-btn modal-btn--secondary" onClick={() => setShowNewProjectModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="modal-btn modal-btn--primary"
                onClick={handleCreateFromNew}
                disabled={!newProjectName.trim()}
              >
                {t('sidebar.chooseLocationAndCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
      {workspaces.length === 0 ? (
        <div className="sidebar-content">
          <p className="sidebar-empty">{t('sidebar.empty')}</p>
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

      {/* Bookmarks section */}
      {bookmarks.length > 0 && (
        <div className="sidebar-section">
          <button className="sidebar-section-header" onClick={() => setShowBookmarks((v) => !v)}>
            <span className={`sidebar-section-chevron${showBookmarks ? ' sidebar-section-chevron--expanded' : ''}`}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sidebar-section-title">{'\u2605'} {t('sidebar.favorites', { count: String(bookmarks.length) })}</span>
          </button>
          {showBookmarks && (
            <div className="sidebar-file-list">
              {bookmarks.map((filePath) => (
                <button
                  key={filePath}
                  className="sidebar-file-item"
                  onClick={() => openFile(filePath)}
                  title={filePath}
                >
                  {filePath.split('/').pop()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent files section */}
      {recentFiles.length > 0 && (
        <div className="sidebar-section">
          <button className="sidebar-section-header" onClick={() => setShowRecent((v) => !v)}>
            <span className={`sidebar-section-chevron${showRecent ? ' sidebar-section-chevron--expanded' : ''}`}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sidebar-section-title">{t('sidebar.recentFiles', { count: String(recentFiles.length) })}</span>
          </button>
          {showRecent && (
            <div className="sidebar-file-list">
              {recentFiles.slice(0, 10).map((filePath) => (
                <button
                  key={filePath}
                  className="sidebar-file-item"
                  onClick={() => openFile(filePath)}
                  title={filePath}
                >
                  {filePath.split('/').pop()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
