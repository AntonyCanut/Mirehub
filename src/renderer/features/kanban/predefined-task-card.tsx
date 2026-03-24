import { useI18n } from '../../lib/i18n'
import { TYPE_CONFIG, PRIORITY_COLORS } from './kanban-constants'
import type { PredefinedTaskTemplate } from './kanban-constants'

export function PredefinedTaskCard({
  template,
  projectName,
  onAdd,
  onDismiss,
  onDoubleClick,
}: {
  template: PredefinedTaskTemplate
  projectName?: string
  onAdd: () => void
  onDismiss: () => void
  onDoubleClick: () => void
}) {
  const { t, locale } = useI18n()

  const typeConf = TYPE_CONFIG[template.type] ?? TYPE_CONFIG.feature

  // Use project-specific title if projectName is provided and a titleWithProject key exists
  const titleWithProjectKey = `${template.titleKey}WithProject` as Parameters<typeof t>[0]
  const title = projectName
    ? t(titleWithProjectKey, { project: projectName })
    : t(template.titleKey)

  return (
    <div className="kanban-card kanban-card--predefined" onDoubleClick={onDoubleClick}>
      <div className="kanban-card-accent" style={{ backgroundColor: typeConf.color }} />
      <div className="kanban-card-inner">
        <div className="kanban-card-top-row">
          <span
            className="kanban-card-type-badge"
            style={{ color: typeConf.color, background: `${typeConf.color}1a` }}
          >
            {locale === 'en' ? typeConf.labelEn : typeConf.labelFr}
          </span>
          {projectName && (
            <span className="kanban-card-project-badge">{projectName}</span>
          )}
          {template.action && (
            <span className="kanban-card-auto-badge" title="Auto-execute">&#9889;</span>
          )}
          <span
            className="kanban-card-priority"
            style={{ backgroundColor: PRIORITY_COLORS[template.priority] }}
          />
        </div>
        <span className="kanban-card-title">{title}</span>
        <p className="kanban-card-desc">{t(template.descriptionKey)}</p>
        <div className="kanban-predefined-actions">
          <button
            className="kanban-predefined-add"
            onClick={onAdd}
          >
            {t('kanban.predefined.add')}
          </button>
          <button
            className="kanban-predefined-dismiss"
            onClick={onDismiss}
          >
            {t('kanban.predefined.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
