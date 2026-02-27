import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '../../lib/stores/workspaceStore'
import { useI18n } from '../../lib/i18n'
import { GeneralTab } from './GeneralTab'
import { SecuritySandboxTab } from './SecuritySandboxTab'
import { AgentsSkillsTab } from './AgentsSkillsTab'
import { IntegrationsTab } from './IntegrationsTab'
import { MemoryTab } from './MemoryTab'
import { WORKFLOW_MARKER } from '../../../shared/constants/defaultWorkflows'

type SubTab = 'general' | 'security' | 'agents' | 'integrations' | 'memory'

export function ClaudeSettingsPanel() {
  const { t } = useI18n()
  const { activeProjectId, projects, workspaces } = useWorkspaceStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeWorkspace = workspaces.find((w) => w.id === activeProject?.workspaceId)

  const [subTab, setSubTab] = useState<SubTab>('general')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [localSettings, setLocalSettings] = useState<Record<string, unknown> | null>(null)
  const [userSettings, setUserSettings] = useState<Record<string, unknown> | null>(null)
  const [managedSettings, setManagedSettings] = useState<Record<string, unknown> | null>(null)
  const [claudeMd, setClaudeMd] = useState('')
  const [loading, setLoading] = useState(true)
  const [settingsErrors, setSettingsErrors] = useState<string[]>([])
  const [fixingSettings, setFixingSettings] = useState(false)
  const [hooksStatus, setHooksStatus] = useState<{ installed: boolean; upToDate: boolean }>({ installed: false, upToDate: false })
  const [installingHooks, setInstallingHooks] = useState(false)
  const [removingHooks, setRemovingHooks] = useState(false)
  const [workflowDeployed, setWorkflowDeployed] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<'project' | 'local'>('project')
  const [mcpServers, setMcpServers] = useState<Record<string, { command: string; args?: string[]; env?: Record<string, string> } | { type: 'http'; url: string; headers?: Record<string, string> }>>({})

  const loadData = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const result = await window.mirehub.project.scanClaude(activeProject.path)
      if (result.settings) {
        const s = result.settings as Record<string, unknown>
        if (s._mirehubMode && typeof s.permissions === 'object' && s.permissions !== null) {
          const perms = s.permissions as Record<string, unknown>
          if (!perms.defaultMode) {
            perms.defaultMode = s._mirehubMode
            delete s._mirehubMode
            await window.mirehub.project.writeClaudeSettings(activeProject.path, s)
          }
        }
        setSettings(s)
        const servers = s.mcpServers as Record<string, { command: string; args?: string[]; env?: Record<string, string> } | { type: 'http'; url: string; headers?: Record<string, string> }> | undefined
        setMcpServers(servers ?? {})
      } else {
        setSettings({})
        setMcpServers({})
      }
      setLocalSettings(result.localSettings ?? null)
      setUserSettings(result.userSettings ?? null)
      try {
        const managed = await window.mirehub.project.readManagedSettings()
        setManagedSettings(managed)
      } catch { setManagedSettings(null) }

      const md = result.claudeMd ?? ''
      setClaudeMd(md)
      setWorkflowDeployed(md.includes(WORKFLOW_MARKER))

      const wsName = activeWorkspace?.name
      const validation = await window.mirehub.claude.validateSettings(activeProject.path, wsName)
      setSettingsErrors(validation.errors)
      const hs = await window.mirehub.claude.checkHooksStatus(activeProject.path, wsName)
      setHooksStatus(hs)
    } catch {
      setSettings({})
      setClaudeMd('')
      setSettingsErrors([])
    }
    setLoading(false)
  }, [activeProject, activeWorkspace])

  useEffect(() => { loadData() }, [loadData])

  const writeSettings = useCallback(async (newSettings: Record<string, unknown>) => {
    if (!activeProject) return
    setSettings(newSettings)
    if (settingsTarget === 'local') {
      await window.mirehub.project.writeClaudeLocalSettings(activeProject.path, newSettings)
    } else {
      await window.mirehub.project.writeClaudeSettings(activeProject.path, newSettings)
    }
  }, [activeProject, settingsTarget])

  const handleFixSettings = useCallback(async () => {
    if (!activeProject) return
    setFixingSettings(true)
    await window.mirehub.claude.fixSettings(activeProject.path, activeWorkspace?.name)
    await loadData()
    setFixingSettings(false)
  }, [activeProject, activeWorkspace, loadData])

  const handleInstallHooks = useCallback(async () => {
    if (!activeProject) return
    setInstallingHooks(true)
    await window.mirehub.claude.installHooks(activeProject.path, activeWorkspace?.name)
    const hs = await window.mirehub.claude.checkHooksStatus(activeProject.path, activeWorkspace?.name)
    setHooksStatus(hs)
    setInstallingHooks(false)
  }, [activeProject, activeWorkspace])

  const handleUpdateHooks = useCallback(async () => {
    if (!activeProject) return
    setInstallingHooks(true)
    await window.mirehub.claude.installHooks(activeProject.path, activeWorkspace?.name)
    const hs = await window.mirehub.claude.checkHooksStatus(activeProject.path, activeWorkspace?.name)
    setHooksStatus(hs)
    setInstallingHooks(false)
  }, [activeProject, activeWorkspace])

  const handleRemoveHooks = useCallback(async () => {
    if (!activeProject) return
    setRemovingHooks(true)
    await window.mirehub.claude.removeHooks(activeProject.path, activeWorkspace?.name)
    const hs = await window.mirehub.claude.checkHooksStatus(activeProject.path, activeWorkspace?.name)
    setHooksStatus(hs)
    setRemovingHooks(false)
  }, [activeProject, activeWorkspace])

  const handleExportConfig = useCallback(async () => {
    if (!activeProject) return
    await window.mirehub.project.exportClaudeConfig(activeProject.path)
  }, [activeProject])

  const handleImportConfig = useCallback(async () => {
    if (!activeProject) return
    const result = await window.mirehub.project.importClaudeConfig(activeProject.path)
    if (result.success) await loadData()
  }, [activeProject, loadData])

  const handleMcpServersChange = useCallback((newServers: Record<string, { command: string; args?: string[]; env?: Record<string, string> } | { type: 'http'; url: string; headers?: Record<string, string> }>, newSettings: Record<string, unknown>) => {
    setMcpServers(newServers)
    setSettings(newSettings)
  }, [])

  const handleSaveClaudeMd = useCallback(async (content: string) => {
    if (!activeProject) return
    await window.mirehub.project.writeClaudeMd(activeProject.path, content)
    setClaudeMd(content)
    setWorkflowDeployed(content.includes(WORKFLOW_MARKER))
  }, [activeProject])

  const mcpServerKeys = useMemo(() => Object.keys(mcpServers), [mcpServers])

  // suppress unused vars
  void handleSaveClaudeMd
  void localSettings
  void userSettings
  void managedSettings
  void settingsTarget
  void setSettingsTarget

  if (!activeProject) {
    return <div className="file-viewer-empty">{t('claude.noActiveProject')}</div>
  }
  if (loading) {
    return <div className="file-viewer-empty">{t('common.loading')}</div>
  }

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'general', label: t('claude.generalTab') },
    { key: 'security', label: t('claude.securityTab') },
    { key: 'agents', label: t('claude.agentsTab') },
    { key: 'integrations', label: t('claude.integrationsTab') },
    { key: 'memory', label: t('claude.memoryTab') },
  ]

  return (
    <div className="claude-rules-panel">
      <div className="claude-rules-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`claude-rules-tab${subTab === tab.key ? ' claude-rules-tab--active' : ''}`}
            onClick={() => setSubTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="claude-rules-content">
        {subTab === 'general' && (
          <GeneralTab
            settings={settings}
            settingsErrors={settingsErrors}
            fixingSettings={fixingSettings}
            hooksStatus={hooksStatus}
            installingHooks={installingHooks}
            removingHooks={removingHooks}
            projectPath={activeProject.path}
            onFixSettings={handleFixSettings}
            onInstallHooks={handleInstallHooks}
            onUpdateHooks={handleUpdateHooks}
            onRemoveHooks={handleRemoveHooks}
            onSettingsChange={writeSettings}
            onExportConfig={handleExportConfig}
            onImportConfig={handleImportConfig}
          />
        )}
        {subTab === 'security' && (
          <SecuritySandboxTab
            settings={settings}
            mcpServerKeys={mcpServerKeys}
            onSettingsChange={writeSettings}
          />
        )}
        {subTab === 'agents' && (
          <AgentsSkillsTab
            projectPath={activeProject.path}
            onDeploySuccess={loadData}
          />
        )}
        {subTab === 'integrations' && (
          <IntegrationsTab
            settings={settings}
            mcpServers={mcpServers}
            projectPath={activeProject.path}
            claudeMd={claudeMd}
            workflowDeployed={workflowDeployed}
            onSettingsChange={writeSettings}
            onMcpServersChange={handleMcpServersChange}
            onClaudeMdChange={setClaudeMd}
            onWorkflowDeployedChange={setWorkflowDeployed}
          />
        )}
        {subTab === 'memory' && (
          <MemoryTab projectPath={activeProject.path} />
        )}
      </div>
    </div>
  )
}
