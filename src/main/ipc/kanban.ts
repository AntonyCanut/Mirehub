import { IpcMain } from 'electron'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { IPC_CHANNELS, KanbanTask, KanbanStatus } from '../../shared/types'

function ensureWorkspacesDir(projectPath: string): string {
  const dir = path.join(projectPath, '.workspaces')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getKanbanPath(projectPath: string): string {
  const dir = ensureWorkspacesDir(projectPath)
  return path.join(dir, 'kanban.json')
}

function readKanbanTasks(projectPath: string): KanbanTask[] {
  const filePath = getKanbanPath(projectPath)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeKanbanTasks(projectPath: string, tasks: KanbanTask[]): void {
  const filePath = getKanbanPath(projectPath)
  ensureWorkspacesDir(projectPath)
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf-8')
}

export function registerKanbanHandlers(ipcMain: IpcMain): void {
  // Init .workspaces directory
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_INIT_DIR,
    async (_event, { projectPath }: { projectPath: string }) => {
      ensureWorkspacesDir(projectPath)
      return true
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_LIST,
    async (_event, { projectPath }: { projectPath?: string }) => {
      if (!projectPath) return []
      return readKanbanTasks(projectPath)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_CREATE,
    async (
      _event,
      data: {
        projectPath: string
        projectId: string
        title: string
        description: string
        priority: 'low' | 'medium' | 'high' | 'critical'
        status?: KanbanStatus
      },
    ) => {
      const task: KanbanTask = {
        id: uuid(),
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        status: data.status || 'TODO',
        priority: data.priority,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const tasks = readKanbanTasks(data.projectPath)
      tasks.push(task)
      writeKanbanTasks(data.projectPath, tasks)
      return task
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_UPDATE,
    async (_event, data: Partial<KanbanTask> & { id: string; projectPath: string }) => {
      const tasks = readKanbanTasks(data.projectPath)
      const idx = tasks.findIndex((t) => t.id === data.id)
      if (idx === -1) throw new Error(`Kanban task ${data.id} not found`)

      const { projectPath: _pp, ...updateData } = data
      tasks[idx] = { ...tasks[idx]!, ...updateData, updatedAt: Date.now() }
      writeKanbanTasks(data.projectPath, tasks)
      return tasks[idx]
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_DELETE,
    async (_event, { id, projectPath }: { id: string; projectPath: string }) => {
      const tasks = readKanbanTasks(projectPath)
      const filtered = tasks.filter((t) => t.id !== id)
      writeKanbanTasks(projectPath, filtered)
    },
  )
}
