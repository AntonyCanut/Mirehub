import { create } from 'zustand'
import type {
  DbConnection,
  DbConnectionStatus,
  DbFile,
  DbBackupLogEntry,
} from '../../../shared/types'

interface DatabaseState {
  /** Connections indexed by workspaceId */
  connectionsByWorkspace: Record<string, DbConnection[]>
  activeConnectionId: string | null
  connectionStatuses: Record<string, DbConnectionStatus>
  /** Track which workspaces have been loaded */
  loadedWorkspaces: Record<string, boolean>
  loading: boolean
  backupLogs: DbBackupLogEntry[]
}

interface DatabaseActions {
  loadConnections: (workspaceId: string) => Promise<void>
  getConnectionsForWorkspace: (workspaceId: string) => DbConnection[]
  saveConnections: (workspaceId: string) => void
  addConnection: (conn: DbConnection) => void
  updateConnection: (conn: DbConnection) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  setConnectionStatus: (id: string, status: DbConnectionStatus) => void
  connectDb: (id: string) => Promise<void>
  disconnectDb: (id: string) => Promise<void>
  appendBackupLog: (entry: DbBackupLogEntry) => void
  clearBackupLogs: () => void
}

type DatabaseStore = DatabaseState & DatabaseActions

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function debouncedSave(workspaceId: string, connections: DbConnection[]) {
  if (saveTimers[workspaceId]) clearTimeout(saveTimers[workspaceId])
  saveTimers[workspaceId] = setTimeout(() => {
    const data: DbFile = { version: 1, connections }
    window.mirehub.database.save(workspaceId, data)
    delete saveTimers[workspaceId]
  }, 500)
}

export const useDatabaseStore = create<DatabaseStore>((set, get) => ({
  connectionsByWorkspace: {},
  activeConnectionId: null,
  connectionStatuses: {},
  loadedWorkspaces: {},
  loading: false,
  backupLogs: [],

  loadConnections: async (workspaceId: string) => {
    if (get().loadedWorkspaces[workspaceId]) return

    set({ loading: true })
    try {
      const loaded: DbFile = await window.mirehub.database.load(workspaceId)
      set((state) => ({
        connectionsByWorkspace: {
          ...state.connectionsByWorkspace,
          [workspaceId]: loaded.connections,
        },
        loadedWorkspaces: { ...state.loadedWorkspaces, [workspaceId]: true },
        loading: false,
      }))
    } catch {
      set((state) => ({
        connectionsByWorkspace: {
          ...state.connectionsByWorkspace,
          [workspaceId]: [],
        },
        loadedWorkspaces: { ...state.loadedWorkspaces, [workspaceId]: true },
        loading: false,
      }))
    }
  },

  getConnectionsForWorkspace: (workspaceId: string) => {
    return get().connectionsByWorkspace[workspaceId] ?? []
  },

  saveConnections: (workspaceId: string) => {
    const connections = get().connectionsByWorkspace[workspaceId] ?? []
    debouncedSave(workspaceId, connections)
  },

  addConnection: (conn: DbConnection) => {
    set((state) => {
      const existing = state.connectionsByWorkspace[conn.workspaceId] ?? []
      return {
        connectionsByWorkspace: {
          ...state.connectionsByWorkspace,
          [conn.workspaceId]: [...existing, conn],
        },
      }
    })
    get().saveConnections(conn.workspaceId)
  },

  updateConnection: (conn: DbConnection) => {
    set((state) => {
      const existing = state.connectionsByWorkspace[conn.workspaceId] ?? []
      return {
        connectionsByWorkspace: {
          ...state.connectionsByWorkspace,
          [conn.workspaceId]: existing.map((c) => (c.id === conn.id ? conn : c)),
        },
      }
    })
    get().saveConnections(conn.workspaceId)
  },

  deleteConnection: (id: string) => {
    const { connectionStatuses, activeConnectionId, connectionsByWorkspace } = get()
    const status = connectionStatuses[id]
    if (status === 'connected' || status === 'connecting') {
      window.mirehub.database.disconnect(id).catch(() => {})
    }

    // Find which workspace this connection belongs to
    let workspaceId: string | null = null
    for (const [wsId, conns] of Object.entries(connectionsByWorkspace)) {
      if (conns.some((c) => c.id === id)) {
        workspaceId = wsId
        break
      }
    }

    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...nextStatuses } = state.connectionStatuses

      const nextConns = { ...state.connectionsByWorkspace }
      if (workspaceId) {
        nextConns[workspaceId] = (nextConns[workspaceId] ?? []).filter((c) => c.id !== id)
      }

      return {
        connectionsByWorkspace: nextConns,
        connectionStatuses: nextStatuses,
        activeConnectionId: activeConnectionId === id ? null : activeConnectionId,
      }
    })

    if (workspaceId) {
      get().saveConnections(workspaceId)
    }
  },

  setActiveConnection: (id: string | null) => {
    set({ activeConnectionId: id })
  },

  setConnectionStatus: (id: string, status: DbConnectionStatus) => {
    set((state) => ({
      connectionStatuses: { ...state.connectionStatuses, [id]: status },
    }))
  },

  connectDb: async (id: string) => {
    // Find the connection across all workspaces
    let conn: DbConnection | undefined
    for (const conns of Object.values(get().connectionsByWorkspace)) {
      conn = conns.find((c) => c.id === id)
      if (conn) break
    }
    if (!conn) return

    get().setConnectionStatus(id, 'connecting')
    try {
      await window.mirehub.database.connect(id, conn.config)
      get().setConnectionStatus(id, 'connected')
      set({ activeConnectionId: id })
    } catch {
      get().setConnectionStatus(id, 'error')
    }
  },

  disconnectDb: async (id: string) => {
    try {
      await window.mirehub.database.disconnect(id)
    } catch {
      // Ignore disconnect errors
    }
    get().setConnectionStatus(id, 'disconnected')
  },

  appendBackupLog: (entry: DbBackupLogEntry) => {
    set((state) => ({
      backupLogs: [...state.backupLogs.slice(-499), entry],
    }))
  },

  clearBackupLogs: () => {
    set({ backupLogs: [] })
  },
}))
