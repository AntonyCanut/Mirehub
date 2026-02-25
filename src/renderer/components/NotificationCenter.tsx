import { useState, useEffect, useCallback } from 'react'
import { useUpdateStore } from '../lib/stores/updateStore'
import { useAppUpdateStore } from '../lib/stores/appUpdateStore'
import { useI18n } from '../lib/i18n'

export function NotificationCenter() {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const { updates, isChecking, lastChecked, installingTool, installStatus, checkUpdates, installUpdate, uninstallUpdate, clearInstallStatus } =
    useUpdateStore()
  const { status: appUpdateStatus, version: appNewVersion, downloadPercent, checkForUpdate, downloadUpdate, installUpdate: installAppUpdate } =
    useAppUpdateStore()

  const [currentAppVersion, setCurrentAppVersion] = useState<string | null>(null)

  const availableUpdates = updates.filter((u) => u.updateAvailable)
  const notInstalled = updates.filter((u) => !u.installed)
  const appUpdateAvailable = appUpdateStatus === 'available' || appUpdateStatus === 'downloading' || appUpdateStatus === 'downloaded'
  const badgeCount = availableUpdates.length + notInstalled.length + (appUpdateAvailable ? 1 : 0)

  useEffect(() => {
    checkUpdates()
    window.mirehub.app.version().then((info) => {
      setCurrentAppVersion(info.version)
    })
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

  const handleUninstall = useCallback(
    (tool: string) => {
      uninstallUpdate(tool)
    },
    [uninstallUpdate],
  )

  const handleInstallAll = useCallback(() => {
    for (const update of availableUpdates) {
      installUpdate(update.tool, update.scope, update.projectId)
    }
  }, [availableUpdates, installUpdate])

  const handleCheckAll = useCallback(() => {
    checkUpdates()
    checkForUpdate()
  }, [checkUpdates, checkForUpdate])

  const formatTime = (ts: number | null) => {
    if (!ts) return t('time.never')
    const date = new Date(ts)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={handleToggle}
        title={t('updates.notificationTooltip')}
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
            <h3>{t('updates.title')}</h3>
            <div className="notification-panel-actions">
              <button
                className="notification-refresh"
                onClick={handleCheckAll}
                disabled={isChecking || appUpdateStatus === 'checking'}
                title={t('updates.checkTooltip')}
              >
                {isChecking || appUpdateStatus === 'checking' ? '...' : '\u21BB'}
              </button>
              {availableUpdates.length > 1 && (
                <button className="notification-update-all" onClick={handleInstallAll}>
                  {t('updates.updateAll')}
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
                ? `\u2713 ${t('updates.updated', { tool: installStatus.tool })}`
                : `\u2717 ${t('updates.failedUpdate', { tool: installStatus.tool, error: installStatus.error || '' })}`}
            </div>
          )}

          <div className="notification-panel-content">
            {/* App update entry */}
            <div
              className={`notification-item${appUpdateAvailable ? ' notification-item--update' : ''}`}
            >
              <div className="notification-item-info">
                <span className="notification-item-name">Mirehub</span>
                <span className="notification-item-version">
                  {currentAppVersion ?? '...'}
                  {appUpdateStatus === 'available' && appNewVersion && (
                    <>{' \u2192 '}<span className="notification-item-latest">{appNewVersion}</span></>
                  )}
                  {appUpdateStatus === 'downloading' && (
                    <>{' \u2192 '}<span className="notification-item-latest">{appNewVersion} ({downloadPercent}%)</span></>
                  )}
                  {appUpdateStatus === 'downloaded' && appNewVersion && (
                    <>{' \u2192 '}<span className="notification-item-latest">{appNewVersion}</span></>
                  )}
                  {appUpdateStatus === 'checking' && (
                    <> &mdash; {t('appUpdate.checking')}</>
                  )}
                  {(appUpdateStatus === 'idle' || appUpdateStatus === 'not-available') && (
                    <> &mdash; {t('appUpdate.upToDate')}</>
                  )}
                </span>
                <span className="notification-item-scope">{t('appUpdate.appScope')}</span>
              </div>
              <div className="notification-item-actions">
                {appUpdateStatus === 'available' && (
                  <button className="notification-item-btn" onClick={downloadUpdate}>
                    {t('appUpdate.download')}
                  </button>
                )}
                {appUpdateStatus === 'downloading' && (
                  <button className="notification-item-btn" disabled>
                    {downloadPercent}%
                  </button>
                )}
                {appUpdateStatus === 'downloaded' && (
                  <button className="notification-item-btn notification-item-btn--install" onClick={installAppUpdate}>
                    {t('appUpdate.installAndRestart')}
                  </button>
                )}
                {appUpdateStatus === 'error' && (
                  <button className="notification-item-btn" onClick={checkForUpdate}>
                    {t('appUpdate.checkNow')}
                  </button>
                )}
              </div>
            </div>

            {/* Tool updates */}
            {updates.length === 0 && !isChecking ? (
              !appUpdateAvailable && <p className="notification-empty">{t('updates.noInfo')}</p>
            ) : (
              updates.map((update) => (
                <div
                  key={`${update.tool}-${update.scope}`}
                  className={`notification-item${update.updateAvailable ? ' notification-item--update' : ''}${!update.installed ? ' notification-item--missing' : ''}`}
                >
                  <div className="notification-item-info">
                    <span className="notification-item-name">{update.tool}</span>
                    {update.installed ? (
                      <span className="notification-item-version">
                        {update.currentVersion}
                        {update.updateAvailable && (
                          <> {' \u2192 '} <span className="notification-item-latest">{update.latestVersion}</span> </>
                        )}
                      </span>
                    ) : (
                      <span className="notification-item-version notification-item-version--missing">
                        {t('updates.notInstalled')}
                      </span>
                    )}
                    <span className="notification-item-scope">{update.scope}</span>
                  </div>
                  <div className="notification-item-actions">
                    {update.installed && update.updateAvailable && (
                      <button className="notification-item-btn" onClick={() => handleInstall(update.tool, update.scope)} disabled={installingTool === update.tool}>
                        {installingTool === update.tool ? '...' : t('updates.update')}
                      </button>
                    )}
                    {!update.installed && update.tool === 'rtk' && (
                      <button className="notification-item-btn notification-item-btn--install" onClick={() => handleInstall(update.tool, update.scope)} disabled={installingTool === update.tool}>
                        {installingTool === update.tool ? '...' : t('updates.install')}
                      </button>
                    )}
                    {update.installed && update.tool === 'rtk' && (
                      <button className="notification-item-btn notification-item-btn--uninstall" onClick={() => handleUninstall(update.tool)} disabled={installingTool === update.tool}>
                        {installingTool === update.tool ? '...' : t('updates.uninstall')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="notification-panel-footer">
            <span className="notification-last-check">
              {t('updates.lastCheck', { time: formatTime(lastChecked) })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
