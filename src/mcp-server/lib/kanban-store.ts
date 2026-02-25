import fs from 'fs'
import path from 'path'
import os from 'os'
import { v4 as uuid } from 'uuid'
import type { KanbanTask, KanbanStatus } from '../../shared/types'

export function getKanbanDir(): string {
  const dir = path.join(os.homedir(), '.mirehub', 'kanban')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getKanbanPath(workspaceId: string): string {
  return path.join(getKanbanDir(), `${workspaceId}.json`)
}

export function readKanbanTasks(workspaceId: string): KanbanTask[] {
  const filePath = getKanbanPath(workspaceId)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function writeKanbanTasks(workspaceId: string, tasks: KanbanTask[]): void {
  const filePath = getKanbanPath(workspaceId)
  getKanbanDir()
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf-8')
}

export function getNextTicketNumber(tasks: KanbanTask[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.ticketNumber ?? 0), 0) + 1
}

export function createKanbanTask(
  workspaceId: string,
  data: {
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    status?: KanbanStatus
    targetProjectId?: string
    labels?: string[]
    isCtoTicket?: boolean
    disabled?: boolean
  },
): KanbanTask {
  const tasks = readKanbanTasks(workspaceId)
  const task: KanbanTask = {
    id: uuid(),
    workspaceId,
    targetProjectId: data.targetProjectId,
    ticketNumber: getNextTicketNumber(tasks),
    title: data.title,
    description: data.description,
    status: data.status || 'TODO',
    priority: data.priority,
    labels: data.labels,
    isCtoTicket: data.isCtoTicket,
    disabled: data.disabled,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  tasks.push(task)
  writeKanbanTasks(workspaceId, tasks)
  return task
}

export function updateKanbanTask(
  workspaceId: string,
  taskId: string,
  updates: Partial<KanbanTask>,
): KanbanTask {
  const tasks = readKanbanTasks(workspaceId)
  const idx = tasks.findIndex((t) => t.id === taskId)
  if (idx === -1) throw new Error(`Kanban task ${taskId} not found`)
  const { workspaceId: _wid, ...safeUpdates } = updates
  tasks[idx] = { ...tasks[idx]!, ...safeUpdates, updatedAt: Date.now() }
  writeKanbanTasks(workspaceId, tasks)
  return tasks[idx]!
}

export function deleteKanbanTask(workspaceId: string, taskId: string): void {
  const tasks = readKanbanTasks(workspaceId)
  const filtered = tasks.filter((t) => t.id !== taskId)
  writeKanbanTasks(workspaceId, filtered)
}
