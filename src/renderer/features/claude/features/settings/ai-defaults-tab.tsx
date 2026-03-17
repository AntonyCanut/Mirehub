import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../../../lib/i18n'
import { AI_PROVIDERS } from '../../../../../shared/types/ai-provider'
import type { AiProviderId } from '../../../../../shared/types/ai-provider'
import type { AiDefaults } from '../../../../../shared/types'
import { useWorkspaceStore } from '../../../../lib/stores/workspaceStore'

interface Props {
  projectId?: string
  workspaceId?: string
}

function ProviderSelector({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: AiProviderId
  onChange: (id: AiProviderId) => void
}) {
  return (
    <div className="ai-defaults-row">
      <div className="ai-defaults-info">
        <span className="ai-defaults-label">{label}</span>
        <span className="ai-defaults-desc">{description}</span>
      </div>
      <div className="ai-defaults-btns">
        {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => (
          <button
            key={id}
            className={`ai-defaults-btn${value === id ? ' ai-defaults-btn--active' : ''}`}
            style={
              value === id
                ? { backgroundColor: AI_PROVIDERS[id].detectionColor, borderColor: AI_PROVIDERS[id].detectionColor, color: '#fff' }
                : undefined
            }
            onClick={() => onChange(id)}
          >
            {AI_PROVIDERS[id].displayName}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AiDefaultsTab({ projectId, workspaceId }: Props) {
  const { t } = useI18n()
  const [defaults, setDefaults] = useState<AiDefaults>({})
  const [loading, setLoading] = useState(true)
  const [propagated, setPropagated] = useState(false)

  const isWorkspaceMode = !projectId && !!workspaceId

  useEffect(() => {
    setLoading(true)
    if (projectId) {
      window.kanbai.aiDefaults.get(projectId).then((d: AiDefaults) => {
        setDefaults(d ?? {})
        setLoading(false)
      }).catch(() => setLoading(false))
    } else if (workspaceId) {
      window.kanbai.aiDefaults.getWorkspace(workspaceId).then((d: AiDefaults) => {
        setDefaults(d ?? {})
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [projectId, workspaceId])

  const save = useCallback(async (next: AiDefaults) => {
    setDefaults(next)
    setPropagated(false)

    if (projectId) {
      // Save to project
      await window.kanbai.aiDefaults.set(projectId, next as unknown as Record<string, unknown>)
      const { projects } = useWorkspaceStore.getState()
      const updated = projects.map((p) =>
        p.id === projectId ? { ...p, aiDefaults: next } : p,
      )
      useWorkspaceStore.setState({ projects: updated })

      // Also propagate to workspace if workspaceId is available
      if (workspaceId) {
        await window.kanbai.aiDefaults.setWorkspace(workspaceId, next as unknown as Record<string, unknown>)
        // Update workspace in store
        const { workspaces } = useWorkspaceStore.getState()
        const updatedWs = workspaces.map((w) =>
          w.id === workspaceId ? { ...w, aiDefaults: next } : w,
        )
        useWorkspaceStore.setState({ workspaces: updatedWs })
        setPropagated(true)
        setTimeout(() => setPropagated(false), 2000)
      }
    } else if (workspaceId) {
      // Workspace-only mode: save and propagate to all projects
      await window.kanbai.aiDefaults.setWorkspace(workspaceId, next as unknown as Record<string, unknown>)
      // Update workspace in store
      const { workspaces, projects } = useWorkspaceStore.getState()
      const updatedWs = workspaces.map((w) =>
        w.id === workspaceId ? { ...w, aiDefaults: next } : w,
      )
      // Update all projects in this workspace with merged defaults
      const updatedProjects = projects.map((p) => {
        if (p.workspaceId === workspaceId) {
          return { ...p, aiDefaults: { ...next, ...(p.aiDefaults ?? {}) } }
        }
        return p
      })
      useWorkspaceStore.setState({ workspaces: updatedWs, projects: updatedProjects })
      setPropagated(true)
      setTimeout(() => setPropagated(false), 2000)
    }
  }, [projectId, workspaceId])

  if (loading) {
    return <div className="file-viewer-empty">{t('common.loading')}</div>
  }

  const kanbanProvider: AiProviderId = defaults.kanban ?? 'claude'
  const packagesProvider: AiProviderId = defaults.packages ?? 'claude'
  const databaseProvider: AiProviderId = defaults.database ?? 'claude'

  const allSame = kanbanProvider === packagesProvider && packagesProvider === databaseProvider
  const globalProvider: AiProviderId = allSame ? kanbanProvider : 'claude'

  const setAll = (id: AiProviderId) => {
    save({
      ...defaults,
      kanban: id,
      packages: id,
      packagesModel: id === 'codex' ? 'gpt-5.1-codex-mini' : id === 'copilot' ? 'gpt-4o' : '',
      database: id,
      databaseModel: id === 'codex' ? 'gpt-5.1-codex-mini' : id === 'copilot' ? 'gpt-4o' : '',
    })
  }

  return (
    <div className="cs-general-tab">
      {isWorkspaceMode && (
        <div className="cs-general-section">
          <div className="cs-general-card" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('ai.defaults.workspaceMode')}
          </div>
        </div>
      )}

      <div className="cs-general-section">
        <div className="cs-general-section-header">{t('ai.defaults.allLabel')}</div>
        <div className="cs-general-card">
          <ProviderSelector
            label={t('ai.defaults.allLabel')}
            description={t('ai.defaults.allDesc')}
            value={allSame ? globalProvider : '' as AiProviderId}
            onChange={setAll}
          />
        </div>
      </div>

      <div className="cs-general-section">
        <div className="cs-general-section-header">{t('ai.defaults.kanban')}</div>
        <div className="cs-general-card">
          <ProviderSelector
            label={t('ai.defaults.kanbanLabel')}
            description={t('ai.defaults.kanbanDesc')}
            value={kanbanProvider}
            onChange={(id) => save({ ...defaults, kanban: id })}
          />
        </div>
      </div>

      <div className="cs-general-section">
        <div className="cs-general-section-header">{t('ai.defaults.packages')}</div>
        <div className="cs-general-card">
          <ProviderSelector
            label={t('ai.defaults.packagesLabel')}
            description={t('ai.defaults.packagesDesc')}
            value={packagesProvider}
            onChange={(id) => save({ ...defaults, packages: id, packagesModel: id === 'codex' ? 'gpt-5.1-codex-mini' : id === 'copilot' ? 'gpt-4o' : '' })}
          />
        </div>
      </div>

      <div className="cs-general-section">
        <div className="cs-general-section-header">{t('ai.defaults.database')}</div>
        <div className="cs-general-card">
          <ProviderSelector
            label={t('ai.defaults.databaseLabel')}
            description={t('ai.defaults.databaseDesc')}
            value={databaseProvider}
            onChange={(id) => save({ ...defaults, database: id, databaseModel: id === 'codex' ? 'gpt-5.1-codex-mini' : id === 'copilot' ? 'gpt-4o' : '' })}
          />
        </div>
      </div>

      {propagated && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--green)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, zIndex: 9999 }}>
          {t('ai.defaults.propagated')}
        </div>
      )}
    </div>
  )
}
