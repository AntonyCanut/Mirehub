import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useKanbanStore } from '../lib/stores/kanbanStore'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import type { KanbanStatus, KanbanTask } from '../../shared/types/index'
import '../styles/kanban.css'

const COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: 'TODO', label: 'A faire', color: '#89b4fa' },
  { status: 'WORKING', label: 'En cours', color: '#fab387' },
  { status: 'PENDING', label: 'En attente', color: '#f9e2af' },
  { status: 'DONE', label: 'Termine', color: '#a6e3a1' },
  { status: 'FAILED', label: 'Echoue', color: '#f38ba8' },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export function KanbanBoard() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const { tasks, loadTasks, createTask, updateTaskStatus, updateTask, deleteTask, draggedTaskId, setDragged } =
    useKanbanStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<(typeof PRIORITIES)[number]>('medium')
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  useEffect(() => {
    if (activeProjectId && activeProject) {
      loadTasks(activeProjectId, activeProject.path)
    }
  }, [activeProjectId, activeProject?.path, loadTasks])

  // Sync selectedTask with store
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
      else setSelectedTask(null)
    }
  }, [tasks, selectedTask?.id])

  const handleCreate = useCallback(async () => {
    if (!activeProjectId || !activeProject || !newTitle.trim()) return
    await createTask(activeProjectId, activeProject.path, newTitle.trim(), newDesc.trim(), newPriority)
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setShowCreateForm(false)
  }, [activeProjectId, newTitle, newDesc, newPriority, createTask])

  const handleDragStart = useCallback(
    (taskId: string) => {
      setDragged(taskId)
    },
    [setDragged],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (status: KanbanStatus) => {
      if (draggedTaskId) {
        updateTaskStatus(draggedTaskId, status)
        setDragged(null)
      }
    },
    [draggedTaskId, updateTaskStatus, setDragged],
  )

  if (!activeProjectId) {
    return (
      <div className="kanban-empty">
        Selectionnez un projet pour voir le Kanban.
      </div>
    )
  }

  const getTasksByStatus = (status: KanbanStatus): KanbanTask[] =>
    tasks.filter((t) => t.status === status)

  return (
    <div className="kanban">
      <div className="kanban-header">
        <h2>Kanban</h2>
        <div className="kanban-header-actions">
          <span className="kanban-task-count">{tasks.length} taches</span>
          <button className="kanban-add-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
            + Nouvelle tache
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="kanban-create-form">
          <input
            className="kanban-input"
            placeholder="Titre de la tache..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <textarea
            className="kanban-textarea"
            placeholder="Description..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
          />
          <div className="kanban-create-row">
            <select
              className="kanban-select"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
              <option value="critical">Critique</option>
            </select>
            <button className="kanban-submit-btn" onClick={handleCreate}>
              Creer
            </button>
          </div>
        </div>
      )}

      <div className="kanban-main">
        <div className="kanban-columns">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="kanban-column-header" style={{ borderColor: col.color }}>
                <span className="kanban-column-dot" style={{ backgroundColor: col.color }} />
                <span className="kanban-column-title">{col.label}</span>
                <span className="kanban-column-count">{getTasksByStatus(col.status).length}</span>
              </div>
              <div className="kanban-column-body">
                {getTasksByStatus(col.status).map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTask?.id === task.id}
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => setSelectedTask(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(data) => updateTask(selectedTask.id, data)}
            onDelete={() => { deleteTask(selectedTask.id); setSelectedTask(null) }}
            onStatusChange={(status) => updateTaskStatus(selectedTask.id, status)}
          />
        )}
      </div>
    </div>
  )
}

// --- Card ---

function KanbanCard({
  task,
  isSelected,
  onDragStart,
  onClick,
  onDelete,
}: {
  task: KanbanTask
  isSelected: boolean
  onDragStart: () => void
  onClick: () => void
  onDelete: () => void
}) {
  const priorityColors: Record<string, string> = {
    low: '#6c7086',
    medium: '#89b4fa',
    high: '#fab387',
    critical: '#f38ba8',
  }

  const isWorking = task.status === 'WORKING'

  return (
    <div
      className={`kanban-card${isSelected ? ' kanban-card--selected' : ''}${isWorking ? ' kanban-card--working' : ''}`}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
    >
      <div className="kanban-card-header">
        <span
          className="kanban-card-priority"
          style={{ backgroundColor: priorityColors[task.priority] }}
        />
        <span className="kanban-card-title">{task.title}</span>
        <button
          className="kanban-card-delete"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Supprimer"
        >
          &times;
        </button>
      </div>
      {task.description && (
        <p className="kanban-card-desc">{task.description}</p>
      )}
      <div className="kanban-card-footer">
        {isWorking && task.agentId && (
          <span className="kanban-card-ai-badge">
            <span className="kanban-card-ai-dot" />
            IA en cours
          </span>
        )}
        {task.result && (
          <span className="kanban-card-result-badge">Resultat disponible</span>
        )}
        {task.question && (
          <span className="kanban-card-question-badge">Question en attente</span>
        )}
      </div>
    </div>
  )
}

// --- Task Detail Panel ---

function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  onStatusChange,
}: {
  task: KanbanTask
  onClose: () => void
  onUpdate: (data: Partial<KanbanTask>) => void
  onDelete: () => void
  onStatusChange: (status: KanbanStatus) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(task.description)
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTitleValue(task.title)
    setDescValue(task.description)
  }, [task.id, task.title, task.description])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (editingDesc && descRef.current) {
      descRef.current.focus()
    }
  }, [editingDesc])

  const saveTitle = useCallback(() => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed })
    }
    setEditingTitle(false)
  }, [titleValue, task.title, onUpdate])

  const saveDesc = useCallback(() => {
    if (descValue !== task.description) {
      onUpdate({ description: descValue })
    }
    setEditingDesc(false)
  }, [descValue, task.description, onUpdate])

  const priorityColors: Record<string, string> = {
    low: '#6c7086',
    medium: '#89b4fa',
    high: '#fab387',
    critical: '#f38ba8',
  }

  const priorityLabels: Record<string, string> = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute',
    critical: 'Critique',
  }

  const statusColumn = COLUMNS.find((c) => c.status === task.status)

  return (
    <div className="kanban-detail">
      <div className="kanban-detail-header">
        <span className="kanban-detail-id">#{task.id.slice(0, 8)}</span>
        <button className="kanban-detail-close" onClick={onClose}>&times;</button>
      </div>

      {/* Title */}
      <div className="kanban-detail-section">
        {editingTitle ? (
          <input
            ref={titleRef}
            className="kanban-detail-title-input"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
          />
        ) : (
          <h3
            className="kanban-detail-title"
            onDoubleClick={() => setEditingTitle(true)}
          >
            {task.title}
          </h3>
        )}
      </div>

      {/* Status & Priority */}
      <div className="kanban-detail-meta">
        <div className="kanban-detail-meta-item">
          <span className="kanban-detail-meta-label">Statut</span>
          <select
            className="kanban-detail-select"
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as KanbanStatus)}
            style={{ borderColor: statusColumn?.color }}
          >
            {COLUMNS.map((col) => (
              <option key={col.status} value={col.status}>{col.label}</option>
            ))}
          </select>
        </div>
        <div className="kanban-detail-meta-item">
          <span className="kanban-detail-meta-label">Priorite</span>
          <select
            className="kanban-detail-select"
            value={task.priority}
            onChange={(e) => onUpdate({ priority: e.target.value as KanbanTask['priority'] })}
            style={{ borderColor: priorityColors[task.priority] }}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{priorityLabels[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="kanban-detail-section">
        <span className="kanban-detail-section-title">Description</span>
        {editingDesc ? (
          <textarea
            ref={descRef}
            className="kanban-detail-desc-edit"
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={saveDesc}
            rows={4}
          />
        ) : (
          <div
            className="kanban-detail-desc"
            onDoubleClick={() => setEditingDesc(true)}
          >
            {task.description || 'Aucune description. Double-cliquez pour ajouter.'}
          </div>
        )}
      </div>

      {/* AI Agent info */}
      {task.agentId && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">Agent IA</span>
          <div className="kanban-detail-agent">
            <span className={`kanban-detail-agent-status${task.status === 'WORKING' ? ' kanban-detail-agent-status--active' : ''}`}>
              {task.status === 'WORKING' ? 'En cours de traitement' : 'Termine'}
            </span>
            <span className="kanban-detail-agent-id">{task.agentId}</span>
          </div>
        </div>
      )}

      {/* Question */}
      {task.question && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">Question de l'IA</span>
          <div className="kanban-detail-question">{task.question}</div>
        </div>
      )}

      {/* Result */}
      {task.result && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">Resultat</span>
          <div className="kanban-detail-result">{task.result}</div>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">Erreur</span>
          <div className="kanban-detail-error">{task.error}</div>
        </div>
      )}

      {/* Timestamps */}
      <div className="kanban-detail-timestamps">
        <span>Cree : {new Date(task.createdAt).toLocaleString('fr-FR')}</span>
        <span>Modifie : {new Date(task.updatedAt).toLocaleString('fr-FR')}</span>
      </div>

      {/* Delete */}
      <div className="kanban-detail-actions">
        <button className="kanban-detail-delete-btn" onClick={onDelete}>
          Supprimer cette tache
        </button>
      </div>
    </div>
  )
}
