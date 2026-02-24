import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useI18n } from '../lib/i18n'
import { SessionHistory } from './SessionHistory'
import { ClaudeDefaultsLibrary } from './ClaudeDefaultsLibrary'
import { DEFAULT_WORKFLOWS, WORKFLOW_MARKER, generateWorkflowMarkdown } from '../../shared/constants/defaultWorkflows'

type SubTab = 'permissions' | 'claudemd' | 'profile' | 'mcp' | 'history' | 'library' | 'workflow'

interface AgentFile {
  name: string
  filename: string
}

const PERMISSION_MODES = [
  { value: 'bypassPermissions', label: 'Bypass', descKey: 'claude.noConfirmation', className: 'claude-perm--bypass' },
  { value: 'acceptEdits', label: 'Accept Edits', descKey: 'claude.confirmEditsOnly', className: 'claude-perm--accept' },
  { value: 'plan', label: 'Plan', descKey: 'claude.planApproval', className: 'claude-perm--plan' },
  { value: 'default', label: 'Default', descKey: 'claude.defaultMode', className: 'claude-perm--default' },
]

const TOOL_SUGGESTIONS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit']

export function ClaudeRulesPanel() {
  const { t, locale } = useI18n()
  const { activeProjectId, projects, workspaces } = useWorkspaceStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeWorkspace = workspaces.find((w) => w.id === activeProject?.workspaceId)

  const [subTab, setSubTab] = useState<SubTab>('permissions')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [claudeMd, setClaudeMd] = useState('')
  const [claudeMdDirty, setClaudeMdDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  // Profile & Skills state
  const [agents, setAgents] = useState<AgentFile[]>([])
  const [skills, setSkills] = useState<AgentFile[]>([])
  const [editingItem, setEditingItem] = useState<{ type: 'agent' | 'skill'; filename: string; content: string; isNew: boolean } | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [settingsErrors, setSettingsErrors] = useState<string[]>([])
  const [fixingSettings, setFixingSettings] = useState(false)
  const [hooksInstalled, setHooksInstalled] = useState(false)
  const [installingHooks, setInstallingHooks] = useState(false)

  // MCP state
  const [mcpServers, setMcpServers] = useState<Record<string, { command: string; args?: string[]; env?: Record<string, string> }>>({})
  const [mcpAddingNew, setMcpAddingNew] = useState(false)
  const [mcpNewName, setMcpNewName] = useState('')
  const [mcpNewCommand, setMcpNewCommand] = useState('')
  const [mcpNewArgs, setMcpNewArgs] = useState('')
  const [mcpNewEnv, setMcpNewEnv] = useState('')
  const [mcpHelpData, setMcpHelpData] = useState<Record<string, { loading: boolean; output?: string; error?: string }>>({})
  const [mcpExpandedHelp, setMcpExpandedHelp] = useState<string | null>(null)

  // Workflow state
  const [workflowDeployed, setWorkflowDeployed] = useState(false)
  const [workflowDeploying, setWorkflowDeploying] = useState(false)
  const [workflowExpandedSections, setWorkflowExpandedSections] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const result = await window.mirehub.project.scanClaude(activeProject.path)
      if (result.settings) {
        setSettings(result.settings)
        const servers = (result.settings as Record<string, unknown>).mcpServers as Record<string, { command: string; args?: string[]; env?: Record<string, string> }> | undefined
        setMcpServers(servers ?? {})
      } else {
        setSettings({})
        setMcpServers({})
      }
      const md = result.claudeMd ?? ''
      setClaudeMd(md)
      setClaudeMdDirty(false)
      setWorkflowDeployed(md.includes(WORKFLOW_MARKER))

      // Validate settings (project + workspace env)
      const wsName = activeWorkspace?.name
      const validation = await window.mirehub.claude.validateSettings(activeProject.path, wsName)
      setSettingsErrors(validation.errors)

      // Check if hooks are already installed
      const hooksStatus = await window.mirehub.claude.checkHooks(activeProject.path, wsName)
      setHooksInstalled(hooksStatus.installed)
    } catch {
      setSettings({})
      setClaudeMd('')
      setSettingsErrors([])
    }
    setLoading(false)
  }, [activeProject, activeWorkspace])

  const handleFixSettings = useCallback(async () => {
    if (!activeProject) return
    setFixingSettings(true)
    const wsName = activeWorkspace?.name
    await window.mirehub.claude.fixSettings(activeProject.path, wsName)
    // Reload data after fix
    await loadData()
    setFixingSettings(false)
  }, [activeProject, activeWorkspace, loadData])

  const handleInstallHooks = useCallback(async () => {
    if (!activeProject) return
    setInstallingHooks(true)
    const wsName = activeWorkspace?.name
    await window.mirehub.claude.installHooks(activeProject.path, wsName)
    // Verify hooks are actually installed after the operation
    const hooksStatus = await window.mirehub.claude.checkHooks(activeProject.path, wsName)
    setHooksInstalled(hooksStatus.installed)
    setInstallingHooks(false)
  }, [activeProject, activeWorkspace])

  // MCP handlers
  const handleAddMcpServer = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!activeProject || !mcpNewName.trim() || !mcpNewCommand.trim()) return
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
    setMcpServers(newServers)
    const newSettings = { ...settings, mcpServers: newServers }
    setSettings(newSettings)
    await window.mirehub.project.writeClaudeSettings(activeProject.path, newSettings)
    setMcpNewName('')
    setMcpNewCommand('')
    setMcpNewArgs('')
    setMcpNewEnv('')
    setMcpAddingNew(false)
  }, [activeProject, mcpNewName, mcpNewCommand, mcpNewArgs, mcpNewEnv, mcpServers, settings])

  const handleRemoveMcpServer = useCallback(async (name: string) => {
    if (!activeProject) return
    const newServers = { ...mcpServers }
    delete newServers[name]
    setMcpServers(newServers)
    const newSettings = { ...settings }
    if (Object.keys(newServers).length > 0) {
      newSettings.mcpServers = newServers
    } else {
      delete newSettings.mcpServers
    }
    setSettings(newSettings)
    await window.mirehub.project.writeClaudeSettings(activeProject.path, newSettings)
    if (mcpExpandedHelp === name) setMcpExpandedHelp(null)
  }, [activeProject, mcpServers, settings, mcpExpandedHelp])

  // Workflow handlers
  const handleDeployWorkflow = useCallback(async () => {
    if (!activeProject) return
    setWorkflowDeploying(true)
    try {
      const result = await window.mirehub.project.scanClaude(activeProject.path)
      const currentMd = result.claudeMd ?? ''
      if (!currentMd.includes(WORKFLOW_MARKER)) {
        const workflow = DEFAULT_WORKFLOWS[locale] ?? DEFAULT_WORKFLOWS.fr
        const workflowMd = generateWorkflowMarkdown(workflow)
        const newMd = currentMd.trim() ? currentMd.trim() + '\n\n' + workflowMd : workflowMd
        await window.mirehub.project.writeClaudeMd(activeProject.path, newMd)
        setClaudeMd(newMd)
        setWorkflowDeployed(true)
      }
    } catch { /* ignore */ }
    setWorkflowDeploying(false)
  }, [activeProject, locale])

  const handleRemoveWorkflow = useCallback(async () => {
    if (!activeProject) return
    setWorkflowDeploying(true)
    try {
      const result = await window.mirehub.project.scanClaude(activeProject.path)
      const currentMd = result.claudeMd ?? ''
      if (currentMd.includes(WORKFLOW_MARKER)) {
        const markerIdx = currentMd.indexOf(WORKFLOW_MARKER)
        const newMd = currentMd.slice(0, markerIdx).trimEnd()
        await window.mirehub.project.writeClaudeMd(activeProject.path, newMd)
        setClaudeMd(newMd)
        setWorkflowDeployed(false)
      }
    } catch { /* ignore */ }
    setWorkflowDeploying(false)
  }, [activeProject])

  const handleDeployWorkflowAll = useCallback(async () => {
    if (!activeWorkspace) return
    setWorkflowDeploying(true)
    const wsProjects = projects.filter(p => p.workspaceId === activeWorkspace.id && p.hasClaude)
    const workflow = DEFAULT_WORKFLOWS[locale] ?? DEFAULT_WORKFLOWS.fr
    const workflowMd = generateWorkflowMarkdown(workflow)
    for (const proj of wsProjects) {
      try {
        const result = await window.mirehub.project.scanClaude(proj.path)
        const currentMd = result.claudeMd ?? ''
        if (!currentMd.includes(WORKFLOW_MARKER)) {
          const newMd = currentMd.trim() ? currentMd.trim() + '\n\n' + workflowMd : workflowMd
          await window.mirehub.project.writeClaudeMd(proj.path, newMd)
        }
      } catch { /* continue */ }
    }
    // Refresh current project state
    if (activeProject) {
      const result = await window.mirehub.project.scanClaude(activeProject.path)
      const md = result.claudeMd ?? ''
      setClaudeMd(md)
      setWorkflowDeployed(md.includes(WORKFLOW_MARKER))
    }
    setWorkflowDeploying(false)
  }, [activeWorkspace, projects, activeProject, locale])

  const toggleWorkflowSection = useCallback((sectionId: string) => {
    setWorkflowExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }, [])

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

  const loadAgentsAndSkills = useCallback(async () => {
    if (!activeProject) return
    try {
      const [agentList, skillList] = await Promise.all([
        window.mirehub.claudeAgents.list(activeProject.path),
        window.mirehub.claudeSkills.list(activeProject.path),
      ])
      setAgents(agentList)
      setSkills(skillList)
    } catch {
      setAgents([])
      setSkills([])
    }
  }, [activeProject])

  useEffect(() => {
    loadData()
    loadAgentsAndSkills()
  }, [loadData, loadAgentsAndSkills])

  // Permissions — Claude Code expects: { permissions: { allow: [...], deny: [...] } }
  const permsObj = (typeof settings.permissions === 'object' && settings.permissions !== null)
    ? settings.permissions as { allow?: string[]; deny?: string[] }
    : {}
  const allowList: string[] = permsObj.allow ?? []
  const denyList: string[] = permsObj.deny ?? []

  // Permission mode is stored in a separate key (not in permissions, which must be an object)
  const permissionMode: string = (settings as Record<string, unknown>)._mirehubMode as string ?? 'default'

  const writeSettings = useCallback(async (newSettings: Record<string, unknown>) => {
    if (!activeProject) return
    setSettings(newSettings)
    await window.mirehub.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject])

  const handlePermissionChange = useCallback(async (mode: string) => {
    if (!activeProject) return
    const newSettings: Record<string, unknown> = { ...settings, _mirehubMode: mode }
    // Never write permissions as a string
    if (typeof newSettings.permissions === 'string') {
      newSettings.permissions = { allow: [], deny: [] }
    }
    await writeSettings(newSettings)
  }, [activeProject, settings, writeSettings])

  const handleAddAllow = useCallback(async (tool: string) => {
    if (!activeProject || allowList.includes(tool)) return
    const newAllow = [...allowList, tool]
    const newPerms = { ...permsObj, allow: newAllow }
    const newSettings = { ...settings, permissions: newPerms }
    await writeSettings(newSettings)
  }, [activeProject, settings, permsObj, allowList, writeSettings])

  const handleRemoveAllow = useCallback(async (tool: string) => {
    if (!activeProject) return
    const newAllow = allowList.filter((t) => t !== tool)
    const newPerms = { ...permsObj, allow: newAllow }
    const newSettings = { ...settings, permissions: newPerms }
    await writeSettings(newSettings)
  }, [activeProject, settings, permsObj, allowList, writeSettings])

  const handleAddDeny = useCallback(async (tool: string) => {
    if (!activeProject || denyList.includes(tool)) return
    const newDeny = [...denyList, tool]
    const newPerms = { ...permsObj, deny: newDeny }
    const newSettings = { ...settings, permissions: newPerms }
    await writeSettings(newSettings)
  }, [activeProject, settings, permsObj, denyList, writeSettings])

  const handleRemoveDeny = useCallback(async (tool: string) => {
    if (!activeProject) return
    const newDeny = denyList.filter((t) => t !== tool)
    const newPerms = { ...permsObj, deny: newDeny }
    const newSettings = { ...settings, permissions: newPerms }
    await writeSettings(newSettings)
  }, [activeProject, settings, permsObj, denyList, writeSettings])

  // CLAUDE.md save
  const handleSaveClaudeMd = useCallback(async () => {
    if (!activeProject) return
    setSaving(true)
    const content = editorRef.current?.getValue() ?? claudeMd
    await window.mirehub.project.writeClaudeMd(activeProject.path, content)
    setClaudeMdDirty(false)
    setSaving(false)
  }, [activeProject, claudeMd])

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.addAction({
      id: 'save-claude-md',
      label: t('claude.saveMd'),
      keybindings: [2048 | 49],
      run: () => { handleSaveClaudeMd() },
    })
  }, [handleSaveClaudeMd])

  // Agent & Skill actions
  const handleOpenItem = useCallback(async (type: 'agent' | 'skill', filename: string) => {
    if (!activeProject) return
    const content = type === 'agent'
      ? await window.mirehub.claudeAgents.read(activeProject.path, filename)
      : await window.mirehub.claudeSkills.read(activeProject.path, filename)
    setEditingItem({ type, filename, content: content ?? '', isNew: false })
    setEditingName(filename.replace(/\.md$/, ''))
    setEditingContent(content ?? '')
  }, [activeProject])

  const handleNewItem = useCallback((type: 'agent' | 'skill') => {
    setEditingItem({ type, filename: '', content: '', isNew: true })
    setEditingName('')
    setEditingContent(type === 'agent'
      ? '---\ndescription: Description of this agent\ntools: [Read, Edit, Write, Bash, Glob, Grep]\n---\n\nYou are a specialized agent.\n\nYour responsibilities:\n1. ...\n'
      : '---\ndescription: Description of this skill\n---\n\n# Skill Name\n\nInstructions for this skill.\n')
  }, [])

  const handleSaveItem = useCallback(async () => {
    if (!activeProject || !editingItem) return
    const name = editingName.trim()
    if (!name) return
    const filename = name.endsWith('.md') ? name : name + '.md'

    if (editingItem.type === 'agent') {
      await window.mirehub.claudeAgents.write(activeProject.path, filename, editingContent)
    } else {
      await window.mirehub.claudeSkills.write(activeProject.path, filename, editingContent)
    }

    // If renamed, delete old file
    if (!editingItem.isNew && editingItem.filename !== filename) {
      if (editingItem.type === 'agent') {
        await window.mirehub.claudeAgents.delete(activeProject.path, editingItem.filename)
      } else {
        await window.mirehub.claudeSkills.delete(activeProject.path, editingItem.filename)
      }
    }

    setEditingItem(null)
    await loadAgentsAndSkills()
  }, [activeProject, editingItem, editingName, editingContent, loadAgentsAndSkills])

  const handleDeleteItem = useCallback(async (type: 'agent' | 'skill', filename: string) => {
    if (!activeProject) return
    if (type === 'agent') {
      await window.mirehub.claudeAgents.delete(activeProject.path, filename)
    } else {
      await window.mirehub.claudeSkills.delete(activeProject.path, filename)
    }
    await loadAgentsAndSkills()
  }, [activeProject, loadAgentsAndSkills])

  // Profile sections parser
  const parseSections = (md: string): { title: string; content: string }[] => {
    const lines = md.split('\n')
    const sections: { title: string; content: string }[] = []
    let currentTitle = ''
    let currentLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('# ') || line.startsWith('## ')) {
        if (currentTitle || currentLines.length > 0) {
          sections.push({ title: currentTitle || 'Introduction', content: currentLines.join('\n') })
        }
        currentTitle = line.replace(/^#+\s*/, '')
        currentLines = []
      } else {
        currentLines.push(line)
      }
    }
    if (currentTitle || currentLines.length > 0) {
      sections.push({ title: currentTitle || 'Contenu', content: currentLines.join('\n') })
    }
    return sections
  }

  if (!activeProject) {
    return <div className="file-viewer-empty">{t('claude.noActiveProject')}</div>
  }

  if (loading) {
    return <div className="file-viewer-empty">{t('common.loading')}</div>
  }

  const availableSuggestionsAllow = TOOL_SUGGESTIONS.filter((t) => !allowList.includes(t))
  const availableSuggestionsDeny = TOOL_SUGGESTIONS.filter((t) => !denyList.includes(t))

  return (
    <div className="claude-rules-panel">
      <div className="claude-rules-tabs">
        <button
          className={`claude-rules-tab${subTab === 'permissions' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('permissions')}
        >
          {t('claude.permissions')}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'claudemd' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('claudemd')}
        >
          {t('claude.claudeMd')}
          {claudeMdDirty && <span className="file-viewer-dirty-dot" style={{ marginLeft: 4, display: 'inline-block' }} />}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'profile' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('profile')}
        >
          {t('claude.profileSkills')}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'mcp' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('mcp')}
        >
          {t('claude.mcp')}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'workflow' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('workflow')}
        >
          {t('claude.workflow')}
          {workflowDeployed && <span className="claude-workflow-badge-dot" />}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'library' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('library')}
        >
          {t('claude.library')}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'history' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('history')}
        >
          {t('claude.history')}
        </button>
      </div>
      <div className="claude-rules-content">
        {subTab === 'permissions' && (
          <div className="claude-rules-permissions">
            {settingsErrors.length > 0 && (
              <div className="claude-settings-error-banner">
                <div className="claude-settings-error-icon">&#x26A0;</div>
                <div className="claude-settings-error-body">
                  <div className="claude-settings-error-title">{t('claude.settingsError')}</div>
                  {settingsErrors.map((err, i) => (
                    <div key={i} className="claude-settings-error-detail">{err}</div>
                  ))}
                </div>
                <button
                  className="claude-settings-fix-btn"
                  onClick={handleFixSettings}
                  disabled={fixingSettings}
                >
                  {fixingSettings ? t('common.loading') : t('claude.fixSettings')}
                </button>
              </div>
            )}

            <div className="claude-rules-section claude-hooks-section">
              <div className="claude-hooks-row">
                <div className="claude-hooks-info">
                  <label className="claude-rules-label">{t('claude.activityHooks')}</label>
                  <span className="claude-hooks-desc">{t('claude.activityHooksDesc')}</span>
                </div>
                <button
                  className={`claude-hooks-btn${hooksInstalled ? ' claude-hooks-btn--success' : ''}`}
                  onClick={handleInstallHooks}
                  disabled={installingHooks || hooksInstalled}
                >
                  {hooksInstalled ? t('claude.hooksInstalled') : installingHooks ? t('common.loading') : t('claude.installHooks')}
                </button>
              </div>
            </div>

            <div className="claude-rules-section">
              <label className="claude-rules-label">{t('claude.permissionMode')}</label>
              <div className="claude-rules-mode-list">
                {PERMISSION_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    className={`claude-rules-mode-btn${permissionMode === mode.value ? ' claude-rules-mode-btn--active' : ''} ${mode.className}`}
                    onClick={() => handlePermissionChange(mode.value)}
                  >
                    <span className="claude-rules-mode-name">{mode.label}</span>
                    <span className="claude-rules-mode-desc">{t(mode.descKey)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="claude-rules-section">
              <label className="claude-rules-label">{t('claude.allowedTools')}</label>
              <div className="claude-rules-tool-chips">
                {allowList.map((tool) => (
                  <span key={tool} className="claude-rules-chip claude-rules-chip--allow">
                    {tool}
                    <button className="claude-rules-chip-remove" onClick={() => handleRemoveAllow(tool)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="claude-rules-tool-suggestions">
                {availableSuggestionsAllow.map((tool) => (
                  <button key={tool} className="claude-rules-suggest-btn" onClick={() => handleAddAllow(tool)}>+ {tool}</button>
                ))}
              </div>
            </div>
            <div className="claude-rules-section">
              <label className="claude-rules-label">{t('claude.blockedTools')}</label>
              <div className="claude-rules-tool-chips">
                {denyList.map((tool) => (
                  <span key={tool} className="claude-rules-chip claude-rules-chip--deny">
                    {tool}
                    <button className="claude-rules-chip-remove" onClick={() => handleRemoveDeny(tool)}>&times;</button>
                  </span>
                ))}
              </div>
              <div className="claude-rules-tool-suggestions">
                {availableSuggestionsDeny.map((tool) => (
                  <button key={tool} className="claude-rules-suggest-btn claude-rules-suggest-btn--deny" onClick={() => handleAddDeny(tool)}>+ {tool}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {subTab === 'claudemd' && (
          <div className="claude-rules-editor-wrap">
            <div className="claude-rules-editor-header">
              <span className="claude-rules-editor-title">CLAUDE.md</span>
              <button
                className="file-viewer-save-btn"
                onClick={handleSaveClaudeMd}
                disabled={!claudeMdDirty || saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
            <div className="claude-rules-editor">
              <Editor
                key={activeProject.path + '/CLAUDE.md'}
                defaultValue={claudeMd}
                language="markdown"
                theme="catppuccin-mocha"
                onChange={() => { if (!claudeMdDirty) setClaudeMdDirty(true) }}
                onMount={handleEditorMount}
                beforeMount={(monaco) => {
                  monaco.editor.defineTheme('catppuccin-mocha', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
                      { token: 'keyword', foreground: 'cba6f7' },
                      { token: 'string', foreground: 'a6e3a1' },
                    ],
                    colors: {
                      'editor.background': '#1e1e2e',
                      'editor.foreground': '#cdd6f4',
                      'editor.lineHighlightBackground': '#313244',
                      'editor.selectionBackground': '#45475a',
                      'editorCursor.foreground': '#f5e0dc',
                      'editorLineNumber.foreground': '#6c7086',
                      'editorLineNumber.activeForeground': '#cdd6f4',
                    },
                  })
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'Menlo',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                  wordWrap: 'on',
                }}
              />
            </div>
          </div>
        )}
        {subTab === 'profile' && (
          <div className="claude-rules-profile">
            {/* Editing modal */}
            {editingItem && (
              <div className="claude-profile-editor">
                <div className="claude-profile-editor-header">
                  <span className="claude-profile-editor-title">
                    {editingItem.isNew ? t('claude.newItem', { type: t('claude.' + editingItem.type) }) : t('claude.editItem', { type: t('claude.' + editingItem.type) })}
                  </span>
                  <button className="claude-profile-editor-close" onClick={() => setEditingItem(null)}>&times;</button>
                </div>
                <div className="claude-profile-editor-body">
                  <label className="claude-rules-label">{t('claude.fileName')}</label>
                  <input
                    className="claude-profile-editor-input"
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder={editingItem.type === 'agent' ? 'architect' : 'review-code'}
                  />
                  <span className="claude-profile-editor-hint">.md</span>
                  <label className="claude-rules-label" style={{ marginTop: 12 }}>{t('claude.content')}</label>
                  <textarea
                    className="claude-profile-editor-textarea"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={15}
                  />
                </div>
                <div className="claude-profile-editor-actions">
                  <button className="modal-btn modal-btn--secondary" onClick={() => setEditingItem(null)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    className="modal-btn modal-btn--primary"
                    onClick={handleSaveItem}
                    disabled={!editingName.trim()}
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}

            {!editingItem && (
              <>
                {/* Default profile (CLAUDE.md sections) */}
                <div className="claude-profile-section-group">
                  <div className="claude-profile-section-header">
                    <span className="claude-profile-section-title">{t('claude.defaultProfile')}</span>
                  </div>
                  {claudeMd ? (
                    parseSections(claudeMd).map((section, i) => (
                      <div key={i} className="claude-rules-profile-section">
                        <div className="claude-rules-profile-header">
                          <span className="claude-rules-profile-title">{section.title}</span>
                          <button
                            className="claude-rules-copy-btn"
                            onClick={() => navigator.clipboard.writeText(section.content.trim())}
                            title={t('claude.copySection')}
                          >
                            {t('common.copy')}
                          </button>
                        </div>
                        <pre className="claude-rules-profile-content">{section.content.trim()}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="claude-rules-empty">{t('claude.noClaudeMd')}</div>
                  )}
                </div>

                {/* Subagent profiles */}
                <div className="claude-profile-section-group">
                  <div className="claude-profile-section-header">
                    <span className="claude-profile-section-title">{t('claude.agentsSection')}</span>
                    <button className="claude-profile-add-btn" onClick={() => handleNewItem('agent')}>{t('claude.newAgent')}</button>
                  </div>
                  {agents.length === 0 ? (
                    <div className="claude-rules-empty">{t('claude.noAgents')}</div>
                  ) : (
                    <div className="claude-profile-file-list">
                      {agents.map((agent) => (
                        <div key={agent.filename} className="claude-profile-file-item">
                          <span className="claude-profile-file-icon">&#x1F916;</span>
                          <span className="claude-profile-file-name">{agent.name}</span>
                          <button
                            className="claude-profile-file-action"
                            onClick={() => handleOpenItem('agent', agent.filename)}
                            title={t('common.edit')}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className="claude-profile-file-action claude-profile-file-action--danger"
                            onClick={() => handleDeleteItem('agent', agent.filename)}
                            title={t('common.delete')}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills */}
                <div className="claude-profile-section-group">
                  <div className="claude-profile-section-header">
                    <span className="claude-profile-section-title">{t('claude.skillsSection')}</span>
                    <button className="claude-profile-add-btn" onClick={() => handleNewItem('skill')}>{t('claude.newSkill')}</button>
                  </div>
                  {skills.length === 0 ? (
                    <div className="claude-rules-empty">{t('claude.noSkills')}</div>
                  ) : (
                    <div className="claude-profile-file-list">
                      {skills.map((skill) => (
                        <div key={skill.filename} className="claude-profile-file-item">
                          <span className="claude-profile-file-icon">&#x2699;</span>
                          <span className="claude-profile-file-name">{skill.name}</span>
                          <button
                            className="claude-profile-file-action"
                            onClick={() => handleOpenItem('skill', skill.filename)}
                            title={t('common.edit')}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className="claude-profile-file-action claude-profile-file-action--danger"
                            onClick={() => handleDeleteItem('skill', skill.filename)}
                            title={t('common.delete')}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {subTab === 'mcp' && (
          <div className="claude-rules-mcp">
            <div className="claude-mcp-header">
              <span className="claude-mcp-title">{t('claude.mcpServers')}</span>
              {!mcpAddingNew && (
                <button className="claude-mcp-add-btn" onClick={() => setMcpAddingNew(true)}>
                  {t('claude.mcpAddServer')}
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

            {Object.keys(mcpServers).length === 0 ? (
              <div className="claude-mcp-empty">{t('claude.mcpNoServers')}</div>
            ) : (
              <div className="claude-mcp-server-list">
                {Object.entries(mcpServers).map(([name, config]) => (
                  <div key={name} className="claude-mcp-server-item">
                    <div className="claude-mcp-server-header">
                      <div className="claude-mcp-server-info">
                        <div className="claude-mcp-server-name">{name}</div>
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
                          <div className="claude-mcp-help-error">{t('claude.mcpHelpError')}: {mcpHelpData[name].error}</div>
                        )}
                        {mcpHelpData[name]?.output && (
                          <pre className="claude-mcp-help-output">{mcpHelpData[name].output}</pre>
                        )}
                        {!mcpHelpData[name]?.loading && !mcpHelpData[name]?.output && !mcpHelpData[name]?.error && (
                          <div className="claude-mcp-help-loading">{t('claude.mcpHelpEmpty')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {subTab === 'workflow' && (() => {
          const workflow = DEFAULT_WORKFLOWS[locale] ?? DEFAULT_WORKFLOWS.fr
          const claudeProjects = projects.filter(p => p.workspaceId === activeWorkspace?.id && p.hasClaude)
          return (
            <div className="claude-workflow">
              <div className="claude-workflow-header">
                <div className="claude-workflow-info">
                  <h3 className="claude-workflow-title">{t('claude.workflowTitle')}</h3>
                  <p className="claude-workflow-desc">{t('claude.workflowDesc')}</p>
                </div>
                <div className="claude-workflow-status">
                  {workflowDeployed ? (
                    <span className="claude-workflow-badge claude-workflow-badge--deployed">{t('claude.workflowDeployed')}</span>
                  ) : (
                    <span className="claude-workflow-badge claude-workflow-badge--not-deployed">{t('claude.workflowNotDeployed')}</span>
                  )}
                </div>
              </div>

              <div className="claude-workflow-actions">
                {workflowDeployed ? (
                  <button
                    className="claude-workflow-action-btn claude-workflow-action-btn--remove"
                    onClick={handleRemoveWorkflow}
                    disabled={workflowDeploying}
                  >
                    {workflowDeploying ? t('claude.workflowDeploying') : t('claude.workflowRemove')}
                  </button>
                ) : (
                  <button
                    className="claude-workflow-action-btn claude-workflow-action-btn--deploy"
                    onClick={handleDeployWorkflow}
                    disabled={workflowDeploying}
                  >
                    {workflowDeploying ? t('claude.workflowDeploying') : t('claude.workflowDeploy')}
                  </button>
                )}
                {claudeProjects.length > 1 && (
                  <button
                    className="claude-workflow-action-btn claude-workflow-action-btn--deploy-all"
                    onClick={handleDeployWorkflowAll}
                    disabled={workflowDeploying}
                  >
                    {t('claude.workflowDeployAll')}
                  </button>
                )}
              </div>

              <div className="claude-workflow-sections">
                {workflow.sections.map(section => (
                  <div key={section.id} className="claude-workflow-section">
                    <button
                      className="claude-workflow-section-header"
                      onClick={() => toggleWorkflowSection(section.id)}
                    >
                      <span className={`claude-workflow-section-chevron${workflowExpandedSections.has(section.id) ? ' claude-workflow-section-chevron--open' : ''}`}>&#x25B6;</span>
                      <span className="claude-workflow-section-title">{section.title}</span>
                      <span className="claude-workflow-section-count">{t('claude.workflowSection', { count: String(section.items.length) })}</span>
                    </button>
                    {workflowExpandedSections.has(section.id) && (
                      <ul className="claude-workflow-section-items">
                        {section.items.map((item, i) => (
                          <li key={i} className="claude-workflow-section-item">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
        {subTab === 'library' && (
          <ClaudeDefaultsLibrary onDeploySuccess={loadAgentsAndSkills} />
        )}
        {subTab === 'history' && (
          <SessionHistory />
        )}
      </div>
    </div>
  )
}
