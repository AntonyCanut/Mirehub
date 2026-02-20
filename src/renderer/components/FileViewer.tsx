import { useEffect, useState, useCallback, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useViewStore } from '../lib/stores/viewStore'

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.md': 'markdown',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'plaintext',
  '.xml': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.svg': 'xml',
  '.scss': 'scss',
  '.less': 'less',
}

function getLanguage(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return 'plaintext'
  const ext = filePath.slice(dot).toLowerCase()
  return EXT_TO_LANGUAGE[ext] || 'plaintext'
}

export function FileViewer() {
  const { selectedFilePath, setViewMode, isEditorDirty, setEditorDirty } = useViewStore()
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (!selectedFilePath) return
    // Reset content immediately to avoid showing stale data
    setContent(null)
    setLoading(true)
    setError(null)
    setEditorDirty(false)
    window.theone.fs
      .readFile(selectedFilePath)
      .then((result: { content: string | null; error: string | null }) => {
        if (result.error) {
          setError(result.error)
          setContent(null)
        } else {
          // Treat null content as empty string for display
          setContent(result.content ?? '')
          setError(null)
        }
      })
      .catch((err: unknown) => {
        setError(String(err))
        setContent(null)
      })
      .finally(() => setLoading(false))
  }, [selectedFilePath, setEditorDirty])

  const handleSave = useCallback(async () => {
    if (!selectedFilePath || !editorRef.current) return
    const value = editorRef.current.getValue()
    setSaving(true)
    try {
      const result = await window.theone.fs.writeFile(selectedFilePath, value)
      if (result.success) {
        setEditorDirty(false)
      } else {
        setError(result.error || 'Erreur lors de la sauvegarde')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }, [selectedFilePath, setEditorDirty])

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor

    // Cmd+S shortcut
    editor.addAction({
      id: 'save-file',
      label: 'Enregistrer',
      keybindings: [
        // Monaco KeyMod.CtrlCmd | Monaco KeyCode.KeyS
        2048 | 49, // CtrlCmd = 2048, KeyS = 49
      ],
      run: () => {
        handleSave()
      },
    })
  }, [handleSave])

  const handleChange = useCallback(() => {
    if (!isEditorDirty) {
      setEditorDirty(true)
    }
  }, [isEditorDirty, setEditorDirty])

  if (!selectedFilePath) {
    return (
      <div className="file-viewer-empty">
        Aucun fichier selectionne
      </div>
    )
  }

  const fileName = selectedFilePath.split('/').pop() ?? selectedFilePath
  const language = getLanguage(selectedFilePath)

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-name">{fileName}</span>
        {isEditorDirty && <span className="file-viewer-dirty-dot" title="Modifie" />}
        <span className="file-viewer-path" title={selectedFilePath}>{selectedFilePath}</span>
        <button
          className="file-viewer-save-btn"
          onClick={handleSave}
          disabled={!isEditorDirty || saving}
          title="Enregistrer (Cmd+S)"
        >
          {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
        <button
          className="file-viewer-close btn-icon"
          onClick={() => setViewMode('terminal')}
          title="Fermer"
        >
          &times;
        </button>
      </div>
      <div className="file-viewer-editor">
        {loading && <div className="file-viewer-loading">Chargement...</div>}
        {error && <div className="file-viewer-error">{error}</div>}
        {content !== null && !loading && (
          <Editor
            key={selectedFilePath}
            value={content}
            language={language}
            theme="catppuccin-mocha"
            onChange={handleChange}
            onMount={handleEditorMount}
            beforeMount={(monaco) => {
              monaco.editor.defineTheme('catppuccin-mocha', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                  // General
                  { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
                  { token: 'keyword', foreground: 'cba6f7' },
                  { token: 'keyword.control', foreground: 'cba6f7' },
                  { token: 'string', foreground: 'a6e3a1' },
                  { token: 'number', foreground: 'fab387' },
                  { token: 'type', foreground: '89b4fa' },
                  { token: 'type.identifier', foreground: '89b4fa' },
                  { token: 'function', foreground: '89b4fa' },
                  { token: 'variable', foreground: 'cdd6f4' },
                  { token: 'variable.predefined', foreground: 'f38ba8' },
                  { token: 'operator', foreground: '89dceb' },
                  { token: 'delimiter', foreground: '9399b2' },
                  { token: 'delimiter.bracket', foreground: '9399b2' },
                  { token: 'delimiter.parenthesis', foreground: '9399b2' },
                  { token: 'delimiter.square', foreground: '9399b2' },
                  { token: 'delimiter.curly', foreground: '9399b2' },
                  { token: 'constant', foreground: 'fab387' },
                  { token: 'regexp', foreground: 'f38ba8' },
                  { token: 'annotation', foreground: 'f9e2af' },
                  { token: 'namespace', foreground: '94e2d5' },
                  // JSON specific
                  { token: 'string.key.json', foreground: '89b4fa' },
                  { token: 'string.value.json', foreground: 'a6e3a1' },
                  { token: 'number.json', foreground: 'fab387' },
                  { token: 'keyword.json', foreground: 'fab387' },
                  { token: 'delimiter.bracket.json', foreground: 'f9e2af' },
                  { token: 'delimiter.colon.json', foreground: '9399b2' },
                  { token: 'delimiter.comma.json', foreground: '9399b2' },
                  // HTML/XML
                  { token: 'tag', foreground: 'f38ba8' },
                  { token: 'tag.id', foreground: 'f38ba8' },
                  { token: 'tag.class', foreground: 'f38ba8' },
                  { token: 'attribute.name', foreground: 'f9e2af' },
                  { token: 'attribute.value', foreground: 'a6e3a1' },
                  // CSS
                  { token: 'selector', foreground: 'cba6f7' },
                  { token: 'property', foreground: '89b4fa' },
                  // Markdown
                  { token: 'markup.heading', foreground: 'f38ba8', fontStyle: 'bold' },
                  { token: 'markup.bold', foreground: 'fab387', fontStyle: 'bold' },
                  { token: 'markup.italic', foreground: 'f5c2e7', fontStyle: 'italic' },
                  { token: 'markup.inline', foreground: 'a6e3a1' },
                  { token: 'meta.content', foreground: 'cdd6f4' },
                ],
                colors: {
                  'editor.background': '#1e1e2e',
                  'editor.foreground': '#cdd6f4',
                  'editor.lineHighlightBackground': '#313244',
                  'editor.selectionBackground': '#45475a',
                  'editorCursor.foreground': '#f5e0dc',
                  'editorLineNumber.foreground': '#6c7086',
                  'editorLineNumber.activeForeground': '#cdd6f4',
                  'editor.inactiveSelectionBackground': '#31324480',
                  'editorBracketMatch.background': '#45475a',
                  'editorBracketMatch.border': '#89b4fa',
                  'editorIndentGuide.background': '#31324480',
                  'editorIndentGuide.activeBackground': '#45475a',
                  'editorWhitespace.foreground': '#31324480',
                  'editor.findMatchBackground': '#f9e2af40',
                  'editor.findMatchHighlightBackground': '#f9e2af20',
                  'editorGutter.background': '#1e1e2e',
                  'scrollbar.shadow': '#11111b',
                  'scrollbarSlider.background': '#45475a80',
                  'scrollbarSlider.hoverBackground': '#585b70',
                  'scrollbarSlider.activeBackground': '#6c7086',
                },
              })
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'Menlo, Monaco, "JetBrains Mono", "Fira Code", monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 },
              renderLineHighlight: 'line',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              readOnly: false,
            }}
          />
        )}
      </div>
    </div>
  )
}
