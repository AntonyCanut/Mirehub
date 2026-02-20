import { create } from 'zustand'
import type { KanbanTask, KanbanStatus } from '../../../shared/types/index'

interface KanbanState {
  tasks: KanbanTask[]
  isLoading: boolean
  draggedTaskId: string | null
  currentProjectPath: string | null
}

interface KanbanActions {
  loadTasks: (projectId: string, projectPath: string) => Promise<void>
  createTask: (
    projectId: string,
    projectPath: string,
    title: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
  ) => Promise<void>
  updateTaskStatus: (taskId: string, status: KanbanStatus) => Promise<void>
  updateTask: (taskId: string, data: Partial<KanbanTask>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  setDragged: (taskId: string | null) => void
  getTasksByStatus: (status: KanbanStatus) => KanbanTask[]
}

type KanbanStore = KanbanState & KanbanActions

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  draggedTaskId: null,
  currentProjectPath: null,

  loadTasks: async (projectId: string, projectPath: string) => {
    set({ isLoading: true, currentProjectPath: projectPath })
    try {
      const tasks: KanbanTask[] = await window.theone.kanban.list(projectPath)
      set({ tasks })
    } finally {
      set({ isLoading: false })
    }
  },

  createTask: async (projectId, projectPath, title, description, priority) => {
    const task: KanbanTask = await window.theone.kanban.create({
      projectId,
      projectPath,
      title,
      description,
      status: 'TODO',
      priority,
    })
    set((state) => ({ tasks: [...state.tasks, task] }))
  },

  updateTaskStatus: async (taskId, status) => {
    const { currentProjectPath } = get()
    if (!currentProjectPath) return
    await window.theone.kanban.update({ id: taskId, status, projectPath: currentProjectPath })
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t)),
    }))
  },

  updateTask: async (taskId, data) => {
    const { currentProjectPath } = get()
    if (!currentProjectPath) return
    await window.theone.kanban.update({ id: taskId, ...data, projectPath: currentProjectPath })
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...data, updatedAt: Date.now() } : t)),
    }))
  },

  deleteTask: async (taskId) => {
    const { currentProjectPath } = get()
    if (!currentProjectPath) return
    await window.theone.kanban.delete(taskId, currentProjectPath)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }))
  },

  setDragged: (taskId) => set({ draggedTaskId: taskId }),

  getTasksByStatus: (status) => {
    return get().tasks.filter((t) => t.status === status)
  },
}))
