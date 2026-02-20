import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { Workspace, Project } from '../../shared/types/index'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { ProjectItem } from './ProjectItem'
import { ContextMenu, ContextMenuItem } from './ContextMenu'
import { useViewStore } from '../lib/stores/viewStore'

interface WorkspaceItemProps {
  workspace: Workspace
  projects: Project[]
  isActive: boolean
}

const WORKSPACE_COLORS = [
  '#89b4fa', // blue
  '#a6e3a1', // green
  '#f38ba8', // red
  '#fab387', // peach
  '#cba6f7', // mauve
  '#f9e2af', // yellow
  '#94e2d5', // teal
  '#f5c2e7', // pink
]

const WORKSPACE_ICONS = [
  { icon: '\u25CF', label: 'Cercle' },       // filled circle
  { icon: '\u2605', label: 'Etoile' },       // star
  { icon: '\u2665', label: 'Coeur' },        // heart
  { icon: '\u26A1', label: 'Eclair' },       // lightning
  { icon: '\u2699', label: 'Engrenage' },    // gear
  { icon: '\u2702', label: 'Ciseaux' },      // scissors
  { icon: '\u270E', label: 'Crayon' },       // pencil
  { icon: '\u2764', label: 'Code' },         // code bracket
]

export function WorkspaceItem({ workspace, projects, isActive }: WorkspaceItemProps) {
  const [expanded, setExpanded] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(workspace.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const {
    setActiveWorkspace,
    activeProjectId,
    deleteWorkspace,
    updateWorkspace,
    addProject,
    moveProject,
  } = useWorkspaceStore()

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handleClick = useCallback(() => {
    setActiveWorkspace(workspace.id)
    useViewStore.getState().setViewMode('terminal')
  }, [workspace.id, setActiveWorkspace])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleStartRename = useCallback(() => {
    setIsRenaming(true)
    setRenameValue(workspace.name)
  }, [workspace.name])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== workspace.name) {
      updateWorkspace(workspace.id, { name: trimmed })
    }
    setIsRenaming(false)
  }, [renameValue, workspace.id, workspace.name, updateWorkspace])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameSubmit()
      } else if (e.key === 'Escape') {
        setIsRenaming(false)
      }
    },
    [handleRenameSubmit],
  )

  const handleAddProject = useCallback(() => {
    addProject(workspace.id)
  }, [workspace.id, addProject])

  const handleColorChange = useCallback(
    (color: string) => {
      updateWorkspace(workspace.id, { color })
      setShowColorPicker(false)
    },
    [workspace.id, updateWorkspace],
  )

  const handleIconChange = useCallback(
    (icon: string) => {
      updateWorkspace(workspace.id, { icon })
      setShowIconPicker(false)
    },
    [workspace.id, updateWorkspace],
  )

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/theone-project')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const projectId = e.dataTransfer.getData('application/theone-project')
      if (projectId) {
        moveProject(projectId, workspace.id)
      }
    },
    [workspace.id, moveProject],
  )

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Renommer', action: handleStartRename },
    { label: 'Changer la couleur', action: () => { setShowColorPicker(true); setShowIconPicker(false) } },
    { label: 'Changer l\'icone', action: () => { setShowIconPicker(true); setShowColorPicker(false) } },
    { separator: true, label: '', action: () => {} },
    { label: 'Ajouter un projet', action: handleAddProject },
    { separator: true, label: '', action: () => {} },
    { label: 'Supprimer', action: () => deleteWorkspace(workspace.id), danger: true },
  ]

  return (
    <div
      className={`workspace-item${isActive ? ' workspace-item--active' : ''}${isDragOver ? ' workspace-item--dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="workspace-item-header" onClick={handleClick} onDoubleClick={handleStartRename} onContextMenu={handleContextMenu}>
        <button
          className={`workspace-item-chevron${expanded ? ' workspace-item-chevron--expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {workspace.icon ? (
          <span className="workspace-item-icon-badge" style={{ color: workspace.color }}>
            {workspace.icon}
          </span>
        ) : (
          <span
            className="workspace-item-color"
            style={{ backgroundColor: workspace.color }}
          />
        )}

        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="workspace-item-rename"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="workspace-item-name">{workspace.name}</span>
        )}

        <button
          className="workspace-item-add btn-icon"
          onClick={(e) => {
            e.stopPropagation()
            handleAddProject()
          }}
          title="Ajouter un projet"
        >
          +
        </button>
      </div>

      {showColorPicker && (
        <div className="workspace-picker">
          {WORKSPACE_COLORS.map((color) => (
            <button
              key={color}
              className={`workspace-color-swatch${color === workspace.color ? ' workspace-color-swatch--active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>
      )}

      {showIconPicker && (
        <div className="workspace-picker">
          <button
            className={`workspace-icon-swatch${!workspace.icon ? ' workspace-icon-swatch--active' : ''}`}
            onClick={() => handleIconChange('')}
            title="Aucune icone"
          >
            <span className="workspace-item-color" style={{ backgroundColor: workspace.color, width: 10, height: 10 }} />
          </button>
          {WORKSPACE_ICONS.map(({ icon, label }) => (
            <button
              key={icon}
              className={`workspace-icon-swatch${workspace.icon === icon ? ' workspace-icon-swatch--active' : ''}`}
              onClick={() => handleIconChange(icon)}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      <div
        className={`workspace-item-projects${expanded ? ' workspace-item-projects--expanded' : ''}`}
      >
        {projects.length === 0 ? (
          <div className="workspace-item-empty">
            <button className="workspace-item-empty-btn" onClick={handleAddProject}>
              + Ajouter un projet
            </button>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={activeProjectId === project.id}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  )
}
