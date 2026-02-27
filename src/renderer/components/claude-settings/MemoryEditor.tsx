import { useState, useCallback, useRef } from 'react'
import Editor, { BeforeMount, OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface Props {
  title: string
  content: string
  readOnly?: boolean
  onSave?: (content: string) => Promise<void>
}

export function MemoryEditor({ title, content, readOnly, onSave }: Props) {
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
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
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    const val = editorRef.current?.getValue() ?? content
    setSaving(true)
    await onSave(val)
    setDirty(false)
    setSaving(false)
  }, [content, onSave])

  const handleMount: OnMount = useCallback((ed) => {
    editorRef.current = ed
    if (!readOnly) {
      ed.addAction({
        id: 'save-memory',
        label: 'Save',
        keybindings: [2048 | 49],
        run: () => { handleSave() },
      })
    }
  }, [readOnly, handleSave])

  return (
    <div className="cs-memory-editor">
      <div className="claude-rules-editor-header" style={{ padding: '6px 12px' }}>
        <span className="claude-rules-editor-title" style={{ fontSize: 12 }}>{title}</span>
        {dirty && <span className="file-viewer-dirty-dot" />}
        {!readOnly && onSave && (
          <button className="file-viewer-save-btn" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? '...' : 'Save'}
          </button>
        )}
      </div>
      <Editor
        key={title}
        defaultValue={content}
        language="markdown"
        theme="catppuccin-mocha"
        onChange={() => { if (!dirty) setDirty(true) }}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          fontFamily: 'Menlo',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 6 },
          wordWrap: 'on',
          readOnly,
        }}
      />
    </div>
  )
}
