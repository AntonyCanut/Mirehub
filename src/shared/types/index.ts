// Types partagés entre main et renderer

export interface Workspace {
  id: string
  name: string
  icon?: string
  color: string
  projectIds: string[]
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  path: string
  hasClaude: boolean
  hasGit?: boolean
  workspaceId: string
  createdAt: number
}

export interface TerminalSession {
  id: string
  projectId?: string
  title: string
  cwd: string
  shell: string
  pid?: number
  isActive: boolean
}

export interface TerminalTab {
  id: string
  label: string
  color?: string
  panes: TerminalPane[]
  activePane: string
}

export interface TerminalPane {
  id: string
  sessionId: string
  splitDirection?: 'horizontal' | 'vertical'
  size: number // percentage
}

export interface ClaudeSession {
  id: string
  projectId: string
  terminalId: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  startedAt: number
  endedAt?: number
  prompt?: string
  loopMode: boolean
  loopCount: number
  loopDelay: number // ms
}

export interface KanbanTask {
  id: string
  projectId: string
  title: string
  description: string
  status: KanbanStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  agentId?: string
  question?: string
  result?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export type KanbanStatus = 'TODO' | 'WORKING' | 'PENDING' | 'DONE' | 'FAILED'

export interface UpdateInfo {
  tool: string
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  scope: 'global' | 'project' | 'unit'
  projectId?: string
}

export interface AutoClauderTemplate {
  id: string
  name: string
  description: string
  claudeMd: string
  settings: Record<string, unknown>
  createdAt: number
}

export interface SessionTab {
  workspaceId: string
  cwd: string
  label: string
  isSplit: boolean
  leftCommand: string | null
  rightCommand: string | null
}

export interface SessionData {
  activeWorkspaceId: string | null
  activeProjectId: string | null
  tabs: SessionTab[]
  savedAt: number
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  defaultShell: string
  fontSize: number
  fontFamily: string
  scrollbackLines: number
  claudeDetectionColor: string
  autoClauderEnabled: boolean
  defaultAutoClauderTemplateId?: string
  notificationSound: boolean
  checkUpdatesOnLaunch: boolean
}

export interface ProjectInfo {
  hasMakefile: boolean
  makeTargets: string[]
  hasGit: boolean
  gitBranch: string | null
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isSymlink: boolean
}

export interface GitLogEntry {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  parents: string[]
  refs: string[]
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
}

export interface NpmPackageInfo {
  name: string
  currentVersion: string
  latestVersion: string | null
  isDeprecated: boolean
  deprecationMessage?: string
  updateAvailable: boolean
  type: 'dependency' | 'devDependency'
}

// IPC Channel types
export const IPC_CHANNELS = {
  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_INPUT: 'terminal:input',

  // Workspace
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',

  // Project
  PROJECT_LIST: 'project:list',
  PROJECT_ADD: 'project:add',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_SCAN_CLAUDE: 'project:scanClaude',
  PROJECT_SELECT_DIR: 'project:selectDir',

  // Claude
  CLAUDE_START: 'claude:start',
  CLAUDE_STOP: 'claude:stop',
  CLAUDE_STATUS: 'claude:status',
  CLAUDE_SESSION_END: 'claude:sessionEnd',

  // Kanban
  KANBAN_LIST: 'kanban:list',
  KANBAN_CREATE: 'kanban:create',
  KANBAN_UPDATE: 'kanban:update',
  KANBAN_DELETE: 'kanban:delete',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',

  // Auto-Clauder
  AUTOCLAUDE_APPLY: 'autoclaude:apply',
  AUTOCLAUDE_TEMPLATES: 'autoclaude:templates',

  // Project info
  PROJECT_SCAN_INFO: 'project:scanInfo',
  PROJECT_DEPLOY_CLAUDE: 'project:deployClaude',
  PROJECT_CHECK_CLAUDE: 'project:checkClaude',
  PROJECT_CHECK_PACKAGES: 'project:checkPackages',
  PROJECT_UPDATE_PACKAGE: 'project:updatePackage',

  // File system
  FS_READ_DIR: 'fs:readDir',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_COPY: 'fs:copy',
  FS_MKDIR: 'fs:mkdir',
  FS_EXISTS: 'fs:exists',

  // Git
  GIT_INIT: 'git:init',
  GIT_STATUS: 'git:status',
  GIT_LOG: 'git:log',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_STASH: 'git:stash',
  GIT_STASH_POP: 'git:stashPop',
  GIT_CREATE_BRANCH: 'git:createBranch',
  GIT_DELETE_BRANCH: 'git:deleteBranch',
  GIT_MERGE: 'git:merge',

  // Workspace storage (.workspaces dir)
  WORKSPACE_INIT_DIR: 'workspace:initDir',

  // Session
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',
  SESSION_CLEAR: 'session:clear',

  // Workspace env (virtual env with symlinks)
  WORKSPACE_ENV_SETUP: 'workspace:envSetup',
  WORKSPACE_ENV_PATH: 'workspace:envPath',

  // Project Claude write
  PROJECT_WRITE_CLAUDE_SETTINGS: 'project:writeClaudeSettings',
  PROJECT_WRITE_CLAUDE_MD: 'project:writeClaudeMd',

  // App
  APP_SETTINGS_GET: 'app:settingsGet',
  APP_SETTINGS_SET: 'app:settingsSet',
  APP_NOTIFICATION: 'app:notification',
} as const
