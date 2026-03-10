import { create } from 'zustand'
import type {
  DevOpsFile,
  DevOpsConnection,
  PipelineDefinition,
  PipelineRun,
} from '../../../shared/types'

interface DevOpsState {
  data: DevOpsFile | null
  loading: boolean
  activeConnectionId: string | null
  pipelines: PipelineDefinition[]
  pipelinesLoading: boolean
  pipelinesError: string | null
  selectedPipelineId: number | null
  pipelineRuns: PipelineRun[]
  runsLoading: boolean

  loadData: (projectPath: string) => Promise<void>
  saveData: (projectPath: string) => Promise<void>
  addConnection: (projectPath: string, connection: Omit<DevOpsConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateConnection: (projectPath: string, id: string, updates: Partial<DevOpsConnection>) => Promise<void>
  deleteConnection: (projectPath: string, id: string) => Promise<void>
  setActiveConnection: (id: string | null) => void
  testConnection: (connection: DevOpsConnection) => Promise<{ success: boolean; error?: string }>
  loadPipelines: (connection: DevOpsConnection) => Promise<void>
  selectPipeline: (pipelineId: number | null) => void
  loadPipelineRuns: (connection: DevOpsConnection, pipelineId: number) => Promise<void>
  runPipeline: (connection: DevOpsConnection, pipelineId: number, branch?: string) => Promise<{ success: boolean; error?: string }>
  reorderPipelines: (projectPath: string, fromIndex: number, toIndex: number) => Promise<void>
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function applySavedOrder(pipelines: PipelineDefinition[], savedOrder: number[] | undefined): PipelineDefinition[] {
  if (!savedOrder || savedOrder.length === 0) return pipelines
  const pipelineMap = new Map(pipelines.map((p) => [p.id, p]))
  const ordered: PipelineDefinition[] = []
  for (const id of savedOrder) {
    const pipeline = pipelineMap.get(id)
    if (pipeline) {
      ordered.push(pipeline)
      pipelineMap.delete(id)
    }
  }
  // Append any new pipelines not in saved order
  for (const pipeline of pipelineMap.values()) {
    ordered.push(pipeline)
  }
  return ordered
}

function sortRunsByDate(runs: PipelineRun[]): PipelineRun[] {
  return [...runs].sort((a, b) => {
    const timeA = a.startTime ? new Date(a.startTime).getTime() : 0
    const timeB = b.startTime ? new Date(b.startTime).getTime() : 0
    return timeB - timeA
  })
}

export const useDevOpsStore = create<DevOpsState>((set, get) => ({
  data: null,
  loading: false,
  activeConnectionId: null,
  pipelines: [],
  pipelinesLoading: false,
  pipelinesError: null,
  selectedPipelineId: null,
  pipelineRuns: [],
  runsLoading: false,

  loadData: async (projectPath) => {
    set({ loading: true })
    try {
      const data = await window.kanbai.devops.load(projectPath)
      set({ data, loading: false })
      if (data.connections.length > 0 && !get().activeConnectionId) {
        set({ activeConnectionId: data.connections[0]!.id })
      }
    } catch {
      set({ loading: false })
    }
  },

  saveData: async (projectPath) => {
    const { data } = get()
    if (!data) return
    await window.kanbai.devops.save(projectPath, data)
  },

  addConnection: async (projectPath, connectionData) => {
    const { data } = get()
    if (!data) return
    const now = Date.now()
    const connection: DevOpsConnection = {
      ...connectionData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    const updated = { ...data, connections: [...data.connections, connection] }
    set({ data: updated, activeConnectionId: connection.id })
    await window.kanbai.devops.save(projectPath, updated)
  },

  updateConnection: async (projectPath, id, updates) => {
    const { data } = get()
    if (!data) return
    const updated = {
      ...data,
      connections: data.connections.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c,
      ),
    }
    set({ data: updated })
    await window.kanbai.devops.save(projectPath, updated)
  },

  deleteConnection: async (projectPath, id) => {
    const { data, activeConnectionId } = get()
    if (!data) return
    const updated = {
      ...data,
      connections: data.connections.filter((c) => c.id !== id),
    }
    const newActive = activeConnectionId === id
      ? (updated.connections[0]?.id ?? null)
      : activeConnectionId
    set({ data: updated, activeConnectionId: newActive, pipelines: [], selectedPipelineId: null, pipelineRuns: [] })
    await window.kanbai.devops.save(projectPath, updated)
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id, pipelines: [], selectedPipelineId: null, pipelineRuns: [], pipelinesError: null })
  },

  testConnection: async (connection) => {
    return window.kanbai.devops.testConnection(connection)
  },

  loadPipelines: async (connection) => {
    set({ pipelinesLoading: true, pipelinesError: null })
    const result = await window.kanbai.devops.listPipelines(connection)
    if (result.success) {
      const { data, activeConnectionId } = get()
      const savedOrder = activeConnectionId ? data?.pipelineOrder?.[activeConnectionId] : undefined
      const ordered = applySavedOrder(result.pipelines, savedOrder)
      set({ pipelines: ordered, pipelinesLoading: false })
    } else {
      set({ pipelines: [], pipelinesLoading: false, pipelinesError: result.error ?? 'Unknown error' })
    }
  },

  selectPipeline: (pipelineId) => {
    set({ selectedPipelineId: pipelineId, pipelineRuns: [] })
  },

  loadPipelineRuns: async (connection, pipelineId) => {
    set({ runsLoading: true })
    const result = await window.kanbai.devops.getPipelineRuns(connection, pipelineId)
    if (result.success) {
      set({ pipelineRuns: sortRunsByDate(result.runs), runsLoading: false })
    } else {
      set({ pipelineRuns: [], runsLoading: false })
    }
  },

  runPipeline: async (connection, pipelineId, branch) => {
    const result = await window.kanbai.devops.runPipeline(connection, pipelineId, branch)
    if (result.success) {
      // Refresh pipeline runs after triggering
      const { loadPipelineRuns } = get()
      await loadPipelineRuns(connection, pipelineId)
    }
    return { success: result.success, error: result.error }
  },

  reorderPipelines: async (projectPath, fromIndex, toIndex) => {
    const { pipelines, data, activeConnectionId } = get()
    if (!data || !activeConnectionId) return
    const reordered = [...pipelines]
    const [moved] = reordered.splice(fromIndex, 1)
    if (!moved) return
    reordered.splice(toIndex, 0, moved)
    const newOrder = reordered.map((p) => p.id)
    const updatedData: DevOpsFile = {
      ...data,
      pipelineOrder: {
        ...data.pipelineOrder,
        [activeConnectionId]: newOrder,
      },
    }
    set({ pipelines: reordered, data: updatedData })
    await window.kanbai.devops.save(projectPath, updatedData)
  },
}))
