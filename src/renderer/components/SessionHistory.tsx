import { useState, useMemo } from 'react'
import { useClaudeStore } from '../lib/stores/claudeStore'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import type { ClaudeSession } from '../../shared/types/index'

function formatDuration(startedAt: number, endedAt?: number): string {
  if (!endedAt) return 'En cours'
  const diff = endedAt - startedAt
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Aujourd'hui ${time}`
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`
}

function statusBadge(status: ClaudeSession['status']): { label: string; className: string } {
  switch (status) {
    case 'completed':
      return { label: 'Termine', className: 'session-status--completed' }
    case 'failed':
      return { label: 'Echoue', className: 'session-status--failed' }
    case 'running':
      return { label: 'En cours', className: 'session-status--running' }
    case 'paused':
      return { label: 'En pause', className: 'session-status--paused' }
  }
}

export function SessionHistory() {
  const sessionHistory = useClaudeStore((s) => s.sessionHistory)
  const { projects } = useWorkspaceStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<ClaudeSession['status'] | 'all'>('all')

  const filteredSessions = useMemo(() => {
    if (filterStatus === 'all') return sessionHistory
    return sessionHistory.filter((s) => s.status === filterStatus)
  }, [sessionHistory, filterStatus])

  const getProjectName = (projectId: string): string => {
    const project = projects.find((p) => p.id === projectId)
    return project ? (project.path.split('/').pop() ?? project.name) : 'Projet inconnu'
  }

  if (sessionHistory.length === 0) {
    return (
      <div className="session-history">
        <div className="session-history-header">
          <h3>Historique des sessions Claude</h3>
        </div>
        <div className="session-history-empty">
          Aucune session terminee
        </div>
      </div>
    )
  }

  return (
    <div className="session-history">
      <div className="session-history-header">
        <h3>Historique des sessions Claude</h3>
        <span className="session-history-count">{sessionHistory.length} session{sessionHistory.length > 1 ? 's' : ''}</span>
        <select
          className="session-history-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ClaudeSession['status'] | 'all')}
        >
          <option value="all">Tous</option>
          <option value="completed">Termines</option>
          <option value="failed">Echoues</option>
        </select>
      </div>
      <div className="session-history-list">
        {filteredSessions.map((session) => {
          const badge = statusBadge(session.status)
          const isExpanded = expandedId === session.id
          return (
            <div
              key={session.id}
              className={`session-history-item${isExpanded ? ' session-history-item--expanded' : ''}`}
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
            >
              <div className="session-history-item-row">
                <span className={`session-status-badge ${badge.className}`}>{badge.label}</span>
                <span className="session-project-name">{getProjectName(session.projectId)}</span>
                <span className="session-duration">{formatDuration(session.startedAt, session.endedAt)}</span>
                <span className="session-date">{formatDate(session.startedAt)}</span>
              </div>
              {isExpanded && (
                <div className="session-history-details">
                  {session.prompt && (
                    <div className="session-detail-row">
                      <span className="session-detail-label">Prompt:</span>
                      <span className="session-detail-value">{session.prompt}</span>
                    </div>
                  )}
                  <div className="session-detail-row">
                    <span className="session-detail-label">Mode boucle:</span>
                    <span className="session-detail-value">{session.loopMode ? `Oui (${session.loopCount} iterations, delai ${session.loopDelay}ms)` : 'Non'}</span>
                  </div>
                  <div className="session-detail-row">
                    <span className="session-detail-label">Debut:</span>
                    <span className="session-detail-value">{new Date(session.startedAt).toLocaleString('fr-FR')}</span>
                  </div>
                  {session.endedAt && (
                    <div className="session-detail-row">
                      <span className="session-detail-label">Fin:</span>
                      <span className="session-detail-value">{new Date(session.endedAt).toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
