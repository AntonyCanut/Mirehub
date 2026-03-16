import { useI18n } from '../../lib/i18n'
import { useSkillsStore } from './use-skills-store'

interface Props {
  projectPath: string
  installedSkillNames: Set<string>
  onInstalled: () => void
}

export function SkillsStoreSection({ projectPath, installedSkillNames, onInstalled }: Props) {
  const { t } = useI18n()
  const {
    repos,
    skills: filteredSkills,
    loading,
    error,
    installing,
    filterRepo,
    searchQuery,
    setFilterRepo,
    setSearchQuery,
    fetchSkills,
    handleInstall,
    handleOpenRepo,
    isSkillInstalled,
  } = useSkillsStore({ projectPath, installedSkillNames, onInstalled })

  return (
    <div className="cs-agents-section">
      <div className="claude-profile-section-header">
        <span className="claude-profile-section-title">{t('claude.skillsStore')}</span>
        <button
          className="modal-btn modal-btn--secondary"
          style={{ fontSize: 11, padding: '3px 10px', marginLeft: 'auto' }}
          onClick={() => fetchSkills(true)}
          disabled={loading}
        >
          {loading ? t('claude.skillsStoreRefreshing') : t('claude.skillsStoreRefresh')}
        </button>
      </div>
      <p className="cs-store-desc">{t('claude.skillsStoreDesc')}</p>

      {/* Filter bar */}
      <div className="cs-store-filters">
        <select
          className="cs-store-filter-select"
          value={filterRepo}
          onChange={(e) => setFilterRepo(e.target.value)}
        >
          <option value="all">{t('claude.skillsStoreFilterAll')}</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>{repo.displayName}</option>
          ))}
        </select>
        <input
          className="cs-store-search"
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Repo links */}
      <div className="cs-store-repos">
        {repos.map((repo) => (
          <button
            key={repo.id}
            className="cs-store-repo-chip"
            onClick={() => handleOpenRepo(repo.url)}
            title={repo.description}
          >
            <span className="cs-store-repo-name">{repo.displayName}</span>
            <span className="cs-store-repo-link">{t('claude.skillsStoreViewRepo')}</span>
          </button>
        ))}
      </div>

      {error && <p className="cs-store-error">{error}</p>}

      {!loading && !error && filteredSkills.length === 0 && (
        <p className="cs-store-empty">{t('claude.skillsStoreEmpty')}</p>
      )}

      {/* Skills grid */}
      <div className="cs-store-grid">
        {filteredSkills.map((skill) => {
          const isInstalled = isSkillInstalled(skill)
          const isInstalling = installing.has(skill.id)
          const repo = repos.find((r) => r.id === skill.repoId)

          return (
            <div key={skill.id} className="cs-store-card">
              <div className="cs-store-card-header">
                <span className="cs-store-card-name">{skill.name}</span>
                {isInstalled ? (
                  <span className="cs-store-card-installed">{t('claude.skillsStoreInstalled')}</span>
                ) : (
                  <button
                    className="modal-btn modal-btn--primary"
                    style={{ fontSize: 11, padding: '2px 10px' }}
                    onClick={() => handleInstall(skill)}
                    disabled={isInstalling}
                  >
                    {isInstalling ? '...' : t('claude.skillsStoreInstall')}
                  </button>
                )}
              </div>
              {skill.description && (
                <p className="cs-store-card-desc">{skill.description}</p>
              )}
              <div className="cs-store-card-meta">
                <span className="cs-store-card-author">
                  {t('claude.skillsStoreBy')}{' '}
                  <button
                    className="cs-store-card-author-link"
                    onClick={() => handleOpenRepo(skill.authorUrl)}
                    title={skill.author}
                  >
                    {skill.author}
                  </button>
                </span>
                {repo && (
                  <span className="cs-store-card-repo">
                    {t('claude.skillsStoreFrom')} {repo.displayName}
                  </span>
                )}
                <button
                  className="cs-store-card-link"
                  onClick={() => handleOpenRepo(skill.repoUrl)}
                  title={skill.repoUrl}
                >
                  {t('claude.skillsStoreViewRepo')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
