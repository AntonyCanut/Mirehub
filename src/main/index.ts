import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import path from 'path'
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
import { cleanupTerminals } from './ipc/terminal'

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
})

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})
