import React, { useState, useEffect, useCallback } from 'react'
import { useUpdateStore } from '../lib/stores/updateStore'

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const { updates, isChecking, lastChecked, installingTool, installStatus, checkUpdates, installUpdate, clearInstallStatus } =
    useUpdateStore()

  const availableUpdates = updates.filter((u) => u.updateAvailable)
  const badgeCount = availableUpdates.length

  useEffect(() => {
    // Check updates on mount
    checkUpdates()
  }, [checkUpdates])

  // Auto-dismiss install status after 5 seconds
  useEffect(() => {
    if (!installStatus) return
    const timer = setTimeout(() => clearInstallStatus(), 5000)
    return () => clearTimeout(timer)
  }, [installStatus, clearInstallStatus])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleInstall = useCallback(
    (tool: string, scope: string) => {
      installUpdate(tool, scope)
    },
    [installUpdate],
  )

  const handleInstallAll = useCallback(() => {
    for (const update of availableUpdates) {
      installUpdate(update.tool, update.scope, update.projectId)
    }
  }, [availableUpdates, installUpdate])

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Jamais'
    const date = new Date(ts)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={handleToggle}
        title="Centre de notifications"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1C8 1 4 1 4 5V8L2 10V11H14V10L12 8V5C12 1 8 1 8 1Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path d="M6 11V12C6 13.1 6.9 14 8 14C9.1 14 10 13.1 10 12V11" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {badgeCount > 0 && <span className="notification-badge">{badgeCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Mises à jour</h3>
            <div className="notification-panel-actions">
              <button
                className="notification-refresh"
                onClick={checkUpdates}
                disabled={isChecking}
                title="Vérifier les mises à jour"
              >
                {isChecking ? '...' : '↻'}
              </button>
              {availableUpdates.length > 1 && (
                <button className="notification-update-all" onClick={handleInstallAll}>
                  Tout mettre à jour
                </button>
              )}
            </div>
          </div>

          {installStatus && (
            <div
              className={`notification-status ${installStatus.success ? 'notification-status--success' : 'notification-status--error'}`}
              onClick={clearInstallStatus}
            >
              {installStatus.success
                ? `\u2713 ${installStatus.tool} mis \u00e0 jour`
                : `\u2717 \u00c9chec mise \u00e0 jour ${installStatus.tool}: ${installStatus.error}`}
            </div>
          )}

          <div className="notification-panel-content">
            {updates.length === 0 && !isChecking ? (
              <p className="notification-empty">Aucune information disponible.</p>
            ) : (
              updates.map((update) => (
                <div
                  key={`${update.tool}-${update.scope}`}
                  className={`notification-item${update.updateAvailable ? ' notification-item--update' : ''}`}
                >
                  <div className="notification-item-info">
                    <span className="notification-item-name">{update.tool}</span>
                    <span className="notification-item-version">
                      {update.currentVersion}
                      {update.updateAvailable && (
                        <>
                          {' → '}
                          <span className="notification-item-latest">{update.latestVersion}</span>
                        </>
                      )}
                    </span>
                    <span className="notification-item-scope">{update.scope}</span>
                  </div>
                  {update.updateAvailable && (
                    <button
                      className="notification-item-btn"
                      onClick={() => handleInstall(update.tool, update.scope)}
                      disabled={installingTool === update.tool}
                    >
                      {installingTool === update.tool ? '...' : 'Mettre à jour'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="notification-panel-footer">
            <span className="notification-last-check">
              Dernière vérification : {formatTime(lastChecked)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
