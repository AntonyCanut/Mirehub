import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, AppSettings, Workspace, KanbanTask, KanbanAttachment, FileEntry, SessionData, NpmPackageInfo, TodoEntry, ProjectStatsData, SearchResult, PromptTemplate, HttpMethod, ApiHeader, ApiTestAssertion, ApiTestFile, ApiResponse, ApiTestResult, DbConnectionConfig, DbFile, DbTable, DbTableInfo, DbQueryResult, DbBackupResult, DbBackupEntry, DbRestoreResult, DbEnvironmentTag, DbBackupLogEntry, McpServerConfig, McpHelpResult } from '../shared/types'

// Increase max listeners to accommodate multiple terminal tabs and event streams.
// Each terminal registers onData + onClose listeners on the shared ipcRenderer,
// so the default limit of 10 is easily exceeded.
ipcRenderer.setMaxListeners(50)

const api = {
  // Terminal
  terminal: {
    create: (options: { cwd?: string; shell?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),
    write: (id: string, data: string) =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, { id, cols, rows }),
    close: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CLOSE, { id }),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) =>
        callback(payload)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_DATA, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_DATA, listener)
    },
    onClose: (callback: (data: { id: string; exitCode: number; signal: number }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; exitCode: number; signal: number },
      ) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.TERMINAL_CLOSE, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL_CLOSE, listener)
    },
  },

  // Workspace
  workspace: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LIST),
    create: (data: { name: string; color?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE, data),
    update: (data: { id: string } & Partial<Workspace>) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE, data),
    delete: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE, { id }),
    export: (workspaceId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_EXPORT, { workspaceId }),
    import: (): Promise<{ success: boolean; error?: string; workspace?: Workspace }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_IMPORT),
  },

  // Project
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    selectDir: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_DIR),
    add: (data: { workspaceId: string; path: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD, data),
    remove: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE, { id }),
    scanClaude: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SCAN_CLAUDE, { path }),
    scanInfo: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SCAN_INFO, { path }),
    checkClaude: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_CLAUDE, { path }),
    deployClaude: (targetPath: string, force: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DEPLOY_CLAUDE, { targetPath, force }),
    checkPackages: (projectPath: string): Promise<{ packages: NpmPackageInfo[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_PACKAGES, { path: projectPath }),
    updatePackage: (projectPath: string, packageName?: string): Promise<{ success: boolean; error?: string; output?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE_PACKAGE, { projectPath, packageName }),
    writeClaudeSettings: (projectPath: string, settings: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_WRITE_CLAUDE_SETTINGS, { projectPath, settings }),
    writeClaudeMd: (projectPath: string, content: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_WRITE_CLAUDE_MD, { projectPath, content }),
    scanTodos: (projectPath: string): Promise<TodoEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SCAN_TODOS, { path: projectPath }),
    stats: (projectPath: string): Promise<ProjectStatsData> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_STATS, { path: projectPath }),
    getNotes: (projectId: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_NOTES, { projectId }),
    saveNotes: (projectId: string, content: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE_NOTES, { projectId, content }),
  },

  // File system
  fs: {
    readDir: (dirPath: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIR, { path: dirPath }),
    readFile: (filePath: string): Promise<{ content: string | null; error: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, { path: filePath }),
    writeFile: (filePath: string, content: string): Promise<{ success: boolean; error: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, { path: filePath, content }),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_RENAME, { oldPath, newPath }),
    delete: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_DELETE, { path: filePath }),
    copy: (src: string, dest: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_COPY, { src, dest }),
    mkdir: (dirPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_MKDIR, { path: dirPath }),
    exists: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_EXISTS, { path: filePath }),
    readBase64: (filePath: string): Promise<{ data: string | null; error: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_READ_BASE64, { path: filePath }),
    openInFinder: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_OPEN_IN_FINDER, { path: filePath }),
    search: (cwd: string, query: string, fileTypes?: string[], caseSensitive?: boolean): Promise<SearchResult[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FS_SEARCH, { cwd, query, fileTypes, caseSensitive }),
  },

  // Git
  git: {
    init: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, { cwd }),
    status: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, { cwd }),
    log: (cwd: string, limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.GIT_LOG, { cwd, limit }),
    branches: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCHES, { cwd }),
    checkout: (cwd: string, branch: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, { cwd, branch }),
    push: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, { cwd }),
    pull: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, { cwd }),
    commit: (cwd: string, message: string, files: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, { cwd, message, files }),
    diff: (cwd: string, file?: string, staged?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, { cwd, file, staged }),
    stash: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH, { cwd }),
    stashPop: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_POP, { cwd }),
    createBranch: (cwd: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_BRANCH, { cwd, name }),
    deleteBranch: (cwd: string, name: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DELETE_BRANCH, { cwd, name }),
    merge: (cwd: string, branch: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_MERGE, { cwd, branch }),
    fetch: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, { cwd }),
    stage: (cwd: string, files: string[]) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, { cwd, files }),
    unstage: (cwd: string, files: string[]) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, { cwd, files }),
    discard: (cwd: string, files: string[]) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD, { cwd, files }),
    show: (cwd: string, hash: string): Promise<{ files: Array<{ status: string; file: string }>; diff: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_SHOW, { cwd, hash }),
    stashList: (cwd: string): Promise<Array<{ ref: string; message: string; date: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_LIST, { cwd }),
    renameBranch: (cwd: string, oldName: string, newName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_RENAME_BRANCH, { cwd, oldName, newName }),
    tags: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_TAGS, { cwd }),
    createTag: (cwd: string, name: string, message?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_TAG, { cwd, name, message }),
    deleteTag: (cwd: string, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_DELETE_TAG, { cwd, name }),
    cherryPick: (cwd: string, hash: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_CHERRY_PICK, { cwd, hash }),
    diffBranches: (cwd: string, branch1: string, branch2: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF_BRANCHES, { cwd, branch1, branch2 }),
    blame: (cwd: string, file: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_BLAME, { cwd, file }),
    remotes: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOTES, { cwd }),
    addRemote: (cwd: string, name: string, url: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_ADD_REMOTE, { cwd, name, url }),
    removeRemote: (cwd: string, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOVE_REMOTE, { cwd, name }),
  },

  // Claude
  claude: {
    start: (data: {
      projectId: string
      projectPath: string
      terminalId: string
      prompt?: string
      loopMode?: boolean
      loopDelay?: number
    }) => ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_START, data),
    stop: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_STOP, { id: sessionId }),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_STATUS),
    onSessionEnd: (callback: (data: { id: string; status: string }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; status: string },
      ) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_SESSION_END, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_SESSION_END, listener)
    },
    onActivity: (callback: (data: { path: string; status: string; timestamp: number }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { path: string; status: string; timestamp: number },
      ) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_ACTIVITY, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_ACTIVITY, listener)
    },
    installHooks: (projectPath: string, workspaceName?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_INSTALL_HOOKS, { projectPath, workspaceName }),
    checkHooks: (projectPath: string, workspaceName?: string): Promise<{ installed: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CHECK_HOOKS, { projectPath, workspaceName }),
    validateSettings: (projectPath: string, workspaceName?: string): Promise<{ valid: boolean; errors: string[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_VALIDATE_SETTINGS, { projectPath, workspaceName }),
    fixSettings: (projectPath: string, workspaceName?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_FIX_SETTINGS, { projectPath, workspaceName }),
  },

  // Kanban
  kanban: {
    list: (workspaceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_LIST, { workspaceId }),
    create: (task: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt'> & { workspaceId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_CREATE, task),
    update: (task: Partial<KanbanTask> & { id: string; workspaceId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_UPDATE, task),
    delete: (id: string, workspaceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_DELETE, { id, workspaceId }),
    writePrompt: (projectPath: string, taskId: string, prompt: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_WRITE_PROMPT, { projectPath, taskId, prompt }),
    cleanupPrompt: (projectPath: string, taskId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_CLEANUP_PROMPT, { projectPath, taskId }),
    getPath: (workspaceId: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_GET_PATH, { workspaceId }),
    selectFiles: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_SELECT_FILES),
    attachFile: (taskId: string, workspaceId: string, filePath: string): Promise<KanbanAttachment> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_ATTACH_FILE, { taskId, workspaceId, filePath }),
    attachFromClipboard: (taskId: string, workspaceId: string, dataBase64: string, filename: string, mimeType: string): Promise<KanbanAttachment> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_ATTACH_FROM_CLIPBOARD, { taskId, workspaceId, dataBase64, filename, mimeType }),
    removeAttachment: (taskId: string, workspaceId: string, attachmentId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_REMOVE_ATTACHMENT, { taskId, workspaceId, attachmentId }),
  },

  // Workspace storage
  workspaceDir: {
    init: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_INIT_DIR, { projectPath }),
  },

  // Workspace env (virtual env with symlinks)
  workspaceEnv: {
    setup: (workspaceName: string, projectPaths: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENV_SETUP, { workspaceName, projectPaths }),
    getPath: (workspaceName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENV_PATH, { workspaceName }),
    delete: (workspaceName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENV_DELETE, { workspaceName }),
  },

  // Updates
  updates: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    install: (tool: string, scope: string, projectId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL, { tool, scope, projectId }),
    uninstall: (tool: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_UNINSTALL, { tool }),
    onStatus: (callback: (data: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS, listener)
    },
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SETTINGS_GET),
    set: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SETTINGS_SET, settings),
  },

  // Session
  session: {
    save: (session: SessionData) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE, session),
    load: (): Promise<SessionData | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD),
    clear: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLEAR),
  },

  // Prompt templates
  prompts: {
    list: (): Promise<PromptTemplate[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_LIST),
    create: (data: Omit<PromptTemplate, 'id' | 'createdAt'>): Promise<PromptTemplate> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_CREATE, data),
    update: (data: Partial<PromptTemplate> & { id: string }): Promise<PromptTemplate | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_UPDATE, data),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMPTS_DELETE, { id }),
  },

  // Claude agents & skills
  claudeAgents: {
    list: (projectPath: string): Promise<Array<{ name: string; filename: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_LIST_AGENTS, { projectPath }),
    read: (projectPath: string, filename: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_READ_AGENT, { projectPath, filename }),
    write: (projectPath: string, filename: string, content: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_WRITE_AGENT, { projectPath, filename, content }),
    delete: (projectPath: string, filename: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DELETE_AGENT, { projectPath, filename }),
  },

  claudeSkills: {
    list: (projectPath: string): Promise<Array<{ name: string; filename: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_LIST_SKILLS, { projectPath }),
    read: (projectPath: string, filename: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_READ_SKILL, { projectPath, filename }),
    write: (projectPath: string, filename: string, content: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_WRITE_SKILL, { projectPath, filename, content }),
    delete: (projectPath: string, filename: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DELETE_SKILL, { projectPath, filename }),
  },

  // MCP servers
  mcp: {
    getHelp: (name: string, config: McpServerConfig): Promise<McpHelpResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_HELP, { name, config }),
  },

  // Claude defaults library
  claudeDefaults: {
    profiles: (): Promise<Array<{ id: string; name: string; description: string; category: string; content: string; filename: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DEFAULTS_PROFILES),
    skills: (): Promise<Array<{ id: string; name: string; description: string; category: string; content: string; filename: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DEFAULTS_SKILLS),
    deployProfile: (projectPath: string, profileId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DEPLOY_PROFILE, { projectPath, profileId }),
    deploySkill: (projectPath: string, skillId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_DEPLOY_SKILL, { projectPath, skillId }),
    checkDeployed: (projectPath: string): Promise<{ deployedProfiles: string[]; deployedSkills: string[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CHECK_DEPLOYED, { projectPath }),
  },

  // API Tester
  api: {
    execute: (
      request: { method: HttpMethod; url: string; headers: ApiHeader[]; body: string; bodyType: string; tests: ApiTestAssertion[] },
      variables: Record<string, string>,
    ): Promise<{ response: ApiResponse; testResults: ApiTestResult[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.API_EXECUTE, { ...request, variables }),
    load: (projectPath: string): Promise<ApiTestFile> =>
      ipcRenderer.invoke(IPC_CHANNELS.API_LOAD, { projectPath }),
    save: (projectPath: string, data: ApiTestFile): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.API_SAVE, { projectPath, data }),
    export: (data: ApiTestFile): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.API_EXPORT, { data }),
    import: (): Promise<{ success: boolean; data: ApiTestFile | null; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.API_IMPORT),
  },

  // Database Explorer
  database: {
    connect: async (connectionId: string, config: DbConnectionConfig): Promise<void> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_CONNECT, { connectionId, config })
      if (!r.success) throw new Error(r.error || 'Connection failed')
    },
    disconnect: async (connectionId: string): Promise<void> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_DISCONNECT, { connectionId })
      if (!r.success) throw new Error(r.error || 'Disconnect failed')
    },
    testConnection: (config: DbConnectionConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_TEST_CONNECTION, { config }),
    listDatabases: async (connectionId: string): Promise<string[]> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_DATABASES, { connectionId })
      if (!r.success) throw new Error(r.error || 'Failed to list databases')
      return r.databases
    },
    listSchemas: async (connectionId: string): Promise<string[]> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_SCHEMAS, { connectionId })
      if (!r.success) throw new Error(r.error || 'Failed to list schemas')
      return r.schemas
    },
    listTables: async (connectionId: string, schema?: string): Promise<DbTable[]> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_TABLES, { connectionId, schema })
      if (!r.success) throw new Error(r.error || 'Failed to list tables')
      return r.tables
    },
    tableInfo: async (connectionId: string, table: string, schema?: string): Promise<DbTableInfo> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_TABLE_INFO, { connectionId, table, schema })
      if (!r.success) throw new Error(r.error || 'Failed to get table info')
      return r.info
    },
    executeQuery: async (connectionId: string, sql: string, limit?: number, offset?: number): Promise<DbQueryResult> => {
      const r = await ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE_QUERY, { connectionId, sql, limit, offset })
      return r.result
    },
    cancelQuery: (connectionId: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_CANCEL_QUERY, { connectionId }),
    load: (workspaceId: string): Promise<DbFile> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_LOAD, { workspaceId }),
    save: (workspaceId: string, data: DbFile): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_SAVE, { workspaceId, data }),
    export: (data: DbFile): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_EXPORT, { data }),
    import: (): Promise<{ success: boolean; data: DbFile | null; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_IMPORT),
    backup: (connectionId: string, connectionName: string, config: DbConnectionConfig, options?: { dataOnly?: boolean; schemaOnly?: boolean; tables?: string[] }, environmentTag?: DbEnvironmentTag): Promise<DbBackupResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_BACKUP, { connectionId, connectionName, config, options, environmentTag }),
    onBackupLog: (callback: (entry: DbBackupLogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: DbBackupLogEntry) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.DB_BACKUP_LOG, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.DB_BACKUP_LOG, listener)
    },
    backupList: (connectionId: string): Promise<{ success: boolean; entries: DbBackupEntry[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_BACKUP_LIST, { connectionId }),
    backupDelete: (connectionId: string, backupId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_BACKUP_DELETE, { connectionId, backupId }),
    restore: (entry: DbBackupEntry, targetConfig: DbConnectionConfig): Promise<DbRestoreResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_RESTORE, { entry, targetConfig }),
    transfer: (sourceId: string, targetId: string, tables: string[]): Promise<{ success: boolean; errors: string[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_TRANSFER, { sourceId, targetId, tables }),
  },

  // App info
  app: {
    version: (): Promise<{ version: string; name: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION),
  },

  // App Update (electron-updater)
  appUpdate: {
    check: (): Promise<{ success: boolean; version?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_CHECK),
    download: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_DOWNLOAD),
    install: () =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_INSTALL),
    onStatus: (callback: (data: { status: string; version?: string; releaseNotes?: string; percent?: number; message?: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { status: string; version?: string; releaseNotes?: string; percent?: number; message?: string }) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.APP_UPDATE_STATUS, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_UPDATE_STATUS, listener)
    },
  },

  // Notifications
  notify: (title: string, body: string) =>
    ipcRenderer.send(IPC_CHANNELS.APP_NOTIFICATION, { title, body }),
}

contextBridge.exposeInMainWorld('mirehub', api)

export type MirehubAPI = typeof api
