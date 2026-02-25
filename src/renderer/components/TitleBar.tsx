import { NotificationCenter } from './NotificationCenter'
import { UpdateCenter } from './UpdateCenter'
import { useI18n } from '../lib/i18n'

export function TitleBar() {
  const { t } = useI18n()
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <span className="titlebar-title">{t('titlebar.title')}</span>
      <div className="titlebar-actions">
        <NotificationCenter />
        <UpdateCenter />
      </div>
    </div>
  )
}
