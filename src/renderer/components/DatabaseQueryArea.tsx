import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useI18n } from '../lib/i18n'
import { DatabaseResultsTable } from './DatabaseResultsTable'
import { CopyableError } from './CopyableError'
import type {
  DbConnection,
  DbConnectionStatus,
  DbQueryResult,
  DbEnvironmentTag,
} from '../../shared/types'

interface DatabaseQueryAreaProps {
  connection: DbConnection | null
  connectionStatus: DbConnectionStatus
  pendingQuery: string | null
  onPendingQueryConsumed: () => void
}

const ENV_TAG_COLORS: Record<DbEnvironmentTag, string> = {
  local: '#a6e3a1',
  dev: '#89b4fa',
  int: '#fab387',
  qua: '#cba6f7',
  prd: '#f38ba8',
  custom: 'var(--text-muted)',
}

const LIMIT_OPTIONS = [50, 100, 250, 500, 1000]

function getStatusLabel(status: DbConnectionStatus, t: (key: string) => string): string {
  switch (status) {
    case 'connected':
      return t('db.statusConnected')
    case 'connecting':
      return t('db.connecting')
    case 'error':
      return t('db.connectionError')
    default:
      return t('db.statusDisconnected')
  }
}

function getStatusColor(status: DbConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'var(--success)'
    case 'connecting':
      return 'var(--warning)'
    case 'error':
      return 'var(--danger)'
    default:
      return 'var(--text-muted)'
  }
}

function exportToCsv(result: DbQueryResult): void {
  if (!result || result.columns.length === 0) return

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = result.columns.map(escape).join(',')
  const rows = result.rows.map((row) =>
    result.columns.map((col) => escape(row[col])).join(','),
  )
  const csv = [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `query-results-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function DatabaseQueryArea({
  connection,
  connectionStatus,
  pendingQuery,
  onPendingQueryConsumed,
}: DatabaseQueryAreaProps) {
  const { t } = useI18n()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DbQueryResult | null>(null)
  const [executing, setExecuting] = useState(false)
  const [limit, setLimit] = useState(100)
  const [page, setPage] = useState(0)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  // Handle pending query from sidebar table click
  useEffect(() => {
    if (pendingQuery) {
      setQuery(pendingQuery)
      onPendingQueryConsumed()
      // Auto-execute
      if (connectionStatus === 'connected' && connection) {
        executeWithQuery(pendingQuery, limit, 0)
      }
    }
  }, [pendingQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset results when connection changes
  useEffect(() => {
    setResults(null)
    setPage(0)
  }, [connection?.id])

  const executeWithQuery = useCallback(
    async (sql: string, queryLimit: number, queryOffset: number) => {
      if (!connection || connectionStatus !== 'connected' || !sql.trim()) return

      setExecuting(true)
      try {
        const result = await window.mirehub.database.executeQuery(
          connection.id,
          sql,
          queryLimit,
          queryOffset,
        )
        setResults(result)
      } catch (err) {
        setResults({
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: 0,
          error: String(err),
        })
      } finally {
        setExecuting(false)
      }
    },
    [connection, connectionStatus],
  )

  const handleExecute = useCallback(() => {
    setPage(0)
    executeWithQuery(query, limit, 0)
  }, [query, limit, executeWithQuery])

  const handleCancelQuery = useCallback(async () => {
    if (!connection) return
    try {
      await window.mirehub.database.cancelQuery(connection.id)
    } catch {
      // Ignore cancel errors
    }
    setExecuting(false)
  }, [connection])

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      executeWithQuery(query, limit, newPage * limit)
    },
    [query, limit, executeWithQuery],
  )

  const handleExportCsv = useCallback(() => {
    if (results) {
      exportToCsv(results)
    }
  }, [results])

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      editorRef.current = editorInstance

      // Add Cmd+Enter shortcut
      editorInstance.addCommand(
        // Monaco KeyMod.CtrlCmd | Monaco KeyCode.Enter
        2048 | 3, // KeyMod.CtrlCmd = 2048, KeyCode.Enter = 3
        () => {
          handleExecute()
        },
      )
    },
    [handleExecute],
  )

  // Determine editor language based on engine
  const editorLanguage = connection?.engine === 'mongodb' ? 'json' : 'sql'

  // No connection selected
  if (!connection) {
    return (
      <div className="db-query-area">
        <div className="db-query-empty">{t('db.selectConnection')}</div>
      </div>
    )
  }

  const tagColor =
    connection.environmentTag === 'custom'
      ? 'var(--text-muted)'
      : ENV_TAG_COLORS[connection.environmentTag]
  const tagLabel =
    connection.environmentTag === 'custom'
      ? connection.customTagName ?? 'custom'
      : connection.environmentTag

  return (
    <div className="db-query-area">
      {/* Toolbar */}
      <div className="db-query-toolbar">
        <div className="db-query-toolbar-left">
          <span className="db-query-conn-name">{connection.name}</span>
          <span
            className="db-query-status-badge"
            style={{
              color: getStatusColor(connectionStatus),
              borderColor: getStatusColor(connectionStatus),
            }}
          >
            {getStatusLabel(connectionStatus, t)}
          </span>
          <span
            className="db-env-badge"
            style={{ background: tagColor, color: '#1e1e2e' }}
          >
            {tagLabel}
          </span>
        </div>
        <div className="db-query-toolbar-right">
          <select
            className="db-limit-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map((l) => (
              <option key={l} value={l}>
                LIMIT {l}
              </option>
            ))}
          </select>
          {executing ? (
            <button className="db-execute-btn db-execute-btn--cancel" onClick={handleCancelQuery}>
              {t('db.cancel')}
            </button>
          ) : (
            <button
              className="db-execute-btn"
              onClick={handleExecute}
              disabled={connectionStatus !== 'connected' || !query.trim()}
              title="Cmd+Enter"
            >
              {t('db.execute')}
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="db-editor-container">
        <Editor
          height="200px"
          language={editorLanguage}
          value={query}
          onChange={(value) => setQuery(value ?? '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'line',
            suggestOnTriggerCharacters: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Results */}
      <div className="db-results-container">
        {executing && (
          <div className="db-results-loading">{t('db.executing')}</div>
        )}

        {!executing && results?.error && (
          <div className="db-results-error">
            <span className="db-results-error-label">{t('db.queryError')}</span>
            <div className="db-results-error-message">
              <CopyableError error={results.error} />
            </div>
          </div>
        )}

        {!executing && results && !results.error && (
          <DatabaseResultsTable
            result={results}
            page={page}
            limit={limit}
            onPageChange={handlePageChange}
            onExportCsv={handleExportCsv}
          />
        )}

        {!executing && !results && (
          <div className="db-results-placeholder">
            {connectionStatus === 'connected'
              ? t('db.writeQuery')
              : t('db.connectFirst')}
          </div>
        )}
      </div>
    </div>
  )
}
