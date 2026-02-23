import fs from 'fs'
import path from 'path'
import os from 'os'
import { Workspace, Project, AppSettings, KanbanTask, AutoClauderTemplate, SessionData } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/constants/defaults'

const DATA_DIR = path.join(os.homedir(), '.mirehub')

interface AppData {
  workspaces: Workspace[]
  projects: Project[]
  settings: AppSettings
  kanbanTasks: KanbanTask[]
  autoClauderTemplates: AutoClauderTemplate[]
}

let _instance: StorageService | null = null

export function _resetForTesting(): void {
  _instance = null
}

export class StorageService {
  private dataPath: string
  private data: AppData

  constructor() {
    // Enforce singleton: all handlers must share the same in-memory data
    if (_instance) return _instance
    // Auto-migrate from old data directories
    const OLD_DIRS = [
      path.join(os.homedir(), '.tasks'),
      path.join(os.homedir(), '.theone'),
    ]
    if (!fs.existsSync(DATA_DIR)) {
      for (const oldDir of OLD_DIRS) {
        if (fs.existsSync(oldDir)) {
          fs.renameSync(oldDir, DATA_DIR)
          break
        }
      }
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    this.dataPath = path.join(DATA_DIR, 'data.json')
    this.data = this.load()
    _instance = this
  }

  private load(): AppData {
    if (fs.existsSync(this.dataPath)) {
      const raw = fs.readFileSync(this.dataPath, 'utf-8')
      return JSON.parse(raw)
    }
    return {
      workspaces: [],
      projects: [],
      settings: { ...DEFAULT_SETTINGS },
      kanbanTasks: [],
      autoClauderTemplates: [],
    }
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  // Workspaces
  getWorkspaces(): Workspace[] {
    return this.data.workspaces
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.data.workspaces.find((w) => w.id === id)
  }

  addWorkspace(workspace: Workspace): void {
    this.data.workspaces.push(workspace)
    this.save()
  }

  updateWorkspace(workspace: Workspace): void {
    const idx = this.data.workspaces.findIndex((w) => w.id === workspace.id)
    if (idx >= 0) {
      this.data.workspaces[idx] = workspace
      this.save()
    }
  }

  deleteWorkspace(id: string): void {
    this.data.workspaces = this.data.workspaces.filter((w) => w.id !== id)
    this.data.projects = this.data.projects.filter((p) => p.workspaceId !== id)
    this.save()
  }

  // Projects
  getProjects(workspaceId?: string): Project[] {
    if (workspaceId) {
      return this.data.projects.filter((p) => p.workspaceId === workspaceId)
    }
    return this.data.projects
  }

  addProject(project: Project): void {
    this.data.projects.push(project)
    this.save()
  }

  deleteProject(id: string): void {
    this.data.projects = this.data.projects.filter((p) => p.id !== id)
    this.save()
  }

  // Settings
  getSettings(): AppSettings {
    return this.data.settings
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.data.settings = { ...this.data.settings, ...partial }
    this.save()
  }

  // Kanban
  getKanbanTasks(workspaceId?: string): KanbanTask[] {
    if (workspaceId) {
      return this.data.kanbanTasks.filter((t) => t.workspaceId === workspaceId)
    }
    return this.data.kanbanTasks
  }

  addKanbanTask(task: KanbanTask): void {
    this.data.kanbanTasks.push(task)
    this.save()
  }

  updateKanbanTask(task: KanbanTask): void {
    const idx = this.data.kanbanTasks.findIndex((t) => t.id === task.id)
    if (idx >= 0) {
      this.data.kanbanTasks[idx] = task
      this.save()
    }
  }

  deleteKanbanTask(id: string): void {
    this.data.kanbanTasks = this.data.kanbanTasks.filter((t) => t.id !== id)
    this.save()
  }

  // Auto-Clauder Templates
  getTemplates(): AutoClauderTemplate[] {
    return this.data.autoClauderTemplates
  }

  addTemplate(template: AutoClauderTemplate): void {
    this.data.autoClauderTemplates.push(template)
    this.save()
  }

  deleteTemplate(id: string): void {
    this.data.autoClauderTemplates = this.data.autoClauderTemplates.filter((t) => t.id !== id)
    this.save()
  }

  // Session
  getSession(): SessionData | null {
    const sessionPath = path.join(DATA_DIR, 'session.json')
    if (fs.existsSync(sessionPath)) {
      try {
        const raw = fs.readFileSync(sessionPath, 'utf-8')
        return JSON.parse(raw) as SessionData
      } catch {
        return null
      }
    }
    return null
  }

  saveSession(session: SessionData): void {
    const sessionPath = path.join(DATA_DIR, 'session.json')
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8')
  }

  clearSession(): void {
    const sessionPath = path.join(DATA_DIR, 'session.json')
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath)
    }
  }
}
