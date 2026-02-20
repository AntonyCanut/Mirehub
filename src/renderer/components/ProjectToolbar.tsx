import React, { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useTerminalTabStore, type PaneNode } from '../lib/stores/terminalTabStore'
import type { ProjectInfo } from '../../shared/types'

/** Find a terminal pane session (never Claude). Prefers active pane if it's not Claude. */
function findTerminalSession(tree: PaneNode, activePaneId: string): string | null {
  // First try: active pane if it's not Claude
  const activeLeaf = findLeaf(tree, activePaneId)
  if (activeLeaf && activeLeaf.initialCommand !== 'claude' && activeLeaf.sessionId) {
    return activeLeaf.sessionId
  }
  // Fallback: any non-Claude pane
  return findNonClaudeSession(tree)
}

function findLeaf(tree: PaneNode, paneId: string): PaneNode & { type: 'leaf' } | null {
  if (tree.type === 'leaf') return tree.id === paneId ? tree : null
  return findLeaf(tree.children[0], paneId) || findLeaf(tree.children[1], paneId)
}

function findNonClaudeSession(tree: PaneNode): string | null {
  if (tree.type === 'leaf') {
    return tree.initialCommand !== 'claude' ? tree.sessionId : null
  }
  return findNonClaudeSession(tree.children[0]) || findNonClaudeSession(tree.children[1])
}

export function ProjectToolbar() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const { tabs, activeTabId } = useTerminalTabStore()
  const [info, setInfo] = useState<ProjectInfo | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  useEffect(() => {
    if (!activeProject) {
      setInfo(null)
      return
    }
    window.theone.project.scanInfo(activeProject.path).then(setInfo).catch(() => setInfo(null))
  }, [activeProject?.path])

  const runMakeTarget = useCallback(
    (target: string) => {
      if (!activeTabId) return
      const tab = tabs.find((t) => t.id === activeTabId)
      if (!tab) return

      const sessionId = findTerminalSession(tab.paneTree, tab.activePaneId)
      if (sessionId) {
        window.theone.terminal.write(sessionId, `make ${target}\n`)
      }
    },
    [activeTabId, tabs],
  )

  if (!activeProject || !info) return null

  const priorityTargets = ['dev', 'build', 'test', 'clean', 'install', 'lint', 'run', 'start']
  const shownTargets = info.hasMakefile
    ? priorityTargets.filter((t) => info.makeTargets.includes(t))
    : []

  if (shownTargets.length === 0 && !info.hasGit) return null

  return (
    <div className="project-toolbar">
      {info.hasGit && (
        <span className="project-toolbar-git">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.548 1.56l1.773 1.774a1.224 1.224 0 1 1-.733.68L8.535 5.908v4.27a1.224 1.224 0 1 1-1.008-.036V5.822a1.224 1.224 0 0 1-.664-1.605L5.04 2.394.302 7.13a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457" />
          </svg>
          <span>{info.gitBranch || 'git'}</span>
        </span>
      )}
      {shownTargets.length > 0 && (
        <div className="project-toolbar-make">
          {shownTargets.map((target) => (
            <button
              key={target}
              className="project-toolbar-btn"
              onClick={() => runMakeTarget(target)}
              title={`make ${target}`}
            >
              make {target}
            </button>
          ))}
        </div>
      )}
      <span className="project-toolbar-name">{activeProject.name}</span>
    </div>
  )
}
