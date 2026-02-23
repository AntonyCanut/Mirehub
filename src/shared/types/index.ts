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

export interface KanbanAttachment {
  id: string
  filename: string
  storedPath: string
  mimeType: string
  size: number
  addedAt: number
}

export interface KanbanTask {
  id: string
  workspaceId: string
  targetProjectId?: string
  title: string
  description: string
  status: KanbanStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  agentId?: string
  question?: string
  result?: string
  error?: string
  labels?: string[]
  attachments?: KanbanAttachment[]
  dueDate?: number
  createdAt: number
  updatedAt: number
}

export type KanbanStatus = 'TODO' | 'WORKING' | 'PENDING' | 'DONE' | 'FAILED'

export interface UpdateInfo {
  tool: string
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  installed: boolean
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

export type Locale = 'fr' | 'en'

export type ThemeName = 'dark' | 'light' | 'terracotta' | 'system'

export interface AppSettings {
  theme: ThemeName
  locale: Locale
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
  size?: number
  modifiedAt?: number
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

export interface GitTag {
  name: string
  hash: string
  message: string
  date: string
  isAnnotated: boolean
}

export interface GitBlameLine {
  hash: string
  author: string
  date: string
  lineNumber: number
  content: string
}

export interface GitRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface TodoEntry {
  file: string
  line: number
  type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE' | 'XXX'
  text: string
}

export interface ProjectStatsData {
  totalFiles: number
  totalLines: number
  fileTypeBreakdown: { ext: string; count: number; lines: number }[]
  largestFiles: { path: string; size: number; lines: number }[]
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

export interface SearchResult {
  file: string
  line: number
  text: string
  column: number
}

export interface PromptTemplate {
  id: string
  name: string
  content: string
  category: string
  createdAt: number
}

export interface WorkspaceExportData {
  name: string
  color: string
  icon?: string
  projectPaths: string[]
  exportedAt: number
}

// API Tester types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface ApiEnvironment {
  id: string
  name: string
  variables: Record<string, string>
  isActive?: boolean
}

export interface ApiHeader {
  key: string
  value: string
  enabled: boolean
}

export interface ApiTestAssertion {
  type: 'status' | 'body_contains' | 'header_contains' | 'json_path' | 'response_time'
  expected: string
}

export interface ApiRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: ApiHeader[]
  body: string
  bodyType: 'json' | 'form' | 'text' | 'none'
  tests: ApiTestAssertion[]
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

export interface ApiTestResult {
  assertion: ApiTestAssertion
  passed: boolean
  actual: string
}

export interface ApiCollection {
  id: string
  name: string
  requests: ApiRequest[]
}

export interface ApiChainStep {
  requestId: string
  extractVariables: Array<{ name: string; from: 'body' | 'header'; path: string }>
  delay?: number
}

export interface ApiChain {
  id: string
  name: string
  steps: ApiChainStep[]
}

export interface HealthCheck {
  id: string
  name: string
  url: string
  method: 'GET' | 'HEAD'
  expectedStatus: number
  headers: ApiHeader[]
  lastResult?: HealthCheckResult
}

export interface HealthCheckResult {
  status: number
  responseTime: number
  success: boolean
  timestamp: number
  error?: string
}

export interface ApiTestFile {
  version: 1
  environments: ApiEnvironment[]
  collections: ApiCollection[]
  chains: ApiChain[]
  healthChecks: HealthCheck[]
}

// Database Explorer types
export type DbEngine = 'postgresql' | 'mysql' | 'mssql' | 'mongodb' | 'sqlite'
export type DbEnvironmentTag = 'local' | 'dev' | 'int' | 'qua' | 'prd' | 'custom'
export type DbConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface DbConnectionConfig {
  engine: DbEngine
  connectionString?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
  filePath?: string
  ssl?: boolean
}

export interface DbConnection {
  id: string
  name: string
  engine: DbEngine
  environmentTag: DbEnvironmentTag
  customTagName?: string
  config: DbConnectionConfig
  workspaceId: string
  createdAt: number
  updatedAt: number
}

export interface DbTable {
  name: string
  schema?: string
  type: 'table' | 'view' | 'collection'
  rowCount?: number
}

export interface DbColumn {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  defaultValue?: string
}

export interface DbIndex {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

export interface DbTableInfo {
  columns: DbColumn[]
  indexes: DbIndex[]
  rowCount: number
}

export interface DbQueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  totalRows?: number
  executionTime: number
  error?: string
}

export interface DbBackupResult {
  success: boolean
  filePath?: string
  size?: number
  error?: string
}

export interface DbBackupEntry {
  id: string
  connectionId: string
  connectionName: string
  engine: DbEngine
  database: string
  timestamp: number
  filePath: string
  size: number
  dataOnly?: boolean
  schemaOnly?: boolean
  tables?: string[]
  environmentTag?: DbEnvironmentTag
}

export interface DbBackupLogEntry {
  timestamp: number
  type: 'info' | 'command' | 'stdout' | 'stderr' | 'success' | 'error'
  message: string
  connectionName?: string
  operation: 'backup' | 'restore'
}

export interface DbBackupManifest {
  version: 1
  entries: DbBackupEntry[]
}

export interface DbRestoreResult {
  success: boolean
  error?: string
  warnings?: number
}

export interface DbTransferResult {
  success: boolean
  tablesTransferred: number
  rowsTransferred: number
  errors: string[]
}

export interface DbFile {
  version: 1
  connections: DbConnection[]
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
  KANBAN_WRITE_PROMPT: 'kanban:writePrompt',
  KANBAN_CLEANUP_PROMPT: 'kanban:cleanupPrompt',
  KANBAN_GET_PATH: 'kanban:getPath',
  KANBAN_SELECT_FILES: 'kanban:selectFiles',
  KANBAN_ATTACH_FILE: 'kanban:attachFile',
  KANBAN_ATTACH_FROM_CLIPBOARD: 'kanban:attachFromClipboard',
  KANBAN_REMOVE_ATTACHMENT: 'kanban:removeAttachment',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_UNINSTALL: 'update:uninstall',
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
  FS_READ_BASE64: 'fs:readBase64',
  FS_OPEN_IN_FINDER: 'fs:openInFinder',
  FS_SEARCH: 'fs:search',

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
  GIT_FETCH: 'git:fetch',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DISCARD: 'git:discard',
  GIT_SHOW: 'git:show',
  GIT_STASH_LIST: 'git:stashList',
  GIT_RENAME_BRANCH: 'git:renameBranch',
  GIT_TAGS: 'git:tags',
  GIT_CREATE_TAG: 'git:createTag',
  GIT_DELETE_TAG: 'git:deleteTag',
  GIT_CHERRY_PICK: 'git:cherryPick',
  GIT_DIFF_BRANCHES: 'git:diffBranches',
  GIT_BLAME: 'git:blame',
  GIT_REMOTES: 'git:remotes',
  GIT_ADD_REMOTE: 'git:addRemote',
  GIT_REMOVE_REMOTE: 'git:removeRemote',

  // Workspace storage (.workspaces dir)
  WORKSPACE_INIT_DIR: 'workspace:initDir',

  // Session
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',
  SESSION_CLEAR: 'session:clear',

  // Workspace env (virtual env with symlinks)
  WORKSPACE_ENV_SETUP: 'workspace:envSetup',
  WORKSPACE_ENV_PATH: 'workspace:envPath',
  WORKSPACE_ENV_DELETE: 'workspace:envDelete',

  // Project Claude write
  PROJECT_WRITE_CLAUDE_SETTINGS: 'project:writeClaudeSettings',
  PROJECT_WRITE_CLAUDE_MD: 'project:writeClaudeMd',

  // Project scanning (TODO scanner, stats)
  PROJECT_SCAN_TODOS: 'project:scanTodos',
  PROJECT_STATS: 'project:stats',

  // Project notes
  PROJECT_GET_NOTES: 'project:getNotes',
  PROJECT_SAVE_NOTES: 'project:saveNotes',

  // Workspace export/import
  WORKSPACE_EXPORT: 'workspace:export',
  WORKSPACE_IMPORT: 'workspace:import',

  // Prompt templates
  PROMPTS_LIST: 'prompts:list',
  PROMPTS_CREATE: 'prompts:create',
  PROMPTS_UPDATE: 'prompts:update',
  PROMPTS_DELETE: 'prompts:delete',

  // Claude agents & skills
  CLAUDE_LIST_AGENTS: 'claude:listAgents',
  CLAUDE_READ_AGENT: 'claude:readAgent',
  CLAUDE_WRITE_AGENT: 'claude:writeAgent',
  CLAUDE_DELETE_AGENT: 'claude:deleteAgent',
  CLAUDE_LIST_SKILLS: 'claude:listSkills',
  CLAUDE_READ_SKILL: 'claude:readSkill',
  CLAUDE_WRITE_SKILL: 'claude:writeSkill',
  CLAUDE_DELETE_SKILL: 'claude:deleteSkill',

  // Claude defaults library
  CLAUDE_DEFAULTS_PROFILES: 'claude:defaultsProfiles',
  CLAUDE_DEFAULTS_SKILLS: 'claude:defaultsSkills',
  CLAUDE_DEPLOY_PROFILE: 'claude:deployProfile',
  CLAUDE_DEPLOY_SKILL: 'claude:deploySkill',
  CLAUDE_CHECK_DEPLOYED: 'claude:checkDeployed',

  // Claude activity hooks
  CLAUDE_ACTIVITY: 'claude:activity',
  CLAUDE_INSTALL_HOOKS: 'claude:installHooks',
  CLAUDE_CHECK_HOOKS: 'claude:checkHooks',
  CLAUDE_VALIDATE_SETTINGS: 'claude:validateSettings',
  CLAUDE_FIX_SETTINGS: 'claude:fixSettings',

  // API Tester
  API_EXECUTE: 'api:execute',
  API_LOAD: 'api:load',
  API_SAVE: 'api:save',
  API_EXPORT: 'api:export',
  API_IMPORT: 'api:import',

  // Database Explorer
  DB_CONNECT: 'db:connect',
  DB_DISCONNECT: 'db:disconnect',
  DB_TEST_CONNECTION: 'db:testConnection',
  DB_LIST_DATABASES: 'db:listDatabases',
  DB_LIST_SCHEMAS: 'db:listSchemas',
  DB_LIST_TABLES: 'db:listTables',
  DB_TABLE_INFO: 'db:tableInfo',
  DB_EXECUTE_QUERY: 'db:executeQuery',
  DB_CANCEL_QUERY: 'db:cancelQuery',
  DB_LOAD: 'db:load',
  DB_SAVE: 'db:save',
  DB_EXPORT: 'db:export',
  DB_IMPORT: 'db:import',
  DB_BACKUP: 'db:backup',
  DB_BACKUP_LIST: 'db:backupList',
  DB_BACKUP_DELETE: 'db:backupDelete',
  DB_RESTORE: 'db:restore',
  DB_TRANSFER: 'db:transfer',
  DB_QUERY_PROGRESS: 'db:queryProgress',
  DB_BACKUP_LOG: 'db:backupLog',

  // App
  APP_SETTINGS_GET: 'app:settingsGet',
  APP_SETTINGS_SET: 'app:settingsSet',
  APP_NOTIFICATION: 'app:notification',
  APP_VERSION: 'app:version',

  // App Update (electron-updater)
  APP_UPDATE_CHECK: 'appUpdate:check',
  APP_UPDATE_DOWNLOAD: 'appUpdate:download',
  APP_UPDATE_INSTALL: 'appUpdate:install',
  APP_UPDATE_STATUS: 'appUpdate:status',
} as const
