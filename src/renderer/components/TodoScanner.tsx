import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useViewStore } from '../lib/stores/viewStore'
import { useI18n } from '../lib/i18n'
import type { TodoEntry } from '../../shared/types'

type TodoType = 'TODO' | 'FIXME' | 'HACK' | 'NOTE' | 'XXX'
type FilterType = TodoType | 'ALL'

const TYPE_COLORS: Record<TodoType, string> = {
  TODO: 'var(--accent)',
  FIXME: 'var(--danger)',
  HACK: 'var(--warning)',
  NOTE: 'var(--success)',
  XXX: '#cba6f7',
}

export function TodoScanner() {
  const { t } = useI18n()
  const { activeProjectId, projects } = useWorkspaceStore()
  const { openFile } = useViewStore()
  const [entries, setEntries] = useState<TodoEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const scan = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const results = await window.mirehub.project.scanTodos(activeProject.path)
      setEntries(results)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => {
    scan()
  }, [scan])

  const filtered = useMemo(() => {
    if (filter === 'ALL') return entries
    return entries.filter((e) => e.type === filter)
  }, [entries, filter])

  const grouped = useMemo(() => {
    const groups: Record<string, TodoEntry[]> = {}
    for (const entry of filtered) {
      if (!groups[entry.file]) groups[entry.file] = []
      groups[entry.file]!.push(entry)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] || 0) + 1
    }
    return counts
  }, [entries])

  const toggleFile = useCallback((file: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(file)) {
        next.delete(file)
      } else {
        next.add(file)
      }
      return next
    })
  }, [])

  const handleClickEntry = useCallback(
    (entry: TodoEntry) => {
      if (!activeProject) return
      const fullPath = activeProject.path + '/' + entry.file
      openFile(fullPath, entry.line)
    },
    [activeProject, openFile],
  )

  if (!activeProject) {
    return <div className="todo-scanner-empty">{t('todos.selectProject')}</div>
  }

  return (
    <div className="todo-scanner">
      <div className="todo-scanner-header">
        <h3>{t('todos.title')}</h3>
        <span className="todo-scanner-count">{t('todos.itemCount', { count: String(filtered.length) })}</span>
        <button
          className="todo-scanner-refresh"
          onClick={scan}
          disabled={loading}
          title={t('common.refresh')}
        >
          {loading ? '...' : '\u21BB'}
        </button>
      </div>

      <div className="todo-scanner-filters">
        <button
          className={`todo-filter-btn${filter === 'ALL' ? ' todo-filter-btn--active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          {t('todos.allCount', { count: String(entries.length) })}
        </button>
        {(['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX'] as TodoType[]).map((type) => (
          <button
            key={type}
            className={`todo-filter-btn${filter === type ? ' todo-filter-btn--active' : ''}`}
            style={{
              borderColor: filter === type ? TYPE_COLORS[type] : undefined,
              color: filter === type ? TYPE_COLORS[type] : undefined,
            }}
            onClick={() => setFilter(type)}
          >
            {t('todos.typeCount', { type, count: String(typeCounts[type] || 0) })}
          </button>
        ))}
      </div>

      <div className="todo-scanner-list">
        {loading && entries.length === 0 && (
          <div className="todo-scanner-loading">{t('todos.scanning')}</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="todo-scanner-no-results">{t('todos.noComments', { type: filter === 'ALL' ? '' : filter })}</div>
        )}
        {grouped.map(([file, items]) => (
          <div key={file} className="todo-scanner-group">
            <button
              className="todo-scanner-file-header"
              onClick={() => toggleFile(file)}
            >
              <span className="todo-scanner-chevron" style={{ transform: collapsedFiles.has(file) ? 'rotate(0deg)' : 'rotate(90deg)' }}>
                {'\u25B6'}
              </span>
              <span className="todo-scanner-file-name">{file}</span>
              <span className="todo-scanner-file-count">{items.length}</span>
            </button>
            {!collapsedFiles.has(file) && (
              <div className="todo-scanner-entries">
                {items.map((entry, idx) => (
                  <button
                    key={`${entry.file}:${entry.line}:${idx}`}
                    className="todo-scanner-entry"
                    onClick={() => handleClickEntry(entry)}
                  >
                    <span
                      className="todo-scanner-type-badge"
                      style={{ background: `${TYPE_COLORS[entry.type]}20`, color: TYPE_COLORS[entry.type] }}
                    >
                      {entry.type}
                    </span>
                    <span className="todo-scanner-line">:{entry.line}</span>
                    <span className="todo-scanner-text">{entry.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
