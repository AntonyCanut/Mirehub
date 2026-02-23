import { NotificationCenter } from './NotificationCenter'
import { useI18n } from '../lib/i18n'

export function TitleBar() {
  const { t } = useI18n()
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <span className="titlebar-title">{t('titlebar.title')}</span>
      <div className="titlebar-actions">
        <NotificationCenter />
      </div>
    </div>
  )
}
