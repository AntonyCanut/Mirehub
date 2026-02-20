import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import type { GitStatus, GitLogEntry } from '../../shared/types'
import '../styles/git.css'

// --- Commit graph computation ---

interface GraphLane {
  color: string
}

interface GraphCommitInfo {
  entry: GitLogEntry
  lanes: (GraphLane | null)[]
  dotLane: number
  connections: Array<{
    fromLane: number
    toLane: number
    color: string
    type: 'straight' | 'merge-left' | 'merge-right' | 'fork-left' | 'fork-right'
  }>
}

const GRAPH_COLORS = [
  '#89b4fa', '#a6e3a1', '#f38ba8', '#fab387', '#f9e2af',
  '#cba6f7', '#94e2d5', '#f5c2e7', '#74c7ec', '#b4befe',
]

function computeGraph(entries: GitLogEntry[]): GraphCommitInfo[] {
  const result: GraphCommitInfo[] = []
  let activeLanes: (string | null)[] = [] // hash of expected commit in each lane

  for (const entry of entries) {
    const connections: GraphCommitInfo['connections'] = []

    // Find which lane this commit occupies
    let dotLane = activeLanes.indexOf(entry.hash)
    if (dotLane === -1) {
      // New lane - find first empty spot or append
      dotLane = activeLanes.indexOf(null)
      if (dotLane === -1) {
        dotLane = activeLanes.length
        activeLanes.push(entry.hash)
      } else {
        activeLanes[dotLane] = entry.hash
      }
    }

    const dotColor = GRAPH_COLORS[dotLane % GRAPH_COLORS.length]!

    // Build snapshot of current lanes for rendering
    const lanesSnapshot: (GraphLane | null)[] = activeLanes.map((hash, i) => {
      if (hash === null) return null
      return { color: GRAPH_COLORS[i % GRAPH_COLORS.length]! }
    })

    // Process parents
    const parents = entry.parents
    activeLanes[dotLane] = null // free this lane

    if (parents.length === 0) {
      // Root commit - lane ends
    } else if (parents.length === 1) {
      const parentHash = parents[0]!
      const existingLane = activeLanes.indexOf(parentHash)
      if (existingLane !== -1) {
        // Parent already tracked in another lane - merge
        connections.push({
          fromLane: dotLane,
          toLane: existingLane,
          color: dotColor,
          type: existingLane < dotLane ? 'merge-left' : existingLane > dotLane ? 'merge-right' : 'straight',
        })
      } else {
        // Continue this lane to parent
        activeLanes[dotLane] = parentHash
        connections.push({
          fromLane: dotLane,
          toLane: dotLane,
          color: dotColor,
          type: 'straight',
        })
      }
    } else {
      // Merge commit - multiple parents
      for (let pi = 0; pi < parents.length; pi++) {
        const parentHash = parents[pi]!
        const existingLane = activeLanes.indexOf(parentHash)
        if (existingLane !== -1) {
          connections.push({
            fromLane: dotLane,
            toLane: existingLane,
            color: GRAPH_COLORS[existingLane % GRAPH_COLORS.length]!,
            type: existingLane < dotLane ? 'merge-left' : existingLane > dotLane ? 'merge-right' : 'straight',
          })
        } else if (pi === 0) {
          // First parent continues this lane
          activeLanes[dotLane] = parentHash
          connections.push({
            fromLane: dotLane,
            toLane: dotLane,
            color: dotColor,
            type: 'straight',
          })
        } else {
          // Additional parents - new lane
          let newLane = activeLanes.indexOf(null)
          if (newLane === -1) {
            newLane = activeLanes.length
            activeLanes.push(parentHash)
          } else {
            activeLanes[newLane] = parentHash
          }
          connections.push({
            fromLane: dotLane,
            toLane: newLane,
            color: GRAPH_COLORS[newLane % GRAPH_COLORS.length]!,
            type: newLane > dotLane ? 'fork-right' : 'fork-left',
          })
        }
      }
    }

    // Add pass-through connections for active lanes
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] !== null && i !== dotLane && !connections.some((c) => c.toLane === i)) {
        connections.push({
          fromLane: i,
          toLane: i,
          color: GRAPH_COLORS[i % GRAPH_COLORS.length]!,
          type: 'straight',
        })
      }
    }

    result.push({
      entry,
      lanes: lanesSnapshot,
      dotLane,
      connections,
    })
  }

  return result
}

// --- Graph SVG Row ---

const LANE_WIDTH = 16
const ROW_HEIGHT = 28
const DOT_RADIUS = 4

function GraphRow({ info }: { info: GraphCommitInfo }) {
  const maxLane = Math.max(
    info.dotLane,
    ...info.connections.map((c) => Math.max(c.fromLane, c.toLane)),
    ...info.lanes.map((_, i) => (info.lanes[i] ? i : 0)),
  )
  const svgWidth = (maxLane + 1) * LANE_WIDTH + 8

  return (
    <svg width={svgWidth} height={ROW_HEIGHT} className="git-graph-svg">
      {/* Connections */}
      {info.connections.map((conn, i) => {
        const x1 = conn.fromLane * LANE_WIDTH + LANE_WIDTH / 2
        const x2 = conn.toLane * LANE_WIDTH + LANE_WIDTH / 2
        const y1 = 0
        const y2 = ROW_HEIGHT

        if (conn.type === 'straight') {
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={conn.color} strokeWidth={2} opacity={0.7}
            />
          )
        }
        // Curved connection for merges/forks
        const midY = ROW_HEIGHT / 2
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            stroke={conn.color} strokeWidth={2} fill="none" opacity={0.7}
          />
        )
      })}
      {/* Commit dot */}
      <circle
        cx={info.dotLane * LANE_WIDTH + LANE_WIDTH / 2}
        cy={ROW_HEIGHT / 2}
        r={DOT_RADIUS}
        fill={GRAPH_COLORS[info.dotLane % GRAPH_COLORS.length]}
        stroke="#1e1e2e"
        strokeWidth={1.5}
      />
    </svg>
  )
}

// --- Ref badges ---

function RefBadge({ refName }: { refName: string }) {
  const isHead = refName.startsWith('HEAD')
  const isRemote = refName.startsWith('origin/')
  const isTag = refName.startsWith('tag:')

  let className = 'git-ref-badge'
  if (isHead) className += ' git-ref-badge--head'
  else if (isRemote) className += ' git-ref-badge--remote'
  else if (isTag) className += ' git-ref-badge--tag'
  else className += ' git-ref-badge--branch'

  return <span className={className}>{refName}</span>
}

// --- Diff viewer ---

function DiffViewer({ diff }: { diff: string }) {
  if (!diff) return <div className="git-diff-empty">Aucune modification</div>

  const lines = diff.split('\n')
  return (
    <div className="git-diff-viewer">
      {lines.map((line, i) => {
        let className = 'git-diff-line'
        if (line.startsWith('+') && !line.startsWith('+++')) className += ' git-diff-line--add'
        else if (line.startsWith('-') && !line.startsWith('---')) className += ' git-diff-line--del'
        else if (line.startsWith('@@')) className += ' git-diff-line--hunk'
        else if (line.startsWith('diff ')) className += ' git-diff-line--header'

        return (
          <div key={i} className={className}>
            {line}
          </div>
        )
      })}
    </div>
  )
}

// --- Main Panel ---

type GitTab = 'graph' | 'status' | 'branches'

export function GitPanel() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const [activeTab, setActiveTab] = useState<GitTab>('graph')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [branches, setBranches] = useState<Array<{ name: string; hash: string; upstream: string }>>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<GitLogEntry | null>(null)
  const [diffContent, setDiffContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const refresh = useCallback(async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const [s, l, b] = await Promise.all([
        window.theone.git.status(activeProject.path),
        window.theone.git.log(activeProject.path, 100),
        window.theone.git.branches(activeProject.path),
      ])
      setStatus(s)
      setLog(l || [])
      setBranches(b || [])
    } catch {
      setStatus(null)
      setLog([])
      setBranches([])
    }
    setLoading(false)
  }, [activeProject?.path])

  useEffect(() => {
    refresh()
  }, [refresh])

  const graphData = useMemo(() => computeGraph(log), [log])

  const handleCommit = useCallback(async () => {
    if (!activeProject || !status || !commitMessage.trim()) return
    const files = [...status.staged, ...status.modified, ...status.untracked]
    if (files.length === 0) return
    try {
      await window.theone.git.commit(activeProject.path, commitMessage.trim(), files)
      setCommitMessage('')
      refresh()
    } catch (err) {
      console.error('Commit failed:', err)
    }
  }, [activeProject, status, commitMessage, refresh])

  const handlePush = useCallback(async () => {
    if (!activeProject) return
    try {
      await window.theone.git.push(activeProject.path)
      refresh()
    } catch (err) {
      console.error('Push failed:', err)
    }
  }, [activeProject, refresh])

  const handlePull = useCallback(async () => {
    if (!activeProject) return
    try {
      await window.theone.git.pull(activeProject.path)
      refresh()
    } catch (err) {
      console.error('Pull failed:', err)
    }
  }, [activeProject, refresh])

  const handleStash = useCallback(async () => {
    if (!activeProject) return
    try {
      await window.theone.git.stash(activeProject.path)
      refresh()
    } catch (err) {
      console.error('Stash failed:', err)
    }
  }, [activeProject, refresh])

  const handleStashPop = useCallback(async () => {
    if (!activeProject) return
    try {
      await window.theone.git.stashPop(activeProject.path)
      refresh()
    } catch (err) {
      console.error('Stash pop failed:', err)
    }
  }, [activeProject, refresh])

  const handleCheckout = useCallback(
    async (branch: string) => {
      if (!activeProject) return
      try {
        await window.theone.git.checkout(activeProject.path, branch)
        refresh()
      } catch (err) {
        console.error('Checkout failed:', err)
      }
    },
    [activeProject, refresh],
  )

  const handleCreateBranch = useCallback(async () => {
    if (!activeProject || !newBranchName.trim()) return
    try {
      await window.theone.git.createBranch(activeProject.path, newBranchName.trim())
      setNewBranchName('')
      setShowNewBranch(false)
      refresh()
    } catch (err) {
      console.error('Create branch failed:', err)
    }
  }, [activeProject, newBranchName, refresh])

  const handleDeleteBranch = useCallback(
    async (name: string) => {
      if (!activeProject) return
      try {
        await window.theone.git.deleteBranch(activeProject.path, name)
        refresh()
      } catch (err) {
        console.error('Delete branch failed:', err)
      }
    },
    [activeProject, refresh],
  )

  const handleMerge = useCallback(
    async (branch: string) => {
      if (!activeProject) return
      try {
        await window.theone.git.merge(activeProject.path, branch)
        refresh()
      } catch (err) {
        console.error('Merge failed:', err)
      }
    },
    [activeProject, refresh],
  )

  const handleFileDiff = useCallback(
    async (file: string, staged: boolean) => {
      if (!activeProject) return
      setSelectedFile(file)
      const diff = await window.theone.git.diff(activeProject.path, file, staged)
      setDiffContent(diff || '')
    },
    [activeProject],
  )

  if (!activeProject) {
    return <div className="git-empty">Selectionnez un projet pour voir son historique Git.</div>
  }

  const handleGitInit = useCallback(async () => {
    if (!activeProject) return
    try {
      await window.theone.git.init(activeProject.path)
      refresh()
    } catch (err) {
      console.error('Git init failed:', err)
    }
  }, [activeProject, refresh])

  if (!status) {
    return (
      <div className="git-empty">
        {loading ? (
          'Chargement...'
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p>Ce projet n'est pas un depot Git.</p>
            <button className="git-action-btn" style={{ marginTop: 12, height: 32, padding: '0 20px', fontSize: 13 }} onClick={handleGitInit}>
              Initialiser Git
            </button>
          </div>
        )}
      </div>
    )
  }

  const totalChanges = status.staged.length + status.modified.length + status.untracked.length

  return (
    <div className="git-panel">
      {/* Header bar */}
      <div className="git-header">
        <div className="git-branch-info">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="git-icon">
            <path d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.548 1.56l1.773 1.774a1.224 1.224 0 1 1-.733.68L8.535 5.908v4.27a1.224 1.224 0 1 1-1.008-.036V5.822a1.224 1.224 0 0 1-.664-1.605L5.04 2.394.302 7.13a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457" />
          </svg>
          <span className="git-branch-name">{status.branch}</span>
          {(status.ahead > 0 || status.behind > 0) && (
            <span className="git-sync-status">
              {status.ahead > 0 && <span className="git-ahead">{status.ahead}</span>}
              {status.behind > 0 && <span className="git-behind">{status.behind}</span>}
            </span>
          )}
        </div>
        <div className="git-actions">
          <button className="git-action-btn" onClick={handlePull} title="Pull">Pull</button>
          <button className="git-action-btn" onClick={handlePush} title="Push">Push</button>
          <button className="git-action-btn" onClick={handleStash} title="Stash">Stash</button>
          <button className="git-action-btn" onClick={handleStashPop} title="Stash Pop">Pop</button>
          <button className="git-action-btn" onClick={refresh} title="Rafraichir">&#8635;</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="git-tabs">
        <button
          className={`git-tab${activeTab === 'graph' ? ' git-tab--active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          Graph
        </button>
        <button
          className={`git-tab${activeTab === 'status' ? ' git-tab--active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Changements {totalChanges > 0 && <span className="git-tab-badge">{totalChanges}</span>}
        </button>
        <button
          className={`git-tab${activeTab === 'branches' ? ' git-tab--active' : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          Branches ({branches.filter((b) => !b.name.startsWith('origin/')).length})
        </button>
      </div>

      {/* Content */}
      <div className="git-content">
        {/* Graph view */}
        {activeTab === 'graph' && (
          <div className="git-graph-container">
            <div className="git-graph-scroll">
              {graphData.map((info) => (
                <div
                  key={info.entry.hash}
                  className={`git-graph-row${selectedCommit?.hash === info.entry.hash ? ' git-graph-row--selected' : ''}`}
                  onClick={() => setSelectedCommit(info.entry)}
                >
                  <div className="git-graph-cell">
                    <GraphRow info={info} />
                  </div>
                  <div className="git-graph-info">
                    <span className="git-graph-message">{info.entry.message}</span>
                    {info.entry.refs.length > 0 && (
                      <span className="git-graph-refs">
                        {info.entry.refs.map((ref) => (
                          <RefBadge key={ref} refName={ref} />
                        ))}
                      </span>
                    )}
                  </div>
                  <span className="git-graph-author">{info.entry.author}</span>
                  <span className="git-graph-date">
                    {new Date(info.entry.date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <span className="git-graph-hash">{info.entry.shortHash}</span>
                </div>
              ))}
            </div>
            {selectedCommit && (
              <div className="git-commit-detail">
                <div className="git-commit-detail-header">
                  <span className="git-commit-detail-hash">{selectedCommit.shortHash}</span>
                  <span className="git-commit-detail-msg">{selectedCommit.message}</span>
                  <button
                    className="git-commit-detail-close"
                    onClick={() => setSelectedCommit(null)}
                  >
                    &times;
                  </button>
                </div>
                <div className="git-commit-detail-meta">
                  <span>{selectedCommit.author}</span>
                  <span>{new Date(selectedCommit.date).toLocaleString('fr-FR')}</span>
                </div>
                {selectedCommit.refs.length > 0 && (
                  <div className="git-commit-detail-refs">
                    {selectedCommit.refs.map((ref) => (
                      <RefBadge key={ref} refName={ref} />
                    ))}
                  </div>
                )}
                {selectedCommit.parents.length > 0 && (
                  <div className="git-commit-detail-parents">
                    Parents: {selectedCommit.parents.map((p) => p.slice(0, 7)).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status view */}
        {activeTab === 'status' && (
          <div className="git-status">
            {totalChanges === 0 ? (
              <div className="git-status-clean">Working tree clean</div>
            ) : (
              <>
                {status.staged.length > 0 && (
                  <div className="git-file-group">
                    <div className="git-file-group-header">Staged ({status.staged.length})</div>
                    {status.staged.map((file) => (
                      <div
                        key={file}
                        className={`git-file git-file--staged${selectedFile === file ? ' git-file--selected' : ''}`}
                        onClick={() => handleFileDiff(file, true)}
                      >
                        <span className="git-file-badge git-file-badge--staged">S</span>
                        <span className="git-file-name">{file}</span>
                      </div>
                    ))}
                  </div>
                )}
                {status.modified.length > 0 && (
                  <div className="git-file-group">
                    <div className="git-file-group-header">Modified ({status.modified.length})</div>
                    {status.modified.map((file) => (
                      <div
                        key={file}
                        className={`git-file git-file--modified${selectedFile === file ? ' git-file--selected' : ''}`}
                        onClick={() => handleFileDiff(file, false)}
                      >
                        <span className="git-file-badge git-file-badge--modified">M</span>
                        <span className="git-file-name">{file}</span>
                      </div>
                    ))}
                  </div>
                )}
                {status.untracked.length > 0 && (
                  <div className="git-file-group">
                    <div className="git-file-group-header">Untracked ({status.untracked.length})</div>
                    {status.untracked.map((file) => (
                      <div
                        key={file}
                        className={`git-file git-file--untracked${selectedFile === file ? ' git-file--selected' : ''}`}
                      >
                        <span className="git-file-badge git-file-badge--untracked">?</span>
                        <span className="git-file-name">{file}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Diff panel */}
                {selectedFile && diffContent && (
                  <div className="git-diff-panel">
                    <div className="git-diff-panel-header">
                      <span>{selectedFile}</span>
                      <button onClick={() => { setSelectedFile(null); setDiffContent('') }}>&times;</button>
                    </div>
                    <DiffViewer diff={diffContent} />
                  </div>
                )}

                <div className="git-commit-area">
                  <input
                    className="git-commit-input"
                    placeholder="Message de commit..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                  />
                  <button
                    className="git-commit-btn"
                    onClick={handleCommit}
                    disabled={!commitMessage.trim()}
                  >
                    Commit All
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Branches view */}
        {activeTab === 'branches' && (
          <div className="git-branches">
            <div className="git-branches-actions">
              {showNewBranch ? (
                <div className="git-new-branch-form">
                  <input
                    className="git-new-branch-input"
                    placeholder="Nom de la branche..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                    autoFocus
                  />
                  <button className="git-action-btn" onClick={handleCreateBranch}>Creer</button>
                  <button className="git-action-btn" onClick={() => setShowNewBranch(false)}>Annuler</button>
                </div>
              ) : (
                <button className="git-action-btn" onClick={() => setShowNewBranch(true)}>
                  + Nouvelle branche
                </button>
              )}
            </div>

            {/* Local branches */}
            <div className="git-branch-section">
              <div className="git-branch-section-title">Locales</div>
              {branches
                .filter((b) => !b.name.startsWith('origin/'))
                .map((branch) => (
                  <div
                    key={branch.name}
                    className={`git-branch-item${branch.name === status.branch ? ' git-branch-item--active' : ''}`}
                  >
                    <span
                      className="git-branch-item-name"
                      onClick={() => branch.name !== status.branch && handleCheckout(branch.name)}
                    >
                      {branch.name}
                    </span>
                    <span className="git-branch-item-hash">{branch.hash}</span>
                    {branch.name === status.branch ? (
                      <span className="git-branch-item-current">current</span>
                    ) : (
                      <span className="git-branch-item-actions">
                        <button
                          className="git-branch-action"
                          onClick={() => handleMerge(branch.name)}
                          title={`Merge ${branch.name} into ${status.branch}`}
                        >
                          merge
                        </button>
                        <button
                          className="git-branch-action git-branch-action--danger"
                          onClick={() => handleDeleteBranch(branch.name)}
                          title="Supprimer"
                        >
                          &times;
                        </button>
                      </span>
                    )}
                  </div>
                ))}
            </div>

            {/* Remote branches */}
            {branches.some((b) => b.name.startsWith('origin/')) && (
              <div className="git-branch-section">
                <div className="git-branch-section-title">Remotes</div>
                {branches
                  .filter((b) => b.name.startsWith('origin/'))
                  .map((branch) => (
                    <div key={branch.name} className="git-branch-item">
                      <span
                        className="git-branch-item-name git-branch-item-name--remote"
                        onClick={() => handleCheckout(branch.name)}
                      >
                        {branch.name}
                      </span>
                      <span className="git-branch-item-hash">{branch.hash}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
