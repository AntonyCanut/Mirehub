import { useState, useCallback, useMemo, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { MCP_CATALOG, MCP_CATEGORIES, MCP_CATEGORY_ICONS } from '../../shared/constants/mcpCatalog'
import type { McpCategory, McpCatalogEntry } from '../../shared/types'
import { CopyableError } from './CopyableError'

type McpView = 'catalog' | 'installed'

interface McpPanelProps {
  mcpServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>
  settings: Record<string, unknown>
  projectPath: string
  onServersChange: (servers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>, settings: Record<string, unknown>) => void
}

function McpHelpOutput({ text }: { text: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <div className="claude-mcp-help-output-wrapper">
      <button
        className="claude-mcp-help-copy-btn"
        onClick={handleCopy}
        title={t('common.copy')}
      >
        {copied ? '\u2713' : '\u2398'}
      </button>
      <pre className="claude-mcp-help-output">{text}</pre>
    </div>
  )
}

export function McpPanel({ mcpServers, settings, projectPath, onServersChange }: McpPanelProps) {
  const { t } = useI18n()

  // View state
  const [view, setView] = useState<McpView>('catalog')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<McpCategory | 'all'>('all')

  // Manual add state
  const [mcpAddingNew, setMcpAddingNew] = useState(false)
  const [mcpNewName, setMcpNewName] = useState('')
  const [mcpNewCommand, setMcpNewCommand] = useState('')
  const [mcpNewArgs, setMcpNewArgs] = useState('')
  const [mcpNewEnv, setMcpNewEnv] = useState('')

  // Help/docs state
  const [mcpHelpData, setMcpHelpData] = useState<Record<string, { loading: boolean; output?: string; error?: string }>>({})
  const [mcpExpandedHelp, setMcpExpandedHelp] = useState<string | null>(null)

  // Catalog install state (for env variable configuration)
  const [installingEntry, setInstallingEntry] = useState<McpCatalogEntry | null>(null)
  const [installEnvValues, setInstallEnvValues] = useState<Record<string, string>>({})

  // Installed server IDs (match catalog entries by command+args pattern)
  const installedCatalogIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [name] of Object.entries(mcpServers)) {
      const match = MCP_CATALOG.find(e => e.id === name)
      if (match) ids.add(match.id)
    }
    return ids
  }, [mcpServers])

  // Filter catalog
  const filteredCatalog = useMemo(() => {
    let entries = MCP_CATALOG
    if (selectedCategory !== 'all') {
      entries = entries.filter(e => e.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      entries = entries.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.features.some(f => f.toLowerCase().includes(q))
      )
    }
    return entries
  }, [selectedCategory, searchQuery])

  // Group catalog by category
  const catalogByCategory = useMemo(() => {
    const groups: Record<string, McpCatalogEntry[]> = {}
    for (const entry of filteredCatalog) {
      if (!groups[entry.category]) groups[entry.category] = []
      groups[entry.category]!.push(entry)
    }
    return groups
  }, [filteredCatalog])

  const doInstall = useCallback(async (entry: McpCatalogEntry, envValues: Record<string, string>) => {
    const env: Record<string, string> = {}
    let hasEnv = false
    for (const [key, val] of Object.entries(envValues)) {
      if (val.trim()) {
        env[key] = val.trim()
        hasEnv = true
      }
    }
    const newServer = {
      command: entry.command,
      args: entry.args,
      ...(hasEnv ? { env } : entry.env ? { env: entry.env } : {}),
    }
    const newServers = { ...mcpServers, [entry.id]: newServer }
    const newSettings = { ...settings, mcpServers: newServers }
    await window.mirehub.project.writeClaudeSettings(projectPath, newSettings)
    onServersChange(newServers, newSettings)
    setInstallingEntry(null)
    setInstallEnvValues({})
  }, [mcpServers, settings, projectPath, onServersChange])

  // Install from catalog
  const handleCatalogInstall = useCallback((entry: McpCatalogEntry) => {
    if (entry.envPlaceholders && Object.keys(entry.envPlaceholders).length > 0) {
      setInstallingEntry(entry)
      setInstallEnvValues({ ...entry.envPlaceholders })
      return
    }
    // No env needed, install directly
    doInstall(entry, {})
  }, [doInstall])

  const handleConfirmInstall = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!installingEntry) return
    await doInstall(installingEntry, installEnvValues)
  }, [installingEntry, installEnvValues, doInstall])

  // Manual add
  const handleAddMcpServer = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!mcpNewName.trim() || !mcpNewCommand.trim()) return
    const args = mcpNewArgs.trim() ? mcpNewArgs.trim().split('\n').map(a => a.trim()).filter(Boolean) : undefined
    let env: Record<string, string> | undefined
    if (mcpNewEnv.trim()) {
      env = {}
      for (const line of mcpNewEnv.trim().split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) {
          env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
        }
      }
      if (Object.keys(env).length === 0) env = undefined
    }
    const newServer = { command: mcpNewCommand.trim(), ...(args ? { args } : {}), ...(env ? { env } : {}) }
    const newServers = { ...mcpServers, [mcpNewName.trim()]: newServer }
    const newSettings = { ...settings, mcpServers: newServers }
    await window.mirehub.project.writeClaudeSettings(projectPath, newSettings)
    onServersChange(newServers, newSettings)
    setMcpNewName('')
    setMcpNewCommand('')
    setMcpNewArgs('')
    setMcpNewEnv('')
    setMcpAddingNew(false)
  }, [mcpNewName, mcpNewCommand, mcpNewArgs, mcpNewEnv, mcpServers, settings, projectPath, onServersChange])

  // Remove server
  const handleRemoveMcpServer = useCallback(async (name: string) => {
    const newServers = { ...mcpServers }
    delete newServers[name]
    const newSettings = { ...settings }
    if (Object.keys(newServers).length > 0) {
      newSettings.mcpServers = newServers
    } else {
      delete newSettings.mcpServers
    }
    await window.mirehub.project.writeClaudeSettings(projectPath, newSettings)
    onServersChange(newServers, newSettings)
    if (mcpExpandedHelp === name) setMcpExpandedHelp(null)
  }, [mcpServers, settings, projectPath, onServersChange, mcpExpandedHelp])

  // Help/docs
  const handleGetMcpHelp = useCallback(async (name: string) => {
    if (mcpExpandedHelp === name) {
      setMcpExpandedHelp(null)
      return
    }
    setMcpExpandedHelp(name)
    if (mcpHelpData[name]?.output || mcpHelpData[name]?.error) return
    setMcpHelpData(prev => ({ ...prev, [name]: { loading: true } }))
    try {
      const config = mcpServers[name]
      if (!config) return
      const result = await window.mirehub.mcp.getHelp(name, config)
      if (result.success) {
        setMcpHelpData(prev => ({ ...prev, [name]: { loading: false, output: result.output } }))
      } else {
        setMcpHelpData(prev => ({ ...prev, [name]: { loading: false, error: result.error || 'Unknown error' } }))
      }
    } catch (err) {
      setMcpHelpData(prev => ({ ...prev, [name]: { loading: false, error: String(err) } }))
    }
  }, [mcpExpandedHelp, mcpHelpData, mcpServers])

  const installedCount = Object.keys(mcpServers).length

  return (
    <div className="claude-rules-mcp">
      {/* View Tabs */}
      <div className="mcp-view-tabs">
        <button
          className={`mcp-view-tab${view === 'catalog' ? ' mcp-view-tab--active' : ''}`}
          onClick={() => setView('catalog')}
        >
          {t('claude.mcpCatalog')}
        </button>
        <button
          className={`mcp-view-tab${view === 'installed' ? ' mcp-view-tab--active' : ''}`}
          onClick={() => setView('installed')}
        >
          {t('claude.mcpInstalled')} ({installedCount})
        </button>
      </div>

      {/* ===== CATALOG VIEW ===== */}
      {view === 'catalog' && (
        <div className="mcp-catalog">
          {/* Search */}
          <div className="mcp-catalog-search">
            <input
              className="mcp-catalog-search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('claude.mcpSearchPlaceholder')}
            />
          </div>

          {/* Category Chips */}
          <div className="mcp-catalog-categories">
            <button
              className={`mcp-cat-chip${selectedCategory === 'all' ? ' mcp-cat-chip--active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              {t('claude.mcpCatAll')}
            </button>
            {MCP_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`mcp-cat-chip${selectedCategory === cat.id ? ' mcp-cat-chip--active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
              >
                <span className="mcp-cat-chip-icon">{MCP_CATEGORY_ICONS[cat.id]}</span>
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          {/* Catalog Entries */}
          {filteredCatalog.length === 0 ? (
            <div className="claude-mcp-empty">{t('claude.mcpCatalogEmpty')}</div>
          ) : (
            <div className="mcp-catalog-grid">
              {Object.entries(catalogByCategory).map(([category, entries]) => (
                <div key={category} className="mcp-catalog-group">
                  <div className="mcp-catalog-group-title">
                    <span className="mcp-catalog-group-icon">{MCP_CATEGORY_ICONS[category as McpCategory]}</span>
                    {t(MCP_CATEGORIES.find(c => c.id === category)?.labelKey ?? '')}
                  </div>
                  <div className="mcp-catalog-entries">
                    {entries.map(entry => {
                      const isInstalled = installedCatalogIds.has(entry.id)
                      return (
                        <div key={entry.id} className={`mcp-catalog-card${isInstalled ? ' mcp-catalog-card--installed' : ''}`}>
                          <div className="mcp-catalog-card-header">
                            <div className="mcp-catalog-card-title">
                              {entry.name}
                              {entry.official && <span className="mcp-catalog-badge-official" title="Official">MCP</span>}
                            </div>
                            {isInstalled ? (
                              <span className="mcp-catalog-badge-installed">{t('claude.mcpAlreadyInstalled')}</span>
                            ) : (
                              <button
                                className="mcp-catalog-install-btn"
                                onClick={() => handleCatalogInstall(entry)}
                              >
                                {t('claude.mcpInstall')}
                              </button>
                            )}
                          </div>
                          <div className="mcp-catalog-card-desc">{entry.description}</div>
                          <div className="mcp-catalog-card-features">
                            {entry.features.slice(0, 5).map(f => (
                              <span key={f} className="mcp-catalog-feature-chip">{f}</span>
                            ))}
                            {entry.features.length > 5 && (
                              <span className="mcp-catalog-feature-chip mcp-catalog-feature-more">+{entry.features.length - 5}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Install modal for env vars */}
          {installingEntry && (
            <div className="mcp-install-overlay" onClick={() => setInstallingEntry(null)}>
              <form className="mcp-install-modal" onClick={e => e.stopPropagation()} onSubmit={handleConfirmInstall}>
                <div className="mcp-install-modal-title">
                  {t('claude.mcpConfigureServer', { name: installingEntry.name })}
                </div>
                <div className="mcp-install-modal-desc">
                  {t('claude.mcpConfigureEnvDesc')}
                </div>
                {Object.entries(installingEntry.envPlaceholders ?? {}).map(([key, placeholder]) => (
                  <div key={key} className="claude-mcp-form-row">
                    <label className="claude-mcp-form-label">{key}</label>
                    <input
                      className="claude-mcp-form-input"
                      value={installEnvValues[key] ?? ''}
                      onChange={e => setInstallEnvValues(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      autoFocus
                    />
                  </div>
                ))}
                <div className="claude-mcp-form-actions">
                  <button type="button" className="claude-mcp-action-btn" onClick={() => setInstallingEntry(null)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="claude-mcp-add-btn">
                    {t('claude.mcpInstall')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ===== INSTALLED VIEW ===== */}
      {view === 'installed' && (
        <div className="mcp-installed">
          <div className="claude-mcp-header">
            <span className="claude-mcp-title">{t('claude.mcpServers')}</span>
            {!mcpAddingNew && (
              <button className="claude-mcp-add-btn" onClick={() => setMcpAddingNew(true)}>
                {t('claude.mcpAddManual')}
              </button>
            )}
          </div>

          {mcpAddingNew && (
            <form className="claude-mcp-add-form" onSubmit={handleAddMcpServer}>
              <div className="claude-mcp-form-row">
                <label className="claude-mcp-form-label">{t('claude.mcpServerName')}</label>
                <input
                  className="claude-mcp-form-input"
                  value={mcpNewName}
                  onChange={e => setMcpNewName(e.target.value)}
                  placeholder="filesystem"
                  autoFocus
                />
              </div>
              <div className="claude-mcp-form-row">
                <label className="claude-mcp-form-label">{t('claude.mcpServerCommand')}</label>
                <input
                  className="claude-mcp-form-input"
                  value={mcpNewCommand}
                  onChange={e => setMcpNewCommand(e.target.value)}
                  placeholder="npx"
                />
              </div>
              <div className="claude-mcp-form-row">
                <label className="claude-mcp-form-label">{t('claude.mcpServerArgs')}</label>
                <textarea
                  className="claude-mcp-form-textarea"
                  value={mcpNewArgs}
                  onChange={e => setMcpNewArgs(e.target.value)}
                  placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/tmp"}
                  rows={3}
                />
              </div>
              <div className="claude-mcp-form-row">
                <label className="claude-mcp-form-label">{t('claude.mcpServerEnv')}</label>
                <textarea
                  className="claude-mcp-form-textarea"
                  value={mcpNewEnv}
                  onChange={e => setMcpNewEnv(e.target.value)}
                  placeholder={"API_KEY=xxx\nDEBUG=true"}
                  rows={2}
                />
              </div>
              <div className="claude-mcp-form-actions">
                <button type="button" className="claude-mcp-action-btn" onClick={() => setMcpAddingNew(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="claude-mcp-add-btn" disabled={!mcpNewName.trim() || !mcpNewCommand.trim()}>
                  {t('common.add')}
                </button>
              </div>
            </form>
          )}

          {installedCount === 0 ? (
            <div className="claude-mcp-empty">
              <div>{t('claude.mcpNoServers')}</div>
              <button className="mcp-catalog-install-btn" style={{ marginTop: 8 }} onClick={() => setView('catalog')}>
                {t('claude.mcpBrowseCatalog')}
              </button>
            </div>
          ) : (
            <div className="claude-mcp-server-list">
              {Object.entries(mcpServers).map(([name, config]) => {
                const catalogEntry = MCP_CATALOG.find(e => e.id === name)
                return (
                  <div key={name} className="claude-mcp-server-item">
                    <div className="claude-mcp-server-header">
                      <div className="claude-mcp-server-info">
                        <div className="claude-mcp-server-name">
                          {catalogEntry && <span className="mcp-server-cat-icon">{MCP_CATEGORY_ICONS[catalogEntry.category]}</span>}
                          {name}
                          {catalogEntry?.official && <span className="mcp-catalog-badge-official" title="Official">MCP</span>}
                        </div>
                        {catalogEntry && (
                          <div className="mcp-server-description">{catalogEntry.description}</div>
                        )}
                        <div className="claude-mcp-server-command">
                          {config.command}{config.args ? ' ' + config.args.join(' ') : ''}
                        </div>
                        {config.env && Object.keys(config.env).length > 0 && (
                          <div className="claude-mcp-server-env-chips">
                            {Object.keys(config.env).map(key => (
                              <span key={key} className="claude-mcp-env-chip">{key}</span>
                            ))}
                          </div>
                        )}
                        {catalogEntry && (
                          <div className="mcp-server-features">
                            {catalogEntry.features.slice(0, 6).map(f => (
                              <span key={f} className="mcp-catalog-feature-chip">{f}</span>
                            ))}
                            {catalogEntry.features.length > 6 && (
                              <span className="mcp-catalog-feature-chip mcp-catalog-feature-more">+{catalogEntry.features.length - 6}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="claude-mcp-server-actions">
                        <button className="claude-mcp-action-btn" onClick={() => handleGetMcpHelp(name)}>
                          {mcpExpandedHelp === name ? t('claude.mcpHideHelp') : t('claude.mcpShowHelp')}
                        </button>
                        <button className="claude-mcp-action-btn claude-mcp-action-btn--danger" onClick={() => handleRemoveMcpServer(name)}>
                          {t('claude.mcpRemoveServer')}
                        </button>
                      </div>
                    </div>
                    {mcpExpandedHelp === name && (
                      <div className="claude-mcp-help-panel">
                        {mcpHelpData[name]?.loading && (
                          <div className="claude-mcp-help-loading">{t('claude.mcpHelpLoading')}</div>
                        )}
                        {mcpHelpData[name]?.error && (
                          <CopyableError
                            error={`${t('claude.mcpHelpError')}: ${mcpHelpData[name].error}`}
                            className="claude-mcp-help-error-copyable"
                          />
                        )}
                        {mcpHelpData[name]?.output && (
                          <McpHelpOutput text={mcpHelpData[name].output!} />
                        )}
                        {!mcpHelpData[name]?.loading && !mcpHelpData[name]?.output && !mcpHelpData[name]?.error && (
                          <div className="claude-mcp-help-loading">{t('claude.mcpHelpEmpty')}</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
