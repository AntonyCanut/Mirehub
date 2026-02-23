import { IpcMain, dialog } from 'electron'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { IPC_CHANNELS, KanbanTask, KanbanStatus, KanbanAttachment } from '../../shared/types'

/**
 * Ensures a Claude Stop hook exists to auto-update kanban task status.
 * The hook reads MIREHUB_KANBAN_TASK_ID / MIREHUB_KANBAN_FILE env vars
 * (only set on kanban sessions) and updates the kanban.json file.
 */
function ensureKanbanHook(projectPath: string): void {
  const hooksDir = path.join(projectPath, '.mirehub', 'hooks')
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true })
  }

  const hookScriptPath = path.join(hooksDir, 'kanban-done.sh')
  const hookScript = `#!/bin/bash
# Mirehub - Kanban task completion hook (auto-generated)
[ -z "$MIREHUB_KANBAN_TASK_ID" ] && exit 0
[ -z "$MIREHUB_KANBAN_FILE" ] && exit 0

node -e "
const fs = require('fs');
const file = process.env.MIREHUB_KANBAN_FILE;
const taskId = process.env.MIREHUB_KANBAN_TASK_ID;
try {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);
  if (task && task.status === 'WORKING') {
    task.status = 'DONE';
    task.updatedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf-8');
  }
} catch(e) { /* ignore */ }
"
`
  fs.writeFileSync(hookScriptPath, hookScript, { mode: 0o755 })

  const claudeDir = path.join(projectPath, '.claude')
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  const settingsPath = path.join(claudeDir, 'settings.local.json')
  let settings: Record<string, unknown> = {}
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } catch { /* ignore corrupt file */ }
  }

  if (!settings.hooks) {
    settings.hooks = {}
  }
  const hooks = settings.hooks as Record<string, unknown[]>
  if (!hooks.Stop) {
    hooks.Stop = []
  }

  const stopHooks = hooks.Stop as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
  const alreadyConfigured = stopHooks.some((h) =>
    h.hooks?.some((hk) => hk.command?.includes('kanban-done.sh')),
  )

  if (!alreadyConfigured) {
    stopHooks.push({
      matcher: '',
      hooks: [{ type: 'command', command: `bash "${hookScriptPath}"` }],
    })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  }
}

function getAttachmentsDir(taskId: string): string {
  const dir = path.join(os.homedir(), '.mirehub', 'kanban', 'attachments', taskId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.zip': 'application/zip',
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function getKanbanDir(): string {
  const dir = path.join(os.homedir(), '.mirehub', 'kanban')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getKanbanPath(workspaceId: string): string {
  return path.join(getKanbanDir(), `${workspaceId}.json`)
}

function ensureWorkspacesDir(projectPath: string): string {
  const dir = path.join(projectPath, '.mirehub')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function readKanbanTasks(workspaceId: string): KanbanTask[] {
  const filePath = getKanbanPath(workspaceId)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeKanbanTasks(workspaceId: string, tasks: KanbanTask[]): void {
  const filePath = getKanbanPath(workspaceId)
  getKanbanDir()
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
    async (_event, { workspaceId }: { workspaceId?: string }) => {
      if (!workspaceId) return []
      return readKanbanTasks(workspaceId)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_CREATE,
    async (
      _event,
      data: {
        workspaceId: string
        targetProjectId?: string
        title: string
        description: string
        priority: 'low' | 'medium' | 'high' | 'critical'
        status?: KanbanStatus
      },
    ) => {
      const task: KanbanTask = {
        id: uuid(),
        workspaceId: data.workspaceId,
        targetProjectId: data.targetProjectId,
        title: data.title,
        description: data.description,
        status: data.status || 'TODO',
        priority: data.priority,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const tasks = readKanbanTasks(data.workspaceId)
      tasks.push(task)
      writeKanbanTasks(data.workspaceId, tasks)
      return task
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_UPDATE,
    async (_event, data: Partial<KanbanTask> & { id: string; workspaceId: string }) => {
      const tasks = readKanbanTasks(data.workspaceId)
      const idx = tasks.findIndex((t) => t.id === data.id)
      if (idx === -1) throw new Error(`Kanban task ${data.id} not found`)

      const { workspaceId: _wid, ...updateData } = data
      tasks[idx] = { ...tasks[idx]!, ...updateData, updatedAt: Date.now() }
      writeKanbanTasks(data.workspaceId, tasks)
      return tasks[idx]
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_DELETE,
    async (_event, { id, workspaceId }: { id: string; workspaceId: string }) => {
      const tasks = readKanbanTasks(workspaceId)
      const filtered = tasks.filter((t) => t.id !== id)
      writeKanbanTasks(workspaceId, filtered)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_WRITE_PROMPT,
    async (_event, { projectPath, taskId, prompt }: { projectPath: string; taskId: string; prompt: string }) => {
      const dir = ensureWorkspacesDir(projectPath)
      const promptPath = path.join(dir, `.kanban-prompt-${taskId}.md`)
      fs.writeFileSync(promptPath, prompt, 'utf-8')

      // Setup kanban hook (best-effort)
      try {
        ensureKanbanHook(projectPath)
      } catch { /* non-critical */ }

      return promptPath
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_CLEANUP_PROMPT,
    async (_event, { projectPath, taskId }: { projectPath: string; taskId: string }) => {
      const dir = path.join(projectPath, '.mirehub')
      const promptPath = path.join(dir, `.kanban-prompt-${taskId}.md`)
      try {
        if (fs.existsSync(promptPath)) {
          fs.unlinkSync(promptPath)
        }
      } catch { /* best-effort cleanup */ }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_GET_PATH,
    async (_event, { workspaceId }: { workspaceId: string }) => {
      return getKanbanPath(workspaceId)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_SELECT_FILES,
    async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      })
      if (result.canceled) return []
      return result.filePaths
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_ATTACH_FILE,
    async (
      _event,
      { taskId, workspaceId, filePath }: { taskId: string; workspaceId: string; filePath: string },
    ) => {
      const attachDir = getAttachmentsDir(taskId)
      const filename = path.basename(filePath)
      const attachId = uuid()
      const storedPath = path.join(attachDir, `${attachId}-${filename}`)

      fs.copyFileSync(filePath, storedPath)
      const stats = fs.statSync(storedPath)

      const attachment: KanbanAttachment = {
        id: attachId,
        filename,
        storedPath,
        mimeType: getMimeType(filePath),
        size: stats.size,
        addedAt: Date.now(),
      }

      const tasks = readKanbanTasks(workspaceId)
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        if (!task.attachments) task.attachments = []
        task.attachments.push(attachment)
        task.updatedAt = Date.now()
        writeKanbanTasks(workspaceId, tasks)
      }

      return attachment
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_ATTACH_FROM_CLIPBOARD,
    async (
      _event,
      {
        taskId,
        workspaceId,
        dataBase64,
        filename,
        mimeType,
      }: { taskId: string; workspaceId: string; dataBase64: string; filename: string; mimeType: string },
    ) => {
      const attachDir = getAttachmentsDir(taskId)
      const attachId = uuid()
      const storedPath = path.join(attachDir, `${attachId}-${filename}`)

      const buffer = Buffer.from(dataBase64, 'base64')
      fs.writeFileSync(storedPath, buffer)

      const attachment: KanbanAttachment = {
        id: attachId,
        filename,
        storedPath,
        mimeType,
        size: buffer.length,
        addedAt: Date.now(),
      }

      const tasks = readKanbanTasks(workspaceId)
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        if (!task.attachments) task.attachments = []
        task.attachments.push(attachment)
        task.updatedAt = Date.now()
        writeKanbanTasks(workspaceId, tasks)
      }

      return attachment
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.KANBAN_REMOVE_ATTACHMENT,
    async (
      _event,
      { taskId, workspaceId, attachmentId }: { taskId: string; workspaceId: string; attachmentId: string },
    ) => {
      const tasks = readKanbanTasks(workspaceId)
      const task = tasks.find((t) => t.id === taskId)
      if (!task || !task.attachments) return

      const attachment = task.attachments.find((a) => a.id === attachmentId)
      if (attachment) {
        try {
          if (fs.existsSync(attachment.storedPath)) {
            fs.unlinkSync(attachment.storedPath)
          }
        } catch { /* best-effort cleanup */ }
      }

      task.attachments = task.attachments.filter((a) => a.id !== attachmentId)
      task.updatedAt = Date.now()
      writeKanbanTasks(workspaceId, tasks)
    },
  )
}
