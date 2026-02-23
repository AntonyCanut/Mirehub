import { useState, useMemo, useCallback } from 'react'
import { useI18n } from '../lib/i18n'
import type { DbQueryResult } from '../../shared/types'

interface DatabaseResultsTableProps {
  result: DbQueryResult | null
  page: number
  limit: number
  onPageChange: (page: number) => void
  onExportCsv: () => void
}

type SortDirection = 'asc' | 'desc' | null

interface SortState {
  column: string | null
  direction: SortDirection
}

function formatCellValue(value: unknown): { text: string; isNull: boolean } {
  if (value === null || value === undefined) {
    return { text: 'NULL', isNull: true }
  }
  if (typeof value === 'object') {
    return { text: JSON.stringify(value), isNull: false }
  }
  if (typeof value === 'boolean') {
    return { text: value ? 'true' : 'false', isNull: false }
  }
  return { text: String(value), isNull: false }
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  // Nulls always go last
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1

  const multiplier = direction === 'asc' ? 1 : -1

  // Numeric comparison
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * multiplier
  }

  // Boolean comparison
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (Number(a) - Number(b)) * multiplier
  }

  // String comparison
  const strA = String(a).toLowerCase()
  const strB = String(b).toLowerCase()
  return strA.localeCompare(strB) * multiplier
}

export function DatabaseResultsTable({
  result,
  page,
  limit,
  onPageChange,
  onExportCsv,
}: DatabaseResultsTableProps) {
  const { t } = useI18n()
  const [sort, setSort] = useState<SortState>({ column: null, direction: null })

  const handleSort = useCallback(
    (column: string) => {
      setSort((prev) => {
        if (prev.column === column) {
          // Cycle: asc -> desc -> null
          if (prev.direction === 'asc') return { column, direction: 'desc' }
          if (prev.direction === 'desc') return { column: null, direction: null }
        }
        return { column, direction: 'asc' }
      })
    },
    [],
  )

  const sortedRows = useMemo(() => {
    if (!result || !sort.column || !sort.direction) {
      return result?.rows ?? []
    }
    return [...result.rows].sort((a, b) =>
      compareValues(a[sort.column!], b[sort.column!], sort.direction!),
    )
  }, [result, sort])

  if (!result || result.columns.length === 0) {
    return (
      <div className="db-results-empty">{t('db.noResults')}</div>
    )
  }

  const totalRows = result.totalRows ?? result.rowCount
  const totalPages = Math.max(1, Math.ceil(totalRows / limit))
  const currentPage = page + 1

  return (
    <div className="db-results">
      {/* Results header */}
      <div className="db-results-header">
        <div className="db-results-info">
          <span className="db-results-count">
            {t('db.rowCount', { count: String(result.rowCount) })}
            {result.totalRows != null && result.totalRows > result.rowCount && (
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}/ {result.totalRows} {t('db.total')}
              </span>
            )}
          </span>
          <span className="db-results-time">
            {t('db.executionTime', { time: String(result.executionTime) })}
          </span>
        </div>
        <div className="db-results-actions">
          <button className="db-results-export-btn" onClick={onExportCsv} title={t('db.exportCsv')}>
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="db-results-table-wrapper">
        <table className="db-results-table">
          <thead>
            <tr>
              {result.columns.map((col) => {
                const isSorted = sort.column === col
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="db-results-th"
                    title={t('db.sortBy', { column: col })}
                  >
                    <span className="db-results-th-text">{col}</span>
                    {isSorted && (
                      <span className="db-results-sort-indicator">
                        {sort.direction === 'asc' ? ' \u2191' : ' \u2193'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="db-results-tr">
                {result.columns.map((col) => {
                  const { text, isNull } = formatCellValue(row[col])
                  return (
                    <td
                      key={col}
                      className={`db-results-td${isNull ? ' db-results-td--null' : ''}`}
                      title={text}
                    >
                      {text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="db-results-pagination">
          <button
            className="db-pagination-btn"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            {t('db.prevPage')}
          </button>
          <span className="db-pagination-info">
            {t('db.pageInfo', { current: String(currentPage), total: String(totalPages) })}
          </span>
          <button
            className="db-pagination-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('db.nextPage')}
          </button>
        </div>
      )}
    </div>
  )
}
