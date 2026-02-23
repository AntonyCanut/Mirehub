import { create } from 'zustand'
import type { ClaudeSession } from '../../../shared/types/index'

type WorkspaceClaudeStatus = 'idle' | 'working' | 'finished'

interface ClaudeState {
  sessions: ClaudeSession[]
  sessionHistory: ClaudeSession[]
  flashingSessionId: string | null
  flashingWorkspaceId: string | null
  // Per-workspace Claude activity: count of active Claude panes/tasks
  workspaceClaudeCounts: Record<string, number>
  // Per-workspace status: idle → working → finished
  workspaceClaudeStatus: Record<string, WorkspaceClaudeStatus>
}

interface ClaudeActions {
  startSession: (
    projectId: string,
    projectPath: string,
    terminalId: string,
    prompt?: string,
    loopMode?: boolean,
    loopDelay?: number,
  ) => Promise<ClaudeSession | null>
  stopSession: (sessionId: string) => Promise<void>
  refreshSessions: () => Promise<void>
  setFlashing: (sessionId: string | null) => void
  getSessionsForProject: (projectId: string) => ClaudeSession[]
  getSessionHistory: () => ClaudeSession[]
  initListeners: () => () => void
  incrementWorkspaceClaude: (workspaceId: string) => void
  decrementWorkspaceClaude: (workspaceId: string) => void
  setWorkspaceClaudeStatus: (workspaceId: string, status: WorkspaceClaudeStatus) => void
}

type ClaudeStore = ClaudeState & ClaudeActions

function loadSessionHistory(): ClaudeSession[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const stored = localStorage.getItem('mirehub:claudeSessionHistory')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function persistSessionHistory(history: ClaudeSession[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mirehub:claudeSessionHistory', JSON.stringify(history))
    }
  } catch { /* ignore in non-browser environments */ }
}

export const useClaudeStore = create<ClaudeStore>((set, get) => ({
  sessions: [],
  sessionHistory: loadSessionHistory(),
  flashingSessionId: null,
  flashingWorkspaceId: null,
  workspaceClaudeCounts: {},
  workspaceClaudeStatus: {},

  startSession: async (projectId, projectPath, terminalId, prompt, loopMode, loopDelay) => {
    try {
      const session: ClaudeSession = await window.mirehub.claude.start({
        projectId,
        projectPath,
        terminalId,
        prompt,
        loopMode,
        loopDelay,
      } as never)
      set((state) => ({ sessions: [...state.sessions, session] }))
      return session
    } catch {
      return null
    }
  },

  stopSession: async (sessionId) => {
    await window.mirehub.claude.stop(sessionId)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    }))
  },

  refreshSessions: async () => {
    // The status endpoint returns all active sessions
    const sessions: ClaudeSession[] = await (window.mirehub.claude as { status?: () => Promise<ClaudeSession[]> }).status?.() ?? []
    set({ sessions })
  },

  setFlashing: (sessionId) => set({ flashingSessionId: sessionId }),

  getSessionsForProject: (projectId) => {
    return get().sessions.filter((s) => s.projectId === projectId)
  },

  getSessionHistory: () => {
    return get().sessionHistory
  },

  incrementWorkspaceClaude: (workspaceId: string) => {
    const { workspaceClaudeCounts } = get()
    const count = (workspaceClaudeCounts[workspaceId] ?? 0) + 1
    set({
      workspaceClaudeCounts: { ...workspaceClaudeCounts, [workspaceId]: count },
      workspaceClaudeStatus: { ...get().workspaceClaudeStatus, [workspaceId]: 'working' },
    })
  },

  decrementWorkspaceClaude: (workspaceId: string) => {
    const { workspaceClaudeCounts, workspaceClaudeStatus } = get()
    const count = Math.max(0, (workspaceClaudeCounts[workspaceId] ?? 0) - 1)
    const newStatus = count === 0 ? 'finished' : 'working'
    set({
      workspaceClaudeCounts: { ...workspaceClaudeCounts, [workspaceId]: count },
      workspaceClaudeStatus: { ...workspaceClaudeStatus, [workspaceId]: newStatus },
    })
  },

  setWorkspaceClaudeStatus: (workspaceId: string, status: WorkspaceClaudeStatus) => {
    set({
      workspaceClaudeStatus: { ...get().workspaceClaudeStatus, [workspaceId]: status },
    })
  },

  initListeners: () => {
    // Listen for file-based activity events from hooks
    const unsubActivity = window.mirehub.claude.onActivity(async (data: { path: string; status: string }) => {
      // Map the project path to a workspace (lazy import to avoid circular dependency)
      const { useWorkspaceStore } = await import('./workspaceStore')
      const { projects } = useWorkspaceStore.getState()

      // Check if path matches a project path
      let workspaceId: string | null = null
      for (const project of projects as Array<{ path: string; workspaceId: string }>) {
        if (data.path === project.path || data.path.startsWith(project.path + '/')) {
          workspaceId = project.workspaceId
          break
        }
      }

      // Check if path is a workspace env (e.g. ~/.mirehub/envs/WorkspaceName/...)
      if (!workspaceId) {
        const envsMarker = '/.mirehub/envs/'
        const envsIdx = data.path.indexOf(envsMarker)
        if (envsIdx >= 0) {
          const afterEnvs = data.path.slice(envsIdx + envsMarker.length)
          const envName = afterEnvs.split('/')[0]
          if (envName) {
            const { workspaces } = useWorkspaceStore.getState()
            const ws = (workspaces as Array<{ id: string; name: string }>).find(
              (w) => w.name === envName || w.name.replace(/[/\\:*?"<>|]/g, '_') === envName,
            )
            if (ws) workspaceId = ws.id
          }
        }
      }

      if (!workspaceId) return

      if (data.status === 'working') {
        set({
          workspaceClaudeStatus: { ...get().workspaceClaudeStatus, [workspaceId]: 'working' },
        })
      } else if (data.status === 'done') {
        set({
          workspaceClaudeStatus: { ...get().workspaceClaudeStatus, [workspaceId]: 'finished' },
        })
        // Auto-clear finished status after 30 seconds
        const wsId = workspaceId
        setTimeout(() => {
          const current = get().workspaceClaudeStatus[wsId]
          if (current === 'finished') {
            set({
              workspaceClaudeStatus: { ...get().workspaceClaudeStatus, [wsId]: 'idle' },
            })
          }
        }, 30000)
      }
    })

    const unsub = window.mirehub.claude.onSessionEnd(async (data: { id: string; status: string }) => {
      // Find the session before updating to get projectId
      const session = get().sessions.find((s) => s.id === data.id)

      const endedAt = Date.now()
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === data.id ? { ...s, status: data.status as ClaudeSession['status'], endedAt } : s,
        ),
        flashingSessionId: data.id,
      }))

      // Add to session history
      if (session) {
        const completedSession: ClaudeSession = {
          ...session,
          status: data.status as ClaudeSession['status'],
          endedAt,
        }
        const { sessionHistory } = get()
        const updatedHistory = [completedSession, ...sessionHistory].slice(0, 50)
        persistSessionHistory(updatedHistory)
        set({ sessionHistory: updatedHistory })
      }

      // Flash the workspace orange
      if (session) {
        // Lazy import to avoid circular dependency
        const { useWorkspaceStore } = await import('./workspaceStore')
        const { projects } = useWorkspaceStore.getState()
        const project = projects.find((p: { id: string }) => p.id === session.projectId)
        if (project) {
          set({ flashingWorkspaceId: project.workspaceId })
          setTimeout(() => {
            set((state) => ({
              flashingWorkspaceId: state.flashingWorkspaceId === project.workspaceId ? null : state.flashingWorkspaceId,
            }))
          }, 5000)
        }
      }

      // Send macOS notification
      window.mirehub.notify(
        'Session Claude terminée',
        `Session ${data.status === 'completed' ? 'terminée avec succès' : 'échouée'}`,
      )

      // Stop flashing after 5 seconds
      setTimeout(() => {
        set((state) => ({
          flashingSessionId: state.flashingSessionId === data.id ? null : state.flashingSessionId,
        }))
      }, 5000)
    })

    return () => {
      unsub()
      unsubActivity()
    }
  },
}))
