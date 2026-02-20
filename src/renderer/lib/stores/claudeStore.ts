import { create } from 'zustand'
import type { ClaudeSession } from '../../../shared/types/index'

interface ClaudeState {
  sessions: ClaudeSession[]
  flashingSessionId: string | null
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
  initListeners: () => () => void
}

type ClaudeStore = ClaudeState & ClaudeActions

export const useClaudeStore = create<ClaudeStore>((set, get) => ({
  sessions: [],
  flashingSessionId: null,

  startSession: async (projectId, projectPath, terminalId, prompt, loopMode, loopDelay) => {
    try {
      const session: ClaudeSession = await window.theone.claude.start({
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
    await window.theone.claude.stop(sessionId)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
    }))
  },

  refreshSessions: async () => {
    // The status endpoint returns all active sessions
    const sessions: ClaudeSession[] = await (window.theone.claude as { status?: () => Promise<ClaudeSession[]> }).status?.() ?? []
    set({ sessions })
  },

  setFlashing: (sessionId) => set({ flashingSessionId: sessionId }),

  getSessionsForProject: (projectId) => {
    return get().sessions.filter((s) => s.projectId === projectId)
  },

  initListeners: () => {
    const unsub = window.theone.claude.onSessionEnd((data: { id: string; status: string }) => {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === data.id ? { ...s, status: data.status as ClaudeSession['status'], endedAt: Date.now() } : s,
        ),
        flashingSessionId: data.id,
      }))

      // Send macOS notification
      window.theone.notify(
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

    return unsub
  },
}))
