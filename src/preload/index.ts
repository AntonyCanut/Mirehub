import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, AppSettings, Workspace, KanbanTask, FileEntry, SessionData, NpmPackageInfo } from '../shared/types'

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
  },

  // Claude
  claude: {
    start: (data: { projectId: string; prompt?: string; loopMode?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_START, data),
    stop: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_STOP, { id: sessionId }),
    onSessionEnd: (callback: (data: { id: string; status: string }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; status: string },
      ) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_SESSION_END, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_SESSION_END, listener)
    },
  },

  // Kanban
  kanban: {
    list: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_LIST, { projectPath }),
    create: (task: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt'> & { projectPath: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_CREATE, task),
    update: (task: Partial<KanbanTask> & { id: string; projectPath: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_UPDATE, task),
    delete: (id: string, projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN_DELETE, { id, projectPath }),
  },

  // Workspace storage
  workspaceDir: {
    init: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_INIT_DIR, { projectPath }),
  },

  // Workspace env (virtual env with symlinks)
  workspaceEnv: {
    setup: (workspaceId: string, projectPaths: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENV_SETUP, { workspaceId, projectPaths }),
    getPath: (workspaceId: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ENV_PATH, { workspaceId }),
  },

  // Updates
  updates: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    install: (tool: string, scope: string, projectId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL, { tool, scope, projectId }),
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

  // Notifications
  notify: (title: string, body: string) =>
    ipcRenderer.send(IPC_CHANNELS.APP_NOTIFICATION, { title, body }),
}

contextBridge.exposeInMainWorld('theone', api)

export type TheOneAPI = typeof api
