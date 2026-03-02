import { useEffect, useCallback } from 'react'
import { useI18n } from '../lib/i18n'

const SECTION_ICONS: Record<string, string> = {
  welcome: '👋',
  kanban: '📋',
  terminal: '▸',
  git: '⎇',
  database: '🗄',
  packages: '📦',
  analysis: '🔍',
  todos: '✓',
  stats: '📊',
  prompts: '💬',
  api: '🌐',
  settings: '⚙',
  search: '🔎',
  shortcuts: '⌨',
  claude: '✦',
  ai: '✦',
  healthcheck: '🏥',
}

interface TutorialModalProps {
  section: string
  onDone: () => void
  onDismissAll: () => void
}

export function TutorialModal({ section, onDone, onDismissAll }: TutorialModalProps) {
  const { t } = useI18n()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onDismissAll()
    } else if (e.key === 'Enter') {
      onDone()
    }
  }, [onDone, onDismissAll])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const icon = SECTION_ICONS[section] ?? '📌'
  const titleKey = `tutorial.${section}.title`
  const descriptionKey = `tutorial.${section}.description`

  return (
    <div className="tutorial-modal-overlay" onClick={onDismissAll}>
      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-modal-header">
          <span className="tutorial-modal-step-indicator">
            {t(titleKey)}
          </span>
          <button className="tutorial-modal-close" onClick={onDismissAll} title={t('tutorial.dismiss')}>
            ✕
          </button>
        </div>

        <div className="tutorial-modal-body">
          <div className="tutorial-modal-icon">{icon}</div>
          <h2 className="tutorial-modal-title">{t(titleKey)}</h2>
          <p className="tutorial-modal-description">{t(descriptionKey)}</p>
        </div>

        <div className="tutorial-modal-actions">
          <button className="tutorial-modal-btn tutorial-modal-btn--secondary" onClick={onDismissAll}>
            {t('tutorial.dismiss')}
          </button>
          <button className="tutorial-modal-btn tutorial-modal-btn--primary" onClick={onDone}>
            {t('tutorial.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}
