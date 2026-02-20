import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import type { NpmPackageInfo } from '../../shared/types'

type FilterMode = 'all' | 'dependency' | 'devDependency' | 'deprecated' | 'updates'

export function NpmPanel() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const [packages, setPackages] = useState<NpmPackageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [updatingPackages, setUpdatingPackages] = useState<Set<string>>(new Set())
  const [updateAllLoading, setUpdateAllLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const loadPackages = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.theone.project.checkPackages(activeProject.path)
      setPackages(result.packages)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  // Auto-dismiss feedback after 5 seconds
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 5000)
    return () => clearTimeout(timer)
  }, [feedback])

  const handleUpdatePackage = useCallback(async (packageName: string) => {
    if (!activeProject) return
    setUpdatingPackages((prev) => new Set(prev).add(packageName))
    try {
      const result = await window.theone.project.updatePackage(activeProject.path, packageName)
      if (result.success) {
        setFeedback({ message: `${packageName} mis \u00e0 jour`, success: true })
      } else {
        setFeedback({ message: `\u00c9chec ${packageName}: ${result.error}`, success: false })
      }
      await loadPackages()
    } catch (err) {
      setFeedback({ message: `Erreur: ${String(err)}`, success: false })
    } finally {
      setUpdatingPackages((prev) => {
        const next = new Set(prev)
        next.delete(packageName)
        return next
      })
    }
  }, [activeProject, loadPackages])

  const handleUpdateAll = useCallback(async () => {
    if (!activeProject) return
    setUpdateAllLoading(true)
    try {
      const result = await window.theone.project.updatePackage(activeProject.path)
      if (result.success) {
        setFeedback({ message: 'Tous les packages mis \u00e0 jour', success: true })
      } else {
        setFeedback({ message: `\u00c9chec: ${result.error}`, success: false })
      }
      await loadPackages()
    } catch (err) {
      setFeedback({ message: `Erreur: ${String(err)}`, success: false })
    } finally {
      setUpdateAllLoading(false)
    }
  }, [activeProject, loadPackages])

  if (!activeProject) {
    return (
      <div className="npm-panel-empty">
        Selectionnez un projet pour voir ses packages NPM
      </div>
    )
  }

  const filtered = packages.filter((pkg) => {
    switch (filter) {
      case 'dependency':
        return pkg.type === 'dependency'
      case 'devDependency':
        return pkg.type === 'devDependency'
      case 'deprecated':
        return pkg.isDeprecated
      case 'updates':
        return pkg.updateAvailable
      default:
        return true
    }
  })

  const deprecatedCount = packages.filter((p) => p.isDeprecated).length
  const updatesCount = packages.filter((p) => p.updateAvailable).length
  const depsCount = packages.filter((p) => p.type === 'dependency').length
  const devDepsCount = packages.filter((p) => p.type === 'devDependency').length

  return (
    <div className="npm-panel">
      <div className="npm-panel-header">
        <h3>Packages NPM</h3>
        <span className="npm-panel-count">{packages.length} packages</span>
        {updatesCount > 0 && (
          <button
            className="npm-update-all-btn"
            onClick={handleUpdateAll}
            disabled={updateAllLoading}
            title="Tout mettre \u00e0 jour"
          >
            {updateAllLoading ? '...' : `Tout mettre \u00e0 jour (${updatesCount})`}
          </button>
        )}
        <button
          className="npm-panel-refresh"
          onClick={loadPackages}
          disabled={loading}
          title="Rafraichir"
        >
          &#x21bb;
        </button>
      </div>

      {feedback && (
        <div
          className={`npm-feedback ${feedback.success ? 'npm-feedback--success' : 'npm-feedback--error'}`}
          onClick={() => setFeedback(null)}
        >
          {feedback.success ? '\u2713' : '\u2717'} {feedback.message}
        </div>
      )}

      <div className="npm-panel-filters">
        <button
          className={`npm-filter-btn${filter === 'all' ? ' npm-filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tous ({packages.length})
        </button>
        <button
          className={`npm-filter-btn${filter === 'dependency' ? ' npm-filter-btn--active' : ''}`}
          onClick={() => setFilter('dependency')}
        >
          deps ({depsCount})
        </button>
        <button
          className={`npm-filter-btn${filter === 'devDependency' ? ' npm-filter-btn--active' : ''}`}
          onClick={() => setFilter('devDependency')}
        >
          devDeps ({devDepsCount})
        </button>
        {updatesCount > 0 && (
          <button
            className={`npm-filter-btn npm-filter-btn--updates${filter === 'updates' ? ' npm-filter-btn--active' : ''}`}
            onClick={() => setFilter('updates')}
          >
            Mises a jour ({updatesCount})
          </button>
        )}
        {deprecatedCount > 0 && (
          <button
            className={`npm-filter-btn npm-filter-btn--deprecated${filter === 'deprecated' ? ' npm-filter-btn--active' : ''}`}
            onClick={() => setFilter('deprecated')}
          >
            Obsoletes ({deprecatedCount})
          </button>
        )}
      </div>

      {error && <div className="npm-panel-error">{error}</div>}

      <div className="npm-panel-list">
        {loading && <div className="npm-panel-loading">Analyse des packages en cours...</div>}
        {!loading && filtered.length === 0 && (
          <div className="npm-panel-empty-list">Aucun package dans cette categorie</div>
        )}
        {!loading &&
          filtered.map((pkg) => (
            <div
              key={pkg.name}
              className={`npm-package-row${pkg.isDeprecated ? ' npm-deprecated' : ''}${pkg.updateAvailable ? ' npm-update-available' : ''}`}
            >
              <div className="npm-package-info">
                <span className="npm-package-name">{pkg.name}</span>
                <span className="npm-package-type">
                  {pkg.type === 'devDependency' ? 'dev' : 'dep'}
                </span>
              </div>
              <div className="npm-package-versions">
                <span className="npm-package-current">{pkg.currentVersion}</span>
                {pkg.updateAvailable && pkg.latestVersion && (
                  <>
                    <span className="npm-package-arrow">&rarr;</span>
                    <span className="npm-package-latest">{pkg.latestVersion}</span>
                  </>
                )}
              </div>
              {pkg.updateAvailable && (
                <button
                  className="npm-package-update-btn"
                  onClick={() => handleUpdatePackage(pkg.name)}
                  disabled={updatingPackages.has(pkg.name) || updateAllLoading}
                  title={`Mettre \u00e0 jour ${pkg.name}`}
                >
                  {updatingPackages.has(pkg.name) ? '...' : '\u2191'}
                </button>
              )}
              {pkg.isDeprecated && pkg.deprecationMessage && (
                <div className="npm-package-deprecated-msg">{pkg.deprecationMessage}</div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
