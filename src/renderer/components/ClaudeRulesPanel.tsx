import { useState, useEffect, useCallback, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'

type SubTab = 'permissions' | 'claudemd' | 'profile'

const PERMISSION_MODES = [
  { value: 'bypassPermissions', label: 'Bypass', desc: 'Aucune confirmation demandee', className: 'claude-perm--bypass' },
  { value: 'acceptEdits', label: 'Accept Edits', desc: 'Confirme uniquement les edits', className: 'claude-perm--accept' },
  { value: 'plan', label: 'Plan', desc: 'Demande approbation du plan', className: 'claude-perm--plan' },
  { value: 'default', label: 'Default', desc: 'Mode par defaut', className: 'claude-perm--default' },
]

const TOOL_SUGGESTIONS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit']

export function ClaudeRulesPanel() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const [subTab, setSubTab] = useState<SubTab>('permissions')
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [claudeMd, setClaudeMd] = useState('')
  const [claudeMdDirty, setClaudeMdDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const loadData = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const result = await window.theone.project.scanClaude(activeProject.path)
      if (result.settings) {
        setSettings(result.settings)
      } else {
        setSettings({})
      }
      setClaudeMd(result.claudeMd ?? '')
      setClaudeMdDirty(false)
    } catch {
      setSettings({})
      setClaudeMd('')
    }
    setLoading(false)
  }, [activeProject])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Permissions
  const permissionMode = (settings as { permissions?: string }).permissions ?? 'default'
  const allowList: string[] = (settings as { allow?: string[] }).allow ?? []
  const denyList: string[] = (settings as { deny?: string[] }).deny ?? []

  const handlePermissionChange = useCallback(async (mode: string) => {
    if (!activeProject) return
    const newSettings = { ...settings, permissions: mode }
    setSettings(newSettings)
    await window.theone.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject, settings])

  const handleAddAllow = useCallback(async (tool: string) => {
    if (!activeProject || allowList.includes(tool)) return
    const newAllow = [...allowList, tool]
    const newSettings = { ...settings, allow: newAllow }
    setSettings(newSettings)
    await window.theone.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject, settings, allowList])

  const handleRemoveAllow = useCallback(async (tool: string) => {
    if (!activeProject) return
    const newAllow = allowList.filter((t) => t !== tool)
    const newSettings = { ...settings, allow: newAllow }
    setSettings(newSettings)
    await window.theone.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject, settings, allowList])

  const handleAddDeny = useCallback(async (tool: string) => {
    if (!activeProject || denyList.includes(tool)) return
    const newDeny = [...denyList, tool]
    const newSettings = { ...settings, deny: newDeny }
    setSettings(newSettings)
    await window.theone.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject, settings, denyList])

  const handleRemoveDeny = useCallback(async (tool: string) => {
    if (!activeProject) return
    const newDeny = denyList.filter((t) => t !== tool)
    const newSettings = { ...settings, deny: newDeny }
    setSettings(newSettings)
    await window.theone.project.writeClaudeSettings(activeProject.path, newSettings)
  }, [activeProject, settings, denyList])

  // CLAUDE.md save
  const handleSaveClaudeMd = useCallback(async () => {
    if (!activeProject) return
    setSaving(true)
    const content = editorRef.current?.getValue() ?? claudeMd
    await window.theone.project.writeClaudeMd(activeProject.path, content)
    setClaudeMdDirty(false)
    setSaving(false)
  }, [activeProject, claudeMd])

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.addAction({
      id: 'save-claude-md',
      label: 'Enregistrer CLAUDE.md',
      keybindings: [2048 | 49],
      run: () => { handleSaveClaudeMd() },
    })
  }, [handleSaveClaudeMd])

  // Profile sections
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
    return <div className="file-viewer-empty">Aucun projet actif</div>
  }

  if (loading) {
    return <div className="file-viewer-empty">Chargement...</div>
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
          Permissions
        </button>
        <button
          className={`claude-rules-tab${subTab === 'claudemd' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('claudemd')}
        >
          CLAUDE.md
          {claudeMdDirty && <span className="file-viewer-dirty-dot" style={{ marginLeft: 4, display: 'inline-block' }} />}
        </button>
        <button
          className={`claude-rules-tab${subTab === 'profile' ? ' claude-rules-tab--active' : ''}`}
          onClick={() => setSubTab('profile')}
        >
          Profil & Skills
        </button>
      </div>
      <div className="claude-rules-content">
        {subTab === 'permissions' && (
          <div className="claude-rules-permissions">
            <div className="claude-rules-section">
              <label className="claude-rules-label">Mode de permission</label>
              <div className="claude-rules-mode-list">
                {PERMISSION_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    className={`claude-rules-mode-btn${permissionMode === mode.value ? ' claude-rules-mode-btn--active' : ''} ${mode.className}`}
                    onClick={() => handlePermissionChange(mode.value)}
                  >
                    <span className="claude-rules-mode-name">{mode.label}</span>
                    <span className="claude-rules-mode-desc">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="claude-rules-section">
              <label className="claude-rules-label">Outils autorises</label>
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
              <label className="claude-rules-label">Outils bloques</label>
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
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
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
            {claudeMd ? (
              parseSections(claudeMd).map((section, i) => (
                <div key={i} className="claude-rules-profile-section">
                  <div className="claude-rules-profile-header">
                    <span className="claude-rules-profile-title">{section.title}</span>
                    <button
                      className="claude-rules-copy-btn"
                      onClick={() => navigator.clipboard.writeText(section.content.trim())}
                      title="Copier cette section"
                    >
                      Copier
                    </button>
                  </div>
                  <pre className="claude-rules-profile-content">{section.content.trim()}</pre>
                </div>
              ))
            ) : (
              <div className="claude-rules-empty">Aucun CLAUDE.md trouve</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
