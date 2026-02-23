import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'path'
import { execSync } from 'child_process'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerWorkspaceHandlers } from './ipc/workspace'
import { registerProjectHandlers } from './ipc/project'
import { registerAppHandlers } from './ipc/app'
import { registerClaudeHandlers, cleanupClaudeSessions } from './ipc/claude'
import { registerKanbanHandlers } from './ipc/kanban'
import { registerUpdateHandlers } from './ipc/updates'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerGitHandlers } from './ipc/git'
import { registerSessionHandlers } from './ipc/session'
import { registerWorkspaceEnvHandlers } from './ipc/workspaceEnv'
import { registerClaudeDefaultsHandlers } from './ipc/claudeDefaults'
import { registerApiHandlers } from './ipc/api'
import { registerDatabaseHandlers } from './ipc/database'
import { registerAppUpdateHandlers } from './ipc/appUpdate'
import { cleanupTerminals } from './ipc/terminal'
import { ensureActivityHookScript, startActivityWatcher } from './services/activityHooks'
import { databaseService } from './services/database'

// Fix PATH for packaged .app on macOS — Electron .app bundles inherit a
// minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) which prevents finding
// user-installed tools (node, npm, claude, brew, cargo, etc.).
// Resolve the real PATH by asking the user's login shell.
if (process.platform === 'darwin') {
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const shellPath = execSync(`${shell} -ilc 'printf "%s" "$PATH"'`, {
      encoding: 'utf-8',
      timeout: 5000,
    })
    if (shellPath) {
      process.env.PATH = shellPath
    }
  } catch {
    // Fallback: extend with common macOS binary locations
    const extra = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      `${process.env.HOME}/.cargo/bin`,
      `${process.env.HOME}/.nvm/versions/node`,
    ].join(':')
    process.env.PATH = `${extra}:${process.env.PATH ?? ''}`
  }
}

// Set the app name for macOS menu bar (overrides default "Electron" in dev mode)
app.name = 'Mirehub'

// vite-plugin-electron sets VITE_DEV_SERVER_URL in dev mode
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for node-pty via preload
      webSecurity: true,
    },
    show: false,
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // DevTools on Cmd+Alt+I only, not auto-open (avoids console spam)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

app.whenReady().then(() => {
  mainWindow = createMainWindow()

  // Register IPC handlers
  registerTerminalHandlers(ipcMain)
  registerWorkspaceHandlers(ipcMain)
  registerProjectHandlers(ipcMain)
  registerAppHandlers(ipcMain)
  registerClaudeHandlers(ipcMain)
  registerKanbanHandlers(ipcMain)
  registerUpdateHandlers(ipcMain)
  registerFilesystemHandlers(ipcMain)
  registerGitHandlers(ipcMain)
  registerSessionHandlers(ipcMain)
  registerWorkspaceEnvHandlers(ipcMain)
  registerClaudeDefaultsHandlers(ipcMain)
  registerApiHandlers(ipcMain)
  registerDatabaseHandlers(ipcMain)
  registerAppUpdateHandlers(ipcMain)

  // Ensure activity hook script exists and start watching
  ensureActivityHookScript()
  startActivityWatcher()

  // DevTools shortcut: Cmd+Alt+I
  globalShortcut.register('CommandOrControl+Alt+I', () => {
    mainWindow?.webContents.toggleDevTools()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanupTerminals()
  cleanupClaudeSessions()
  databaseService.disconnectAll()
})

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})
