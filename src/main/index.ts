import { app, BrowserWindow, ipcMain, globalShortcut, Menu, shell } from 'electron'
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
import { registerMcpHandlers } from './ipc/mcp'
import { registerSshHandlers } from './ipc/ssh'
import { registerAnalysisHandlers } from './ipc/analysis'
import { registerPackagesHandlers } from './ipc/packages'
import { registerNamespaceHandlers } from './ipc/namespace'
import { registerGitConfigHandlers } from './ipc/gitConfig'
import { registerClaudeMemoryHandlers } from './ipc/claudeMemory'
import { cleanupTerminals } from './ipc/terminal'
import { ensureActivityHookScript, ensureAutoApproveScript, ensureKanbanDoneScript, syncAllWorkspaceEnvHooks, startActivityWatcher } from './services/activityHooks'
import { clearDockBadge } from './services/notificationService'
import { databaseService } from './services/database'
import { StorageService } from './services/storage'
import { IPC_CHANNELS } from '../shared/types'

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

  win.on('focus', () => {
    clearDockBadge()
  })

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send(IPC_CHANNELS.MENU_ACTION, action)
}

function buildApplicationMenu(): void {
  const storage = new StorageService()
  const locale = storage.getSettings().locale || 'fr'
  const isFr = locale === 'fr'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu
    {
      label: 'Mirehub',
      submenu: [
        { role: 'about', label: isFr ? 'A propos de Mirehub' : 'About Mirehub' },
        { type: 'separator' },
        {
          label: isFr ? 'Preferences...' : 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenuAction('view:settings'),
        },
        { type: 'separator' },
        { role: 'hide', label: isFr ? 'Masquer Mirehub' : 'Hide Mirehub' },
        { role: 'hideOthers', label: isFr ? 'Masquer les autres' : 'Hide Others' },
        { role: 'unhide', label: isFr ? 'Tout afficher' : 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: isFr ? 'Quitter Mirehub' : 'Quit Mirehub' },
      ],
    },
    // File menu
    {
      label: isFr ? 'Fichier' : 'File',
      submenu: [
        {
          label: isFr ? 'Nouveau workspace' : 'New Workspace',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('workspace:new'),
        },
        {
          label: isFr ? 'Workspace depuis un dossier...' : 'Workspace from Folder...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendMenuAction('workspace:newFromFolder'),
        },
        { type: 'separator' },
        {
          label: isFr ? 'Importer un workspace...' : 'Import Workspace...',
          click: () => sendMenuAction('workspace:import'),
        },
        {
          label: isFr ? 'Exporter le workspace...' : 'Export Workspace...',
          click: () => sendMenuAction('workspace:export'),
        },
        { type: 'separator' },
        { role: 'close', label: isFr ? 'Fermer la fenetre' : 'Close Window' },
      ],
    },
    // Edit menu
    {
      label: isFr ? 'Edition' : 'Edit',
      submenu: [
        { role: 'undo', label: isFr ? 'Annuler' : 'Undo' },
        { role: 'redo', label: isFr ? 'Retablir' : 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: isFr ? 'Couper' : 'Cut' },
        { role: 'copy', label: isFr ? 'Copier' : 'Copy' },
        { role: 'paste', label: isFr ? 'Coller' : 'Paste' },
        { role: 'selectAll', label: isFr ? 'Tout selectionner' : 'Select All' },
      ],
    },
    // View menu
    {
      label: isFr ? 'Affichage' : 'View',
      submenu: [
        {
          label: 'Terminal',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenuAction('view:terminal'),
        },
        {
          label: 'Git',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenuAction('view:git'),
        },
        {
          label: 'Kanban',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendMenuAction('view:kanban'),
        },
        {
          label: 'Claude',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendMenuAction('view:claude'),
        },
        {
          label: isFr ? 'Base de donnees' : 'Database',
          accelerator: 'CmdOrCtrl+5',
          click: () => sendMenuAction('view:database'),
        },
        { type: 'separator' },
        {
          label: isFr ? 'Palette de commandes' : 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendMenuAction('commandPalette'),
        },
        {
          label: isFr ? 'Changement rapide' : 'Quick Switch',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('quickSwitch'),
        },
        {
          label: isFr ? 'Recherche globale' : 'Global Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => sendMenuAction('view:search'),
        },
        { type: 'separator' },
        {
          label: isFr ? 'Outils de developpement' : 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { role: 'reload', label: isFr ? 'Recharger' : 'Reload' },
        { role: 'forceReload', label: isFr ? 'Forcer le rechargement' : 'Force Reload' },
        { type: 'separator' },
        { role: 'resetZoom', label: isFr ? 'Taille reelle' : 'Actual Size' },
        { role: 'zoomIn', label: isFr ? 'Zoom avant' : 'Zoom In' },
        { role: 'zoomOut', label: isFr ? 'Zoom arriere' : 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: isFr ? 'Plein ecran' : 'Toggle Full Screen' },
      ],
    },
    // Window menu
    {
      label: isFr ? 'Fenetre' : 'Window',
      role: 'window',
      submenu: [
        { role: 'minimize', label: isFr ? 'Reduire' : 'Minimize' },
        { role: 'zoom', label: 'Zoom' },
        { type: 'separator' },
        { role: 'front', label: isFr ? 'Tout ramener au premier plan' : 'Bring All to Front' },
      ],
    },
    // Help menu
    {
      label: isFr ? 'Aide' : 'Help',
      role: 'help',
      submenu: [
        {
          label: isFr ? 'Raccourcis clavier' : 'Keyboard Shortcuts',
          click: () => sendMenuAction('view:shortcuts'),
        },
        { type: 'separator' },
        {
          label: isFr ? 'Site web Mirehub' : 'Mirehub Website',
          click: () => shell.openExternal('https://github.com/AntonyCanut/Mirehub'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  mainWindow = createMainWindow()

  // Build macOS application menu
  buildApplicationMenu()

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
  registerMcpHandlers(ipcMain)
  registerSshHandlers(ipcMain)
  registerNamespaceHandlers(ipcMain)
  registerGitConfigHandlers(ipcMain)
  registerAnalysisHandlers(ipcMain, () => mainWindow)
  registerPackagesHandlers(ipcMain)
  registerClaudeMemoryHandlers(ipcMain)

  // Ensure a Default namespace exists (first launch or migration)
  new StorageService().ensureDefaultNamespace()

  // Ensure all hook scripts exist and sync hooks across all workspace envs
  ensureActivityHookScript()
  ensureAutoApproveScript()
  ensureKanbanDoneScript()
  syncAllWorkspaceEnvHooks()
  startActivityWatcher()

  // DevTools shortcut: Cmd+Alt+I
  globalShortcut.register('CommandOrControl+Alt+I', () => {
    mainWindow?.webContents.toggleDevTools()
  })

  app.on('activate', () => {
    clearDockBadge()
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
