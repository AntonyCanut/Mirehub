import { useState } from 'react'
<<<<<<<< HEAD:src/renderer/features/claude/features/settings/features/rules/rule-author-badge.tsx
import { useI18n } from '../../../../../../lib/i18n'
========
import { useI18n } from '../../../../lib/i18n'
>>>>>>>> kanban/r-43:src/renderer/features/claude/features/rules/rule-author-badge.tsx

interface Props {
  author: string
  authorUrl?: string
  coAuthors?: string[]
  onSync?: () => Promise<void>
}

export function RuleAuthorBadge({ author, authorUrl, coAuthors, onSync }: Props) {
  const { t } = useI18n()
  const [syncing, setSyncing] = useState(false)

  const handleAuthorClick = (url: string) => {
    window.kanbai.shell.openExternal(url)
  }

  const handleSync = async () => {
    if (!onSync || syncing) return
    setSyncing(true)
    try {
      await onSync()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="cs-rules-author-badge">
      <span>{t('claude.templateAuthor')}: </span>
      {authorUrl ? (
        <span
          className="cs-rules-author-link"
          onClick={() => handleAuthorClick(authorUrl)}
          title={authorUrl}
        >
          {author}
        </span>
      ) : (
        <span>{author}</span>
      )}
      {coAuthors && coAuthors.length > 0 && (
        <span className="cs-rules-author-coauthors">
          {' '}· {t('claude.modifiedBy')} {coAuthors.join(', ')}
        </span>
      )}
      {onSync && (
        <button
          className="modal-btn modal-btn--secondary cs-rules-sync-btn"
          onClick={handleSync}
          disabled={syncing}
          title={t('claude.syncAiRulesTooltip')}
        >
          {syncing ? t('claude.syncAiRulesSyncing') : t('claude.syncAiRules')}
        </button>
      )}
    </div>
  )
}
