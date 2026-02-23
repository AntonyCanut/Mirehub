import { useCallback, useEffect } from 'react'
import { useAppUpdateStore } from '../lib/stores/appUpdateStore'
import { useI18n } from '../lib/i18n'

export function AppUpdateModal() {
  const { status, version, downloadPercent, showModal, dismissModal, downloadUpdate, installUpdate } =
    useAppUpdateStore()
  const { t } = useI18n()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissModal()
    },
    [dismissModal],
  )

  useEffect(() => {
    if (showModal) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal, handleKeyDown])

  if (!showModal) return null

  return (
    <div className="app-update-modal-backdrop" onClick={dismissModal}>
      <div className="app-update-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('appUpdate.title')}</h3>

        {status === 'available' && (
          <>
            <p className="app-update-modal-version">
              {t('appUpdate.newVersion', { version: version ?? '' })}
            </p>
            <div className="app-update-modal-actions">
              <button className="app-update-btn app-update-btn--secondary" onClick={dismissModal}>
                {t('appUpdate.later')}
              </button>
              <button className="app-update-btn app-update-btn--primary" onClick={downloadUpdate}>
                {t('appUpdate.download')}
              </button>
            </div>
          </>
        )}

        {status === 'downloading' && (
          <>
            <p className="app-update-modal-version">{t('appUpdate.downloading')}</p>
            <div className="app-update-progress-bar">
              <div
                className="app-update-progress-fill"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
            <span className="app-update-modal-percent">{downloadPercent}%</span>
          </>
        )}

        {status === 'downloaded' && (
          <>
            <p className="app-update-modal-version">{t('appUpdate.ready')}</p>
            <div className="app-update-modal-actions">
              <button className="app-update-btn app-update-btn--secondary" onClick={dismissModal}>
                {t('appUpdate.later')}
              </button>
              <button className="app-update-btn app-update-btn--primary" onClick={installUpdate}>
                {t('appUpdate.installAndRestart')}
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="app-update-modal-version">{t('appUpdate.error')}</p>
            <div className="app-update-modal-actions">
              <button className="app-update-btn app-update-btn--secondary" onClick={dismissModal}>
                {t('common.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
