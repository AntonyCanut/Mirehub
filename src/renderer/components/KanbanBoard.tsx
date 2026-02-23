import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useKanbanStore } from '../lib/stores/kanbanStore'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useI18n } from '../lib/i18n'
import { ContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import type { KanbanStatus, KanbanTask, PromptTemplate } from '../../shared/types/index'
import '../styles/kanban.css'

interface PendingClipboardImage {
  dataBase64: string
  filename: string
  mimeType: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]!) // strip data:...;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getClipboardImageMimeType(type: string): string {
  if (type === 'image/png') return 'image/png'
  if (type === 'image/jpeg') return 'image/jpeg'
  if (type === 'image/gif') return 'image/gif'
  if (type === 'image/webp') return 'image/webp'
  return 'image/png' // default
}

function getClipboardImageExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/gif') return '.gif'
  if (mimeType === 'image/webp') return '.webp'
  return '.png'
}

const COLUMNS: { status: KanbanStatus; labelKey: string; color: string }[] = [
  { status: 'TODO', labelKey: 'kanban.todo', color: '#89b4fa' },
  { status: 'WORKING', labelKey: 'kanban.working', color: '#fab387' },
  { status: 'PENDING', labelKey: 'kanban.pending', color: '#f9e2af' },
  { status: 'DONE', labelKey: 'kanban.done', color: '#a6e3a1' },
  { status: 'FAILED', labelKey: 'kanban.failed', color: '#f38ba8' },
]

// Columns displayed in the main board (DONE is handled via archive)
const ACTIVE_COLUMNS = COLUMNS.filter((c) => c.status !== 'DONE')

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

const LABEL_DEFS: Record<string, string> = {
  bug: '#f38ba8',
  feature: '#89b4fa',
  refactor: '#cba6f7',
  docs: '#a6e3a1',
  urgent: '#fab387',
  test: '#94e2d5',
}

const ALL_LABELS = Object.keys(LABEL_DEFS)

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export function KanbanBoard() {
  const { t } = useI18n()
  const { activeWorkspaceId, projects } = useWorkspaceStore()
  const {
    tasks,
    loadTasks,
    syncTasksFromFile,
    createTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    duplicateTask,
    draggedTaskId,
    setDragged,
    sendToClaude,
    attachFiles,
    attachFromClipboard,
    removeAttachment,
  } = useKanbanStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<(typeof PRIORITIES)[number]>('medium')
  const [newTargetProjectId, setNewTargetProjectId] = useState('')
  const [newLabels, setNewLabels] = useState<string[]>([])
  const [newDueDate, setNewDueDate] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([])
  const [pendingClipboardImages, setPendingClipboardImages] = useState<PendingClipboardImage[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: KanbanTask } | null>(null)

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterLabels, setFilterLabels] = useState<string[]>([])
  const [filterScope, setFilterScope] = useState<string>('all')

  // Archive state
  const [archiveExpanded, setArchiveExpanded] = useState(false)

  const workspaceProjects = projects.filter((p) => p.workspaceId === activeWorkspaceId)

  useEffect(() => {
    if (activeWorkspaceId) {
      loadTasks(activeWorkspaceId)
    }
  }, [activeWorkspaceId, loadTasks])

  // Periodic sync: re-read kanban.json while WORKING tasks exist (catches hook/Claude changes)
  const hasWorkingTasks = tasks.some((t) => t.status === 'WORKING')
  useEffect(() => {
    if (!hasWorkingTasks) return
    const interval = setInterval(() => syncTasksFromFile(), 5000)
    return () => clearInterval(interval)
  }, [hasWorkingTasks, syncTasksFromFile])

  // Load prompt templates when create form opens
  useEffect(() => {
    if (showCreateForm) {
      window.mirehub.prompts.list().then(setPromptTemplates).catch(() => {})
    }
  }, [showCreateForm])

  // Listen for prefill events from PromptTemplates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { title: string; description: string }
      if (detail) {
        setNewTitle(detail.title)
        setNewDesc(detail.description)
        setShowCreateForm(true)
      }
    }
    window.addEventListener('kanban:prefill', handler)
    return () => window.removeEventListener('kanban:prefill', handler)
  }, [])

  // Sync selectedTask with store
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id)
      if (updated) setSelectedTask(updated)
      else setSelectedTask(null)
    }
  }, [tasks, selectedTask?.id])

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
          return false
        }
      }
      // Priority filter
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      // Label filter
      if (filterLabels.length > 0) {
        if (!t.labels || !filterLabels.some((l) => t.labels!.includes(l))) return false
      }
      // Scope filter
      if (filterScope === 'workspace' && t.targetProjectId) return false
      if (filterScope !== 'all' && filterScope !== 'workspace' && t.targetProjectId !== filterScope) return false
      return true
    })
  }, [tasks, searchQuery, filterPriority, filterLabels, filterScope])

  // Split DONE tasks into active vs archived
  const now = Date.now()
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'DONE'), [filteredTasks])
  const recentDoneTasks = useMemo(
    () => doneTasks.filter((t) => now - t.updatedAt < TWENTY_FOUR_HOURS),
    [doneTasks, now],
  )
  const archivedTasks = useMemo(
    () => doneTasks.filter((t) => now - t.updatedAt >= TWENTY_FOUR_HOURS),
    [doneTasks, now],
  )

  // Sort tasks within a column: overdue first, then by due date, then by creation
  const sortTasks = useCallback((taskList: KanbanTask[]): KanbanTask[] => {
    return [...taskList].sort((a, b) => {
      const aOverdue = a.dueDate && a.dueDate < Date.now() ? 1 : 0
      const bOverdue = b.dueDate && b.dueDate < Date.now() ? 1 : 0
      if (aOverdue !== bOverdue) return bOverdue - aOverdue // overdue first
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return a.createdAt - b.createdAt
    })
  }, [])

  const handleSelectPendingFiles = useCallback(async () => {
    const files = await window.mirehub.kanban.selectFiles()
    if (files && files.length > 0) {
      setPendingAttachments((prev) => [...prev, ...files])
    }
  }, [])

  const handleCreateModalPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue
        const mimeType = getClipboardImageMimeType(item.type)
        const ext = getClipboardImageExtension(mimeType)
        const filename = `clipboard-${Date.now()}${ext}`
        const dataBase64 = await blobToBase64(blob)
        setPendingClipboardImages((prev) => [...prev, { dataBase64, filename, mimeType }])
      }
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!activeWorkspaceId || !newTitle.trim()) return
    await createTask(
      activeWorkspaceId,
      newTitle.trim(),
      newDesc.trim(),
      newPriority,
      newTargetProjectId || undefined,
    )
    // Update labels and due date on the newly created task
    const createdTasks = useKanbanStore.getState().tasks
    const newest = createdTasks[createdTasks.length - 1]
    if (newest && (newLabels.length > 0 || newDueDate)) {
      const extra: Partial<KanbanTask> = {}
      if (newLabels.length > 0) extra.labels = newLabels
      if (newDueDate) extra.dueDate = new Date(newDueDate).getTime()
      await updateTask(newest.id, extra)
    }
    // Attach pending files
    if (newest && pendingAttachments.length > 0) {
      for (const filePath of pendingAttachments) {
        try {
          await window.mirehub.kanban.attachFile(newest.id, activeWorkspaceId, filePath)
        } catch { /* best-effort */ }
      }
    }
    // Attach pending clipboard images
    if (newest && pendingClipboardImages.length > 0) {
      for (const img of pendingClipboardImages) {
        try {
          await window.mirehub.kanban.attachFromClipboard(newest.id, activeWorkspaceId, img.dataBase64, img.filename, img.mimeType)
        } catch { /* best-effort */ }
      }
    }
    // Reload tasks to get updated attachments
    if (newest && (pendingAttachments.length > 0 || pendingClipboardImages.length > 0)) {
      await loadTasks(activeWorkspaceId)
    }
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setNewTargetProjectId('')
    setNewLabels([])
    setNewDueDate('')
    setPendingAttachments([])
    setPendingClipboardImages([])
    setShowCreateForm(false)
  }, [activeWorkspaceId, newTitle, newDesc, newPriority, newTargetProjectId, newLabels, newDueDate, pendingAttachments, pendingClipboardImages, createTask, updateTask, loadTasks])

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

  const handleSendToClaude = useCallback((task: KanbanTask) => {
    sendToClaude(task)
  }, [sendToClaude])

  const handleContextMenu = useCallback((e: React.MouseEvent, task: KanbanTask) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, task })
  }, [])

  const getContextMenuItems = useCallback((task: KanbanTask): ContextMenuItem[] => {
    const statusItems: ContextMenuItem[] = COLUMNS.filter((c) => c.status !== task.status).map((col) => ({
      label: t(col.labelKey),
      action: () => updateTaskStatus(task.id, col.status),
    }))

    return [
      { label: t('kanban.duplicateTask'), action: () => duplicateTask(task), separator: false },
      { label: '', action: () => {}, separator: true },
      ...statusItems,
      { label: '', action: () => {}, separator: true },
      { label: t('kanban.sendToClaude'), action: () => handleSendToClaude(task) },
    ]
  }, [t, updateTaskStatus, duplicateTask, handleSendToClaude])

  const handleRestoreFromArchive = useCallback((task: KanbanTask) => {
    updateTaskStatus(task.id, 'TODO')
  }, [updateTaskStatus])

  const toggleFilterLabel = useCallback((label: string) => {
    setFilterLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    )
  }, [])

  const hasActiveFilters = filterPriority !== 'all' || filterLabels.length > 0 || filterScope !== 'all' || searchQuery !== ''

  if (!activeWorkspaceId) {
    return (
      <div className="kanban-empty">
        {t('kanban.selectWorkspace')}
      </div>
    )
  }

  const getTasksByStatus = (status: KanbanStatus): KanbanTask[] => {
    if (status === 'DONE') return sortTasks(recentDoneTasks)
    return sortTasks(filteredTasks.filter((t) => t.status === status))
  }

  return (
    <div className="kanban">
      <div className="kanban-header">
        <h2>{t('kanban.title')}</h2>
        <div className="kanban-header-actions">
          {/* Search */}
          <input
            className="kanban-search-input"
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="kanban-task-count">{t('kanban.taskCount', { count: String(filteredTasks.length) })}</span>
          <button className="kanban-add-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
            {t('kanban.newTask')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="kanban-filter-bar">
        <select
          className="kanban-filter-select"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="all">{t('kanban.allPriorities')}</option>
          <option value="low">{t('kanban.low')}</option>
          <option value="medium">{t('kanban.medium')}</option>
          <option value="high">{t('kanban.high')}</option>
          <option value="critical">{t('kanban.critical')}</option>
        </select>

        <div className="kanban-filter-labels">
          {ALL_LABELS.map((label) => (
            <button
              key={label}
              className={`kanban-label-chip kanban-label-chip--${label}${filterLabels.includes(label) ? ' kanban-label-chip--active' : ''}`}
              onClick={() => toggleFilterLabel(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className="kanban-filter-select"
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
        >
          <option value="all">{t('kanban.allScopes')}</option>
          <option value="workspace">{t('kanban.workspaceOnly')}</option>
          {workspaceProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            className="kanban-filter-clear"
            onClick={() => {
              setFilterPriority('all')
              setFilterLabels([])
              setFilterScope('all')
              setSearchQuery('')
            }}
          >
            {t('kanban.clearFilters')}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="kanban-create-modal" onClick={(e) => e.stopPropagation()} onPaste={handleCreateModalPaste}>
            <div className="kanban-create-modal-header">
              <h3>{t('kanban.newTaskTitle')}</h3>
              <button className="kanban-create-modal-close" onClick={() => setShowCreateForm(false)}>&times;</button>
            </div>
            <div className="kanban-create-modal-body">
              <input
                className="kanban-input"
                placeholder={t('kanban.taskTitlePlaceholder')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <textarea
                className="kanban-textarea kanban-create-modal-textarea"
                placeholder={t('kanban.descriptionPlaceholder')}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={6}
              />
              <div className="kanban-create-row">
                <select
                  className="kanban-select"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
                >
                  <option value="low">{t('kanban.low')}</option>
                  <option value="medium">{t('kanban.medium')}</option>
                  <option value="high">{t('kanban.high')}</option>
                  <option value="critical">{t('kanban.critical')}</option>
                </select>
                <select
                  className="kanban-select"
                  value={newTargetProjectId}
                  onChange={(e) => setNewTargetProjectId(e.target.value)}
                >
                  <option value="">{t('kanban.entireWorkspace')}</option>
                  {workspaceProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  className="kanban-input kanban-date-input"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  title={t('kanban.dueDate')}
                />
              </div>
              {promptTemplates.length > 0 && (
                <select
                  className="kanban-select"
                  value=""
                  onChange={(e) => {
                    const tpl = promptTemplates.find((t) => t.id === e.target.value)
                    if (tpl) setNewDesc(tpl.content)
                  }}
                  title={t('kanban.useTemplate')}
                >
                  <option value="">{t('kanban.applyTemplate')}</option>
                  {promptTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
              )}
              <div className="kanban-create-labels">
                <span className="kanban-create-labels-title">{t('kanban.labels')} :</span>
                {ALL_LABELS.map((label) => (
                  <button
                    key={label}
                    className={`kanban-label-chip kanban-label-chip--${label}${newLabels.includes(label) ? ' kanban-label-chip--active' : ''}`}
                    onClick={() =>
                      setNewLabels((prev) =>
                        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="kanban-attach-btn"
                onClick={handleSelectPendingFiles}
                title={t('kanban.attachFiles')}
              >
                + {t('kanban.attachFiles')}{pendingAttachments.length > 0 ? ` (${pendingAttachments.length})` : ''}
              </button>
              {(pendingAttachments.length > 0 || pendingClipboardImages.length > 0) && (
                <div className="kanban-create-attachments">
                  {pendingAttachments.map((fp, i) => (
                    <span key={`file-${i}`} className="kanban-attachment-chip">
                      {fp.split('/').pop()}
                      <button
                        className="kanban-attachment-chip-remove"
                        onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {pendingClipboardImages.map((img, i) => (
                    <span key={`clip-${i}`} className="kanban-attachment-chip kanban-attachment-chip--image">
                      <img
                        src={`data:${img.mimeType};base64,${img.dataBase64}`}
                        alt={img.filename}
                        className="kanban-attachment-chip-preview"
                      />
                      {img.filename}
                      <button
                        className="kanban-attachment-chip-remove"
                        onClick={() => setPendingClipboardImages((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="kanban-create-modal-actions">
              <button className="kanban-create-modal-cancel" onClick={() => setShowCreateForm(false)}>
                {t('common.cancel')}
              </button>
              <button className="kanban-submit-btn" onClick={handleCreate}>
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kanban-main">
        <div className="kanban-columns">
          {ACTIVE_COLUMNS.map((col) => (
            <div
              key={col.status}
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="kanban-column-header" style={{ borderColor: col.color }}>
                <span className="kanban-column-dot" style={{ backgroundColor: col.color }} />
                <span className="kanban-column-title">{t(col.labelKey)}</span>
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
                    onContextMenu={(e) => handleContextMenu(e, task)}
                    onUpdate={(data) => updateTask(task.id, data)}
                    projects={workspaceProjects}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* DONE column: recent done + archive */}
          <div
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop('DONE')}
          >
            <div className="kanban-column-header" style={{ borderColor: '#a6e3a1' }}>
              <span className="kanban-column-dot" style={{ backgroundColor: '#a6e3a1' }} />
              <span className="kanban-column-title">{t('kanban.done')}</span>
              <span className="kanban-column-count">{doneTasks.length}</span>
            </div>
            <div className="kanban-column-body">
              {recentDoneTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTask?.id === task.id}
                  onDragStart={() => handleDragStart(task.id)}
                  onClick={() => setSelectedTask(task)}
                  onDelete={() => deleteTask(task.id)}
                  onContextMenu={(e) => handleContextMenu(e, task)}
                  onUpdate={(data) => updateTask(task.id, data)}
                  projects={workspaceProjects}
                />
              ))}

              {/* Archive section */}
              {archivedTasks.length > 0 && (
                <div className="kanban-archive">
                  <button
                    className="kanban-archive-toggle"
                    onClick={() => setArchiveExpanded(!archiveExpanded)}
                  >
                    <span className={`kanban-archive-arrow${archiveExpanded ? ' kanban-archive-arrow--open' : ''}`}>&#9654;</span>
                    {t('kanban.archives', { count: String(archivedTasks.length) })}
                  </button>
                  {archiveExpanded && (
                    <div className="kanban-archive-list">
                      {archivedTasks.map((task) => (
                        <div key={task.id} className="kanban-archive-item">
                          <span className="kanban-archive-item-title">{task.title}</span>
                          <button
                            className="kanban-archive-restore-btn"
                            onClick={() => handleRestoreFromArchive(task)}
                            title={t('kanban.restoreToTodo')}
                          >
                            {t('common.restore')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(data) => updateTask(selectedTask.id, data)}
            onDelete={() => { deleteTask(selectedTask.id); setSelectedTask(null) }}
            onStatusChange={(status) => updateTaskStatus(selectedTask.id, status)}
            onSendToClaude={() => handleSendToClaude(selectedTask)}
            onAttachFiles={() => attachFiles(selectedTask.id)}
            onAttachFromClipboard={(dataBase64, filename, mimeType) => attachFromClipboard(selectedTask.id, dataBase64, filename, mimeType)}
            onRemoveAttachment={(attachmentId) => removeAttachment(selectedTask.id, attachmentId)}
            projects={workspaceProjects}
          />
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.task)}
          onClose={() => setContextMenu(null)}
        />
      )}
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
  onContextMenu,
  onUpdate,
  projects,
}: {
  task: KanbanTask
  isSelected: boolean
  onDragStart: () => void
  onClick: () => void
  onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onUpdate: (data: Partial<KanbanTask>) => void
  projects: Array<{ id: string; name: string }>
}) {
  const { t } = useI18n()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(task.description)
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setTitleValue(task.title) }, [task.title])
  useEffect(() => { setDescValue(task.description) }, [task.description])

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
    } else {
      setTitleValue(task.title)
    }
    setEditingTitle(false)
  }, [titleValue, task.title, onUpdate])

  const saveDesc = useCallback(() => {
    if (descValue !== task.description) {
      onUpdate({ description: descValue })
    }
    setEditingDesc(false)
  }, [descValue, task.description, onUpdate])

  // Delayed single-click: allows double-click to cancel opening the detail panel
  const handleCardClick = useCallback(() => {
    if (editingTitle || editingDesc) return
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null
      onClick()
    }, 250)
  }, [editingTitle, editingDesc, onClick])

  const cancelPendingClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }
  }, [])

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    cancelPendingClick()
    setEditingTitle(true)
  }, [cancelPendingClick])

  const handleDescDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    cancelPendingClick()
    setEditingDesc(true)
  }, [cancelPendingClick])

  const priorityColors: Record<string, string> = {
    low: '#6c7086',
    medium: '#89b4fa',
    high: '#fab387',
    critical: '#f38ba8',
  }

  const isWorking = task.status === 'WORKING'
  const isOverdue = task.dueDate != null && task.dueDate < Date.now() && task.status !== 'DONE'
  const targetProject = task.targetProjectId ? projects.find((p) => p.id === task.targetProjectId) : null

  return (
    <div
      className={`kanban-card${isSelected ? ' kanban-card--selected' : ''}${isWorking ? ' kanban-card--working' : ''}${isOverdue ? ' kanban-card--overdue' : ''}`}
      draggable={!editingTitle && !editingDesc}
      onDragStart={onDragStart}
      onClick={handleCardClick}
      onContextMenu={onContextMenu}
    >
      <div className="kanban-card-header">
        <span
          className="kanban-card-priority"
          style={{ backgroundColor: priorityColors[task.priority] }}
        />
        {editingTitle ? (
          <input
            ref={titleRef}
            className="kanban-card-title-input"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false) }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="kanban-card-title" onDoubleClick={handleTitleDoubleClick}>{task.title}</span>
        )}
        <button
          className="kanban-card-delete"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title={t('common.delete')}
        >
          &times;
        </button>
      </div>
      {editingDesc ? (
        <textarea
          ref={descRef}
          className="kanban-card-desc-edit"
          value={descValue}
          onChange={(e) => setDescValue(e.target.value)}
          onBlur={saveDesc}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDescValue(task.description); setEditingDesc(false) }
          }}
          onClick={(e) => e.stopPropagation()}
          rows={3}
        />
      ) : (
        <p
          className="kanban-card-desc"
          onDoubleClick={handleDescDoubleClick}
        >
          {task.description || t('kanban.noDescription')}
        </p>
      )}
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="kanban-card-labels">
          {task.labels.map((label) => (
            <span
              key={label}
              className={`kanban-label-chip kanban-label-chip--${label} kanban-label-chip--small`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="kanban-card-footer">
        {isWorking && (
          <span className="kanban-card-ai-badge">
            <span className="kanban-card-ai-dot" />
            {t('kanban.aiInProgress')}
          </span>
        )}
        {task.result && (
          <span className="kanban-card-result-badge">{t('kanban.resultAvailable')}</span>
        )}
        {task.question && (
          <span className="kanban-card-question-badge">{t('kanban.questionPending')}</span>
        )}
        {task.dueDate != null && (
          <span className={`kanban-card-due-badge${isOverdue ? ' kanban-card-due-badge--overdue' : ''}`}>
            {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {task.attachments && task.attachments.length > 0 && (
          <span className="kanban-card-attachment-badge">
            {t('kanban.filesCount', { count: String(task.attachments.length) })}
          </span>
        )}
        <span className={`kanban-card-scope-tag kanban-card-scope-tag--${targetProject ? 'project' : 'workspace'}`}>
          {targetProject ? targetProject.name : 'Workspace'}
        </span>
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
  onSendToClaude,
  onAttachFiles,
  onAttachFromClipboard,
  onRemoveAttachment,
  projects,
}: {
  task: KanbanTask
  onClose: () => void
  onUpdate: (data: Partial<KanbanTask>) => void
  onDelete: () => void
  onStatusChange: (status: KanbanStatus) => void
  onSendToClaude: () => void
  onAttachFiles: () => void
  onAttachFromClipboard: (dataBase64: string, filename: string, mimeType: string) => void
  onRemoveAttachment: (attachmentId: string) => void
  projects: Array<{ id: string; name: string }>
}) {
  const { t } = useI18n()
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
    low: t('kanban.low'),
    medium: t('kanban.medium'),
    high: t('kanban.high'),
    critical: t('kanban.critical'),
  }

  const statusColumn = COLUMNS.find((c) => c.status === task.status)
  const taskLabels = task.labels || []

  const toggleLabel = useCallback((label: string) => {
    const updated = taskLabels.includes(label)
      ? taskLabels.filter((l) => l !== label)
      : [...taskLabels, label]
    onUpdate({ labels: updated })
  }, [taskLabels, onUpdate])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue
        const mimeType = getClipboardImageMimeType(item.type)
        const ext = getClipboardImageExtension(mimeType)
        const filename = `clipboard-${Date.now()}${ext}`
        const dataBase64 = await blobToBase64(blob)
        onAttachFromClipboard(dataBase64, filename, mimeType)
      }
    }
  }, [onAttachFromClipboard])

  const handleDueDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onUpdate({ dueDate: value ? new Date(value).getTime() : undefined })
  }, [onUpdate])

  const dueDateValue = task.dueDate
    ? new Date(task.dueDate).toISOString().split('T')[0]
    : ''

  return (
    <div className="kanban-detail" onPaste={handlePaste} tabIndex={-1}>
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

      {/* Status & Priority & Scope */}
      <div className="kanban-detail-meta">
        <div className="kanban-detail-meta-item">
          <span className="kanban-detail-meta-label">{t('kanban.status')}</span>
          <select
            className="kanban-detail-select"
            value={task.status}
            onChange={(e) => onStatusChange(e.target.value as KanbanStatus)}
            style={{ borderColor: statusColumn?.color }}
          >
            {COLUMNS.map((col) => (
              <option key={col.status} value={col.status}>{t(col.labelKey)}</option>
            ))}
          </select>
        </div>
        <div className="kanban-detail-meta-item">
          <span className="kanban-detail-meta-label">{t('kanban.priority')}</span>
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
        <div className="kanban-detail-meta-item">
          <span className="kanban-detail-meta-label">{t('kanban.scope')}</span>
          <select
            className="kanban-detail-select"
            value={task.targetProjectId || ''}
            onChange={(e) => onUpdate({ targetProjectId: e.target.value || undefined })}
          >
            <option value="">{t('kanban.entireWorkspace')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Due date */}
      <div className="kanban-detail-section">
        <span className="kanban-detail-section-title">{t('kanban.dueDate')}</span>
        <input
          className="kanban-detail-date-input"
          type="date"
          value={dueDateValue}
          onChange={handleDueDateChange}
        />
        {task.dueDate != null && task.dueDate < Date.now() && task.status !== 'DONE' && (
          <span className="kanban-detail-overdue-warning">{t('kanban.overdue')}</span>
        )}
      </div>

      {/* Labels */}
      <div className="kanban-detail-section">
        <span className="kanban-detail-section-title">{t('kanban.labels')}</span>
        <div className="kanban-detail-labels">
          {ALL_LABELS.map((label) => (
            <button
              key={label}
              className={`kanban-label-chip kanban-label-chip--${label}${taskLabels.includes(label) ? ' kanban-label-chip--active' : ''}`}
              onClick={() => toggleLabel(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Attachments */}
      <div className="kanban-detail-section">
        <span className="kanban-detail-section-title">{t('kanban.attachedFiles')}</span>
        <div className="kanban-detail-attachments">
          {task.attachments && task.attachments.length > 0 ? (
            task.attachments.map((att) => (
              <div key={att.id} className="kanban-attachment-item">
                <span className="kanban-attachment-item-icon">
                  {att.mimeType.startsWith('image/') ? '🖼' : '📄'}
                </span>
                <span className="kanban-attachment-item-name" title={att.storedPath}>{att.filename}</span>
                <span className="kanban-attachment-item-size">
                  {att.size < 1024 ? `${att.size} o` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} Ko` : `${(att.size / 1048576).toFixed(1)} Mo`}
                </span>
                <button
                  className="kanban-attachment-item-remove"
                  onClick={() => onRemoveAttachment(att.id)}
                  title={t('common.delete')}
                >
                  &times;
                </button>
              </div>
            ))
          ) : (
            <span className="kanban-detail-empty-hint">{t('kanban.noAttachments')}</span>
          )}
        </div>
        <button className="kanban-attach-btn" onClick={onAttachFiles}>
          {t('kanban.addFile')}
        </button>
      </div>

      {/* Description */}
      <div className="kanban-detail-section">
        <span className="kanban-detail-section-title">{t('kanban.description')}</span>
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
            {task.description || t('kanban.noDescription')}
          </div>
        )}
      </div>

      {/* AI Agent info */}
      {task.agentId && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">{t('kanban.aiAgent')}</span>
          <div className="kanban-detail-agent">
            <span className={`kanban-detail-agent-status${task.status === 'WORKING' ? ' kanban-detail-agent-status--active' : ''}`}>
              {task.status === 'WORKING' ? t('kanban.processing') : t('kanban.done')}
            </span>
            <span className="kanban-detail-agent-id">{task.agentId}</span>
          </div>
        </div>
      )}

      {/* Question */}
      {task.question && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">{t('kanban.aiQuestion')}</span>
          <div className="kanban-detail-question">{task.question}</div>
        </div>
      )}

      {/* Result */}
      {task.result && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">{t('kanban.result')}</span>
          <div className="kanban-detail-result">{task.result}</div>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="kanban-detail-section">
          <span className="kanban-detail-section-title">{t('kanban.error')}</span>
          <div className="kanban-detail-error">{task.error}</div>
        </div>
      )}

      {/* Timestamps */}
      <div className="kanban-detail-timestamps">
        <span>{t('kanban.created')} {new Date(task.createdAt).toLocaleString('fr-FR')}</span>
        <span>{t('kanban.modified')} {new Date(task.updatedAt).toLocaleString('fr-FR')}</span>
      </div>

      {/* Send to Claude */}
      {task.status !== 'WORKING' && (
        <div className="kanban-detail-section">
          <button className="kanban-detail-claude-btn" onClick={onSendToClaude}>
            {t('kanban.sendToClaude')}
          </button>
        </div>
      )}

      {/* Delete */}
      <div className="kanban-detail-actions">
        <button className="kanban-detail-delete-btn" onClick={onDelete}>
          {t('kanban.deleteTask')}
        </button>
      </div>
    </div>
  )
}
