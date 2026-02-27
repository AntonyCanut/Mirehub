import { create } from 'zustand'
import type { DbQueryResult } from '../../../shared/types'

export interface DbQueryTab {
  id: string
  connectionId: string
  label: string
  query: string
  results: DbQueryResult | null
  executing: boolean
  limit: number
  page: number
}

interface DatabaseTabState {
  tabsByConnection: Record<string, DbQueryTab[]>
  activeTabByConnection: Record<string, string>
}

interface DatabaseTabActions {
  createTab: (connectionId: string) => string
  closeTab: (connectionId: string, tabId: string) => void
  setActiveTab: (connectionId: string, tabId: string) => void
  updateTabQuery: (connectionId: string, tabId: string, query: string) => void
  updateTabResults: (connectionId: string, tabId: string, results: DbQueryResult | null) => void
  updateTabExecuting: (connectionId: string, tabId: string, executing: boolean) => void
  updateTabLimit: (connectionId: string, tabId: string, limit: number) => void
  updateTabPage: (connectionId: string, tabId: string, page: number) => void
  clearTabsForConnection: (connectionId: string) => void
  ensureTab: (connectionId: string) => string
}

type DatabaseTabStore = DatabaseTabState & DatabaseTabActions

function generateId(): string {
  return `dbtab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function deriveLabel(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return 'New Query'
  return trimmed.length > 30 ? trimmed.slice(0, 30) + '...' : trimmed
}

export const useDatabaseTabStore = create<DatabaseTabStore>((set, get) => ({
  tabsByConnection: {},
  activeTabByConnection: {},

  createTab: (connectionId: string) => {
    const id = generateId()
    const tab: DbQueryTab = {
      id,
      connectionId,
      label: 'New Query',
      query: '',
      results: null,
      executing: false,
      limit: 100,
      page: 0,
    }
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: [...(state.tabsByConnection[connectionId] ?? []), tab],
      },
      activeTabByConnection: {
        ...state.activeTabByConnection,
        [connectionId]: id,
      },
    }))
    return id
  },

  closeTab: (connectionId: string, tabId: string) => {
    const tabs = get().tabsByConnection[connectionId] ?? []
    const index = tabs.findIndex((t) => t.id === tabId)
    if (index === -1) return

    const newTabs = tabs.filter((t) => t.id !== tabId)
    const activeId = get().activeTabByConnection[connectionId]

    let newActiveId = activeId
    if (activeId === tabId) {
      if (newTabs.length === 0) {
        newActiveId = undefined
      } else if (index >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1]!.id
      } else {
        newActiveId = newTabs[index]!.id
      }
    }

    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: newTabs,
      },
      activeTabByConnection: {
        ...state.activeTabByConnection,
        [connectionId]: newActiveId ?? '',
      },
    }))
  },

  setActiveTab: (connectionId: string, tabId: string) => {
    set((state) => ({
      activeTabByConnection: {
        ...state.activeTabByConnection,
        [connectionId]: tabId,
      },
    }))
  },

  updateTabQuery: (connectionId: string, tabId: string, query: string) => {
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: (state.tabsByConnection[connectionId] ?? []).map((t) =>
          t.id === tabId ? { ...t, query, label: deriveLabel(query) } : t,
        ),
      },
    }))
  },

  updateTabResults: (connectionId: string, tabId: string, results: DbQueryResult | null) => {
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: (state.tabsByConnection[connectionId] ?? []).map((t) =>
          t.id === tabId ? { ...t, results } : t,
        ),
      },
    }))
  },

  updateTabExecuting: (connectionId: string, tabId: string, executing: boolean) => {
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: (state.tabsByConnection[connectionId] ?? []).map((t) =>
          t.id === tabId ? { ...t, executing } : t,
        ),
      },
    }))
  },

  updateTabLimit: (connectionId: string, tabId: string, limit: number) => {
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: (state.tabsByConnection[connectionId] ?? []).map((t) =>
          t.id === tabId ? { ...t, limit } : t,
        ),
      },
    }))
  },

  updateTabPage: (connectionId: string, tabId: string, page: number) => {
    set((state) => ({
      tabsByConnection: {
        ...state.tabsByConnection,
        [connectionId]: (state.tabsByConnection[connectionId] ?? []).map((t) =>
          t.id === tabId ? { ...t, page } : t,
        ),
      },
    }))
  },

  clearTabsForConnection: (connectionId: string) => {
    set((state) => {
      const { [connectionId]: _, ...nextTabs } = state.tabsByConnection
      const { [connectionId]: __, ...nextActive } = state.activeTabByConnection
      return {
        tabsByConnection: nextTabs,
        activeTabByConnection: nextActive,
      }
    })
  },

  ensureTab: (connectionId: string) => {
    const tabs = get().tabsByConnection[connectionId] ?? []
    if (tabs.length > 0) {
      const activeId = get().activeTabByConnection[connectionId]
      if (activeId && tabs.some((t) => t.id === activeId)) return activeId
      return tabs[0]!.id
    }
    return get().createTab(connectionId)
  },
}))
