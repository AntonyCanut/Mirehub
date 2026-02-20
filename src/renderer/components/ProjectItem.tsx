import React, { useCallback, useEffect, useState } from 'react'
import type { Project } from '../../shared/types/index'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { ContextMenu, ContextMenuItem } from './ContextMenu'
import { useViewStore } from '../lib/stores/viewStore'
import { ClaudeInfoPanel } from './ClaudeInfoPanel'
import { ConfirmModal } from './ConfirmModal'
import { SidebarFileTree } from './SidebarFileTree'

interface ProjectItemProps {
  project: Project
  isActive: boolean
}

export function ProjectItem({ project, isActive }: ProjectItemProps) {
  const { setActiveProject, removeProject, rescanClaude, clearPendingClaudeImport } = useWorkspaceStore()
  const pendingClaudeImport = useWorkspaceStore((s) => s.pendingClaudeImport)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showClaudeInfo, setShowClaudeInfo] = useState(false)
  const [showDeployConfirm, setShowDeployConfirm] = useState(false)
  const [expanded, setExpanded] = useState(isActive)
  const [showImportClaude, setShowImportClaude] = useState(false)

  useEffect(() => {
    if (isActive) {
      setExpanded(true)
    }
  }, [isActive])

  useEffect(() => {
    if (pendingClaudeImport === project.id) {
      setShowImportClaude(true)
      clearPendingClaudeImport()
    }
  }, [pendingClaudeImport, project.id, clearPendingClaudeImport])

  const handleClick = useCallback(() => {
    if (isActive) {
      setExpanded((prev) => !prev)
    } else {
      setActiveProject(project.id)
      setExpanded(true)
      useViewStore.getState().setViewMode('terminal')
    }
  }, [isActive, project.id, setActiveProject])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/theone-project', project.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    [project.id],
  )

  const handleClaudeBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowClaudeInfo((prev) => !prev)
  }, [])

  const handleDeployClaude = useCallback(async () => {
    // Check if .claude already exists
    const hasExisting = await window.theone.project.checkClaude(project.path)
    if (hasExisting) {
      setShowDeployConfirm(true)
    } else {
      // Direct deploy
      const result = await window.theone.project.deployClaude(project.path, false)
      if (result.success) {
        rescanClaude(project.id)
      }
    }
  }, [project.path, project.id, rescanClaude])

  const handleImportClaude = useCallback(async () => {
    const result = await window.theone.project.deployClaude(project.path, false)
    setShowImportClaude(false)
    if (result.success) {
      rescanClaude(project.id)
    }
  }, [project.path, project.id, rescanClaude])

  const handleConfirmDeploy = useCallback(async () => {
    const result = await window.theone.project.deployClaude(project.path, true)
    setShowDeployConfirm(false)
    if (result.success) {
      rescanClaude(project.id)
    }
  }, [project.path, project.id, rescanClaude])

  const folderName = project.path.split('/').pop() ?? project.name

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Déployer .claude',
      action: handleDeployClaude,
    },
    ...(project.hasClaude
      ? [
          {
            label: showClaudeInfo ? 'Masquer config Claude' : 'Voir config Claude',
            action: () => setShowClaudeInfo((prev) => !prev),
          },
        ]
      : []),
    { separator: true, label: '', action: () => {} },
    {
      label: 'Retirer du workspace',
      action: () => removeProject(project.id),
      danger: true,
    },
  ]

  return (
    <div className="project-item-wrapper">
      <button
        className={`project-item${isActive ? ' project-item--active' : ''}${project.hasClaude ? ' project-item--claude' : ''}${project.hasGit ? ' project-item--git' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        title={project.path}
      >
        <span className={`project-item-chevron${expanded ? ' project-item-chevron--expanded' : ''}`}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="project-item-icon">
          {project.hasClaude ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"
                stroke="var(--claude-color)"
                strokeWidth="1.2"
                fill="none"
              />
              <circle cx="8" cy="8" r="2" fill="var(--claude-color)" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4a2 2 0 012-2h3l1 1.5h4a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"
                stroke="var(--text-muted)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          )}
        </span>
        <span className="project-item-name">{folderName}</span>
        {project.hasClaude && (
          <span
            className="project-item-claude-badge"
            onClick={handleClaudeBadgeClick}
            title="Projet claudisé"
          >
            <span className="claude-dot" />
          </span>
        )}
        {!project.hasClaude && (
          <button
            className="project-item-deploy-btn"
            onClick={(e) => { e.stopPropagation(); handleDeployClaude() }}
            title="Déployer .claude sur ce projet"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"
                stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </button>

      {project.hasClaude && showClaudeInfo && (
        <ClaudeInfoPanel
          projectPath={project.path}
          onClose={() => setShowClaudeInfo(false)}
        />
      )}

      {expanded && (
        <div className="project-item-filetree">
          <SidebarFileTree projectPath={project.path} />
        </div>
      )}

      {showDeployConfirm && (
        <ConfirmModal
          title="Déployer .claude"
          message="Ce projet possède déjà un dossier .claude. Continuer va sauvegarder l'existant dans .claude-backup puis le remplacer."
          confirmLabel="Remplacer"
          onConfirm={handleConfirmDeploy}
          onCancel={() => setShowDeployConfirm(false)}
        />
      )}

      {showImportClaude && (
        <ConfirmModal
          title="Importer .claude"
          message={`Le projet "${project.name}" n'a pas de configuration Claude. Voulez-vous déployer .claude sur ce projet ?`}
          confirmLabel="Déployer"
          onConfirm={handleImportClaude}
          onCancel={() => setShowImportClaude(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
