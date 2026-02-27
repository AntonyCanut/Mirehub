import { useI18n } from '../../../lib/i18n'

interface Props {
  author: string
  authorUrl?: string
  coAuthors?: string[]
}

export function RuleAuthorBadge({ author, authorUrl, coAuthors }: Props) {
  const { t } = useI18n()

  const handleAuthorClick = (url: string) => {
    window.mirehub.shell.openExternal(url)
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
    </div>
  )
}
