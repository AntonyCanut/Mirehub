import React, { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import type { FileEntry } from '../../shared/types'
import '../styles/fileexplorer.css'

interface FileTreeNodeProps {
  entry: FileEntry
  depth: number
  onRename: (oldPath: string, newName: string) => void
}

function FileTreeNode({ entry, depth, onRename }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(entry.name)

  const handleToggle = useCallback(async () => {
    if (!entry.isDirectory) return

    if (!expanded) {
      setLoading(true)
      try {
        const entries = await window.theone.fs.readDir(entry.path)
        setChildren(entries)
      } catch {
        setChildren([])
      }
      setLoading(false)
    }
    setExpanded(!expanded)
  }, [entry.isDirectory, entry.path, expanded])

  const handleRenameStart = useCallback(() => {
    setIsRenaming(true)
    setRenameValue(entry.name)
  }, [entry.name])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== entry.name) {
      onRename(entry.path, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, entry.name, entry.path, onRename])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRenameSubmit()
      else if (e.key === 'Escape') setIsRenaming(false)
    },
    [handleRenameSubmit],
  )

  const getFileIcon = (name: string, isDir: boolean): string => {
    if (isDir) return '\u{1F4C1}'
    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
        return '\u{1F535}'
      case 'js':
      case 'jsx':
        return '\u{1F7E1}'
      case 'json':
        return '\u{1F7E2}'
      case 'css':
        return '\u{1F7E3}'
      case 'md':
        return '\u{1F4DD}'
      case 'html':
        return '\u{1F7E0}'
      default:
        return '\u{1F4C4}'
    }
  }

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-row${entry.isDirectory ? ' file-tree-row--dir' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleToggle}
        onDoubleClick={handleRenameStart}
      >
        {entry.isDirectory && (
          <span className={`file-tree-chevron${expanded ? ' file-tree-chevron--expanded' : ''}`}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path
                d="M3 2L7 5L3 8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        <span className="file-tree-icon">{getFileIcon(entry.name, entry.isDirectory)}</span>
        {isRenaming ? (
          <input
            className="file-tree-rename"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="file-tree-name">{entry.name}</span>
        )}
      </div>
      {expanded && entry.isDirectory && (
        <div className="file-tree-children">
          {loading ? (
            <div className="file-tree-loading" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              Chargement...
            </div>
          ) : (
            children.map((child) => (
              <FileTreeNode key={child.path} entry={child} depth={depth + 1} onRename={onRename} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  useEffect(() => {
    if (!activeProject) {
      setEntries([])
      return
    }

    setLoading(true)
    window.theone.fs
      .readDir(activeProject.path)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [activeProject?.path])

  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      const parts = oldPath.split('/')
      parts[parts.length - 1] = newName
      const newPath = parts.join('/')
      try {
        await window.theone.fs.rename(oldPath, newPath)
        // Refresh
        if (activeProject) {
          const refreshed = await window.theone.fs.readDir(activeProject.path)
          setEntries(refreshed)
        }
      } catch (err) {
        console.error('Rename failed:', err)
      }
    },
    [activeProject],
  )

  if (!activeProject) {
    return (
      <div className="file-explorer-empty">
        Sélectionnez un projet pour voir ses fichiers.
      </div>
    )
  }

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">{activeProject.name}</span>
        <span className="file-explorer-path" title={activeProject.path}>
          {activeProject.path}
        </span>
      </div>
      <div className="file-explorer-tree">
        {loading ? (
          <div className="file-explorer-loading">Chargement...</div>
        ) : (
          entries.map((entry) => (
            <FileTreeNode key={entry.path} entry={entry} depth={0} onRename={handleRename} />
          ))
        )}
      </div>
    </div>
  )
}
