# theOne - Architecture Globale

## 1. Vue d'ensemble

**theOne** est un terminal macOS enrichi par l'IA, construit avec Electron. Il combine un émulateur de terminal complet (xterm.js + node-pty), une gestion de workspaces/projets, l'intégration native de Claude Code, et un tableau Kanban avec assignation d'agents IA.

### Principes directeurs

- **Séparation stricte** Main Process / Renderer via IPC sécurisé
- **Context Isolation** obligatoire, nodeIntegration désactivé
- **Feature-based architecture** dans le renderer (chaque fonctionnalité est un module autonome)
- **État centralisé** avec Zustand (léger, TypeScript-first, pas de boilerplate Redux)
- **Persistance locale** via SQLite (better-sqlite3) pour les données structurées

---

## 2. Architecture des composants

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐         │
│  │ App      │  │ Window   │  │ IPC           │         │
│  │ Lifecycle│  │ Manager  │  │ Router        │         │
│  └──────────┘  └──────────┘  └───────┬───────┘         │
│                                       │                  │
│  ┌──────────┐  ┌──────────┐  ┌───────┴───────┐         │
│  │ PTY      │  │ Claude   │  │ Workspace     │         │
│  │ Service  │  │ Session  │  │ Service       │         │
│  │ (node-pty)│ │ Manager  │  │               │         │
│  └──────────┘  └──────────┘  └───────────────┘         │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐         │
│  │ Update   │  │ Kanban   │  │ AutoClauder   │         │
│  │ Checker  │  │ Service  │  │ Service       │         │
│  └──────────┘  └──────────┘  └───────────────┘         │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │ Database Service (better-sqlite3)         │           │
│  └──────────────────────────────────────────┘           │
│                                                          │
├──────────────── contextBridge / preload ─────────────────┤
│                                                          │
│                   RENDERER PROCESS                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React App (Zustand state management)             │   │
│  │                                                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │ Terminal   │ │ Workspace  │ │ Kanban       │  │   │
│  │  │ Feature    │ │ Feature    │ │ Feature      │  │   │
│  │  │ - Tabs     │ │ - Sidebar  │ │ - Board      │  │   │
│  │  │ - Splits   │ │ - Projects │ │ - Cards      │  │   │
│  │  │ - xterm.js │ │ - Claude   │ │ - Columns    │  │   │
│  │  └────────────┘ │   detect   │ └──────────────┘  │   │
│  │                  └────────────┘                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │ Claude     │ │ Update     │ │ Settings     │  │   │
│  │  │ Sessions   │ │ Center     │ │ Feature      │  │   │
│  │  │ Feature    │ │ Feature    │ │              │  │   │
│  │  └────────────┘ └────────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Main Process - Responsabilites

| Service | Responsabilite |
|---------|---------------|
| **AppLifecycle** | Gestion du cycle de vie Electron (ready, activate, quit, window-all-closed) |
| **WindowManager** | Creation/gestion de la fenetre principale, gestion des BrowserWindow |
| **IpcRouter** | Routage centralise des messages IPC, validation des inputs |
| **PtyService** | Creation et gestion des pseudo-terminaux via node-pty |
| **ClaudeSessionManager** | Lancement/arret/monitoring des processus Claude Code (child_process) |
| **WorkspaceService** | Scan du filesystem, detection .claude, gestion des projets |
| **UpdateChecker** | Verification des mises a jour (Node, npm, Claude Code, app) |
| **KanbanService** | CRUD des taches Kanban, persistance SQLite |
| **AutoClauderService** | Detection projets sans .claude, application automatique de preferences |
| **DatabaseService** | Couche d'acces SQLite (better-sqlite3), migrations |

### 2.2 Renderer Process - Features

| Feature | Description |
|---------|-------------|
| **terminal** | Onglets, splits (jusqu'a 4), xterm.js, liaison avec PTY backend |
| **workspace** | Sidebar de navigation, liste projets, indicateurs .claude |
| **kanban** | Tableau Kanban drag-and-drop par projet (TODO/WORKING/PENDING/DONE/FAILED) |
| **claude-sessions** | Interface de gestion des sessions Claude Code, up to 4 agents/projet |
| **update-center** | Centre de notifications de mises a jour |
| **settings** | Preferences utilisateur, configuration Auto-Clauder |

---

## 3. Design des canaux IPC

### 3.1 Convention de nommage

Format: `{domain}:{action}` avec reponse `{domain}:{action}:result`

### 3.2 Canaux par domaine

#### Terminal (PTY)

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `pty:create` | Renderer → Main | `{ shell?: string, cwd: string, cols: number, rows: number }` | Cree un nouveau PTY |
| `pty:create:result` | Main → Renderer | `{ id: string }` | Retourne l'ID du PTY cree |
| `pty:write` | Renderer → Main | `{ id: string, data: string }` | Ecrit dans le PTY |
| `pty:resize` | Renderer → Main | `{ id: string, cols: number, rows: number }` | Redimensionne le PTY |
| `pty:close` | Renderer → Main | `{ id: string }` | Ferme le PTY |
| `pty:data` | Main → Renderer | `{ id: string, data: string }` | Donnees de sortie du PTY (stream) |
| `pty:exit` | Main → Renderer | `{ id: string, code: number }` | Le PTY s'est termine |

#### Workspace

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `workspace:list` | Renderer → Main | `void` | Liste tous les workspaces |
| `workspace:list:result` | Main → Renderer | `Workspace[]` | Retour liste |
| `workspace:create` | Renderer → Main | `{ name: string, paths: string[] }` | Cree un workspace |
| `workspace:update` | Renderer → Main | `{ id: string, ...partial }` | Met a jour un workspace |
| `workspace:delete` | Renderer → Main | `{ id: string }` | Supprime un workspace |
| `workspace:scan-projects` | Renderer → Main | `{ workspaceId: string }` | Scanne les projets du workspace |
| `workspace:scan-projects:result` | Main → Renderer | `Project[]` | Liste des projets trouves |
| `workspace:project-changed` | Main → Renderer | `{ workspaceId: string, project: Project }` | Notification de changement |

#### Claude Sessions

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `claude:launch` | Renderer → Main | `{ projectId: string, prompt?: string }` | Lance une session Claude |
| `claude:launch:result` | Main → Renderer | `{ sessionId: string }` | Retour ID session |
| `claude:stop` | Renderer → Main | `{ sessionId: string }` | Arrete une session |
| `claude:output` | Main → Renderer | `{ sessionId: string, data: string }` | Sortie de Claude (stream) |
| `claude:status` | Main → Renderer | `{ sessionId: string, status: ClaudeSessionStatus }` | Changement de statut |
| `claude:list` | Renderer → Main | `{ projectId: string }` | Liste sessions d'un projet |
| `claude:relaunch` | Renderer → Main | `{ sessionId: string, prompt: string }` | Relance en mode loop |

#### Kanban

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `kanban:list` | Renderer → Main | `{ projectId: string }` | Liste taches d'un projet |
| `kanban:list:result` | Main → Renderer | `KanbanTask[]` | Retour liste |
| `kanban:create` | Renderer → Main | `CreateKanbanTaskPayload` | Cree une tache |
| `kanban:update` | Renderer → Main | `{ id: string, ...partial }` | Met a jour une tache |
| `kanban:delete` | Renderer → Main | `{ id: string }` | Supprime une tache |
| `kanban:assign-agent` | Renderer → Main | `{ taskId: string, sessionId: string }` | Assigne un agent a une tache |
| `kanban:changed` | Main → Renderer | `{ projectId: string }` | Notification de changement |

#### Updates

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `updates:check` | Renderer → Main | `void` | Lance une verification |
| `updates:check:result` | Main → Renderer | `UpdateInfo[]` | Resultats |
| `updates:available` | Main → Renderer | `UpdateInfo` | Notification push |

#### Auto-Clauder

| Canal | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `autoclauder:status` | Renderer → Main | `{ projectId: string }` | Statut Auto-Clauder pour un projet |
| `autoclauder:apply` | Renderer → Main | `{ projectId: string }` | Applique les preferences Claude |
| `autoclauder:configure` | Renderer → Main | `AutoClauderConfig` | Configure les preferences par defaut |

---

## 4. Interfaces TypeScript (shared/)

```typescript
// ===== src/shared/types/workspace.ts =====

export interface Workspace {
  id: string;
  name: string;
  paths: string[];          // Root directories included in this workspace
  createdAt: number;        // Unix timestamp
  updatedAt: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  path: string;             // Absolute path to project root
  hasClaudeConfig: boolean; // Whether .claude folder exists
  claudeConfigPath?: string;
  lastOpenedAt?: number;
}

// ===== src/shared/types/terminal.ts =====

export interface TerminalTab {
  id: string;
  label: string;
  panes: TerminalPane[];    // 1 to 4 panes
  activePane: string;       // ID of the active pane
}

export interface TerminalPane {
  id: string;
  ptyId: string;            // Links to the backend PTY process
  cwd: string;
  splitDirection?: 'horizontal' | 'vertical';
  size: number;             // Percentage of parent container (0-100)
}

export type SplitLayout = {
  type: 'single';
  paneId: string;
} | {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: SplitLayout[];
  sizes: number[];          // Percentages for each child
};

export interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string;
  layouts: Record<string, SplitLayout>; // tabId -> layout
}

// ===== src/shared/types/claude-session.ts =====

export type ClaudeSessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'error'
  | 'stopped';

export interface ClaudeSession {
  id: string;
  projectId: string;
  ptyId: string;            // Each Claude session runs in a PTY
  status: ClaudeSessionStatus;
  prompt?: string;          // Custom prompt for this session
  loopMode: boolean;        // Whether to auto-relaunch
  startedAt: number;
  lastActivityAt: number;
}

export interface ClaudeSessionConfig {
  maxAgentsPerProject: 4;   // Hard limit
  defaultPrompt?: string;
  autoSplitTerminal: boolean;
}

// ===== src/shared/types/kanban.ts =====

export type KanbanColumn = 'TODO' | 'WORKING' | 'PENDING' | 'DONE' | 'FAILED';

export interface KanbanTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: KanbanColumn;
  assignedAgentId?: string; // Claude session ID if assigned
  priority: number;         // For ordering within column
  createdAt: number;
  updatedAt: number;
}

export interface CreateKanbanTaskPayload {
  projectId: string;
  title: string;
  description: string;
  column?: KanbanColumn;    // Defaults to 'TODO'
}

// ===== src/shared/types/updates.ts =====

export type UpdateTarget = 'node' | 'npm' | 'claude-code' | 'app' | string;

export interface UpdateInfo {
  target: UpdateTarget;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl?: string;
  checkedAt: number;
}

// ===== src/shared/types/autoclauder.ts =====

export interface AutoClauderConfig {
  enabled: boolean;
  defaultClaudeMd: string;          // Content template for CLAUDE.md
  defaultSettings: Record<string, unknown>; // Default .claude/settings.json
  applyOnProjectOpen: boolean;      // Auto-apply when opening project
}

// ===== src/shared/types/ipc.ts =====

/** Type-safe IPC channel map for invoke/handle pattern */
export interface IpcChannelMap {
  'pty:create': {
    params: { shell?: string; cwd: string; cols: number; rows: number };
    result: { id: string };
  };
  'pty:write': {
    params: { id: string; data: string };
    result: void;
  };
  'pty:resize': {
    params: { id: string; cols: number; rows: number };
    result: void;
  };
  'pty:close': {
    params: { id: string };
    result: void;
  };
  'workspace:list': {
    params: void;
    result: Workspace[];
  };
  'workspace:create': {
    params: { name: string; paths: string[] };
    result: Workspace;
  };
  'workspace:update': {
    params: Partial<Workspace> & { id: string };
    result: Workspace;
  };
  'workspace:delete': {
    params: { id: string };
    result: void;
  };
  'workspace:scan-projects': {
    params: { workspaceId: string };
    result: Project[];
  };
  'claude:launch': {
    params: { projectId: string; prompt?: string };
    result: { sessionId: string };
  };
  'claude:stop': {
    params: { sessionId: string };
    result: void;
  };
  'claude:list': {
    params: { projectId: string };
    result: ClaudeSession[];
  };
  'claude:relaunch': {
    params: { sessionId: string; prompt: string };
    result: void;
  };
  'kanban:list': {
    params: { projectId: string };
    result: KanbanTask[];
  };
  'kanban:create': {
    params: CreateKanbanTaskPayload;
    result: KanbanTask;
  };
  'kanban:update': {
    params: Partial<KanbanTask> & { id: string };
    result: KanbanTask;
  };
  'kanban:delete': {
    params: { id: string };
    result: void;
  };
  'kanban:assign-agent': {
    params: { taskId: string; sessionId: string };
    result: KanbanTask;
  };
  'updates:check': {
    params: void;
    result: UpdateInfo[];
  };
  'autoclauder:status': {
    params: { projectId: string };
    result: { applied: boolean; config: AutoClauderConfig };
  };
  'autoclauder:apply': {
    params: { projectId: string };
    result: void;
  };
  'autoclauder:configure': {
    params: AutoClauderConfig;
    result: void;
  };
}

/** Type-safe IPC event channel map for on/send pattern (streaming) */
export interface IpcEventMap {
  'pty:data': { id: string; data: string };
  'pty:exit': { id: string; code: number };
  'claude:output': { sessionId: string; data: string };
  'claude:status': { sessionId: string; status: ClaudeSessionStatus };
  'workspace:project-changed': { workspaceId: string; project: Project };
  'kanban:changed': { projectId: string };
  'updates:available': UpdateInfo;
}
```

---

## 5. Structure de fichiers detaillee

```
theOne/
├── CLAUDE.md                          # Instructions projet (existant)
├── ARCHITECTURE.md                    # Ce document
├── package.json
├── tsconfig.json                      # Config TS racine (references)
├── tsconfig.main.json                 # Config TS main process
├── tsconfig.renderer.json             # Config TS renderer
├── tsconfig.preload.json              # Config TS preload
├── electron-builder.yml               # Config packaging macOS
├── vite.config.ts                     # Vite config pour renderer
├── vite.config.main.ts                # Vite config pour main process
├── vitest.config.ts                   # Config tests
├── .eslintrc.cjs                      # ESLint config
├── .prettierrc                        # Prettier config
│
├── src/
│   ├── main/                          # --- MAIN PROCESS ---
│   │   ├── index.ts                   # Entry point, app lifecycle
│   │   ├── window-manager.ts          # BrowserWindow creation/management
│   │   │
│   │   ├── ipc/                       # IPC handlers
│   │   │   ├── index.ts               # Register all handlers
│   │   │   ├── pty.handler.ts         # PTY IPC handlers
│   │   │   ├── workspace.handler.ts   # Workspace IPC handlers
│   │   │   ├── claude.handler.ts      # Claude session IPC handlers
│   │   │   ├── kanban.handler.ts      # Kanban IPC handlers
│   │   │   ├── updates.handler.ts     # Update checker IPC handlers
│   │   │   └── autoclauder.handler.ts # Auto-Clauder IPC handlers
│   │   │
│   │   ├── services/                  # Business logic services
│   │   │   ├── pty.service.ts         # node-pty management
│   │   │   ├── workspace.service.ts   # Workspace/project scanning
│   │   │   ├── claude-session.service.ts  # Claude Code process management
│   │   │   ├── kanban.service.ts      # Kanban CRUD (uses database)
│   │   │   ├── update-checker.service.ts  # Version checking
│   │   │   ├── autoclauder.service.ts # Auto-Clauder logic
│   │   │   └── database.service.ts    # SQLite access layer
│   │   │
│   │   └── menu.ts                    # macOS native menu
│   │
│   ├── preload/                       # --- PRELOAD SCRIPTS ---
│   │   ├── index.ts                   # Main preload: exposes API via contextBridge
│   │   └── api.ts                     # API definition (typed)
│   │
│   ├── renderer/                      # --- RENDERER PROCESS (React) ---
│   │   ├── index.html                 # HTML entry point
│   │   ├── main.tsx                   # React entry point
│   │   ├── App.tsx                    # Root component, layout
│   │   │
│   │   ├── components/                # Reusable UI components
│   │   │   ├── ui/                    # Base components (Button, Input, etc.)
│   │   │   ├── layout/               # Layout components (Sidebar, Titlebar, etc.)
│   │   │   └── common/               # Shared components (StatusBadge, etc.)
│   │   │
│   │   ├── features/                  # Feature modules
│   │   │   ├── terminal/
│   │   │   │   ├── components/
│   │   │   │   │   ├── TerminalTabs.tsx        # Tab bar
│   │   │   │   │   ├── TerminalPane.tsx        # Single terminal pane (xterm.js)
│   │   │   │   │   ├── TerminalSplitView.tsx   # Split layout container
│   │   │   │   │   └── TerminalToolbar.tsx     # Per-pane toolbar
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useTerminal.ts          # xterm.js lifecycle
│   │   │   │   │   └── usePty.ts              # PTY IPC bridge
│   │   │   │   └── store.ts                    # Terminal Zustand slice
│   │   │   │
│   │   │   ├── workspace/
│   │   │   │   ├── components/
│   │   │   │   │   ├── WorkspaceSidebar.tsx    # Sidebar with workspace list
│   │   │   │   │   ├── ProjectList.tsx         # Project list within workspace
│   │   │   │   │   ├── ProjectItem.tsx         # Single project with .claude indicator
│   │   │   │   │   └── WorkspaceSelector.tsx   # Workspace switcher
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useWorkspace.ts
│   │   │   │   └── store.ts
│   │   │   │
│   │   │   ├── claude-sessions/
│   │   │   │   ├── components/
│   │   │   │   │   ├── SessionPanel.tsx        # Panel showing active sessions
│   │   │   │   │   ├── SessionCard.tsx         # Single session status
│   │   │   │   │   └── LaunchDialog.tsx        # Dialog to launch new session
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useClaudeSession.ts
│   │   │   │   └── store.ts
│   │   │   │
│   │   │   ├── kanban/
│   │   │   │   ├── components/
│   │   │   │   │   ├── KanbanBoard.tsx         # Full board view
│   │   │   │   │   ├── KanbanColumn.tsx        # Single column (TODO, etc.)
│   │   │   │   │   ├── KanbanCard.tsx          # Task card
│   │   │   │   │   └── TaskDialog.tsx          # Create/edit task dialog
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useKanban.ts
│   │   │   │   └── store.ts
│   │   │   │
│   │   │   ├── update-center/
│   │   │   │   ├── components/
│   │   │   │   │   ├── UpdateNotification.tsx  # Badge/popup for updates
│   │   │   │   │   └── UpdatePanel.tsx         # Detailed update list
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useUpdates.ts
│   │   │   │   └── store.ts
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── components/
│   │   │       │   ├── SettingsPanel.tsx
│   │   │       │   └── AutoClauderSettings.tsx
│   │   │       └── store.ts
│   │   │
│   │   ├── hooks/                     # Global hooks
│   │   │   ├── useIpc.ts             # Type-safe IPC invoke wrapper
│   │   │   └── useIpcEvent.ts        # Type-safe IPC event listener
│   │   │
│   │   ├── lib/                       # Utilities
│   │   │   ├── ipc-client.ts         # IPC client (uses preload API)
│   │   │   └── utils.ts
│   │   │
│   │   └── styles/                    # Global styles
│   │       ├── global.css
│   │       └── variables.css          # CSS custom properties
│   │
│   └── shared/                        # --- SHARED (both processes) ---
│       ├── types/                     # TypeScript interfaces
│       │   ├── workspace.ts
│       │   ├── terminal.ts
│       │   ├── claude-session.ts
│       │   ├── kanban.ts
│       │   ├── updates.ts
│       │   ├── autoclauder.ts
│       │   └── ipc.ts                # IPC channel type map
│       ├── constants.ts              # Shared constants (IPC channel names, limits)
│       └── validators.ts            # Zod schemas for IPC payload validation
│
├── tests/
│   ├── unit/
│   │   ├── main/                     # Main process unit tests
│   │   │   ├── pty.service.test.ts
│   │   │   ├── workspace.service.test.ts
│   │   │   ├── claude-session.service.test.ts
│   │   │   ├── kanban.service.test.ts
│   │   │   └── autoclauder.service.test.ts
│   │   └── renderer/                 # Renderer unit tests
│   │       ├── terminal/
│   │       ├── workspace/
│   │       ├── kanban/
│   │       └── claude-sessions/
│   │
│   ├── integration/
│   │   ├── ipc/                      # IPC channel integration tests
│   │   │   ├── pty.ipc.test.ts
│   │   │   ├── workspace.ipc.test.ts
│   │   │   └── claude.ipc.test.ts
│   │   ├── database.test.ts          # Database service integration
│   │   └── helpers/
│   │       ├── electron-mock.ts      # Electron test harness
│   │       └── ipc-simulator.ts      # IPC simulation for testing
│   │
│   └── e2e/
│       ├── terminal.e2e.test.ts
│       ├── workspace.e2e.test.ts
│       └── playwright.config.ts
│
└── resources/                         # Static resources
    ├── icons/                         # App icons (icns for macOS)
    └── migrations/                    # SQLite migration files
        ├── 001_init.sql
        └── 002_kanban.sql
```

---

## 6. Choix technologiques

| Technologie | Justification |
|-------------|---------------|
| **Electron 33+** | Framework desktop cross-platform, acces natif macOS, mature pour les terminaux |
| **TypeScript 5.x** | Typage strict, refactoring safe, DX superieure |
| **React 19** | Renderer UI, vaste ecosysteme, hooks pour xterm.js lifecycle |
| **Vite** | Build rapide pour renderer ET main process (via vite-plugin-electron) |
| **Zustand** | State management leger (~1KB), TypeScript-first, pas de boilerplate, slices par feature |
| **xterm.js 5** | Terminal emulator standard dans l'ecosysteme web, addon-fit, addon-webgl |
| **node-pty** | Pseudo-terminal natif, seule option viable pour un vrai shell dans Electron |
| **better-sqlite3** | SQLite synchrone performant, parfait pour main process, pas de serveur |
| **Zod** | Validation des payloads IPC cote main, runtime type safety |
| **@dnd-kit/core** | Drag-and-drop pour Kanban, accessible, React-native |
| **Tailwind CSS 4** | Utility-first, coherent, rapid prototyping, dark mode natif |
| **Vitest** | Tests rapides, compatible Vite, API Jest-compatible |
| **Playwright** | E2E testing, support Electron natif |
| **electron-builder** | Packaging macOS (.dmg, .app), code signing, notarization |

### Dependances alternatives considerees et rejetees

| Rejetee | Raison |
|---------|--------|
| Redux Toolkit | Trop de boilerplate pour ce projet, Zustand suffit |
| Prisma | Overhead pour SQLite embarque, better-sqlite3 + migrations manuelles suffisent |
| electron-forge | Moins mature pour macOS signing que electron-builder |
| Styled Components | Runtime CSS-in-JS, performance inferieure a Tailwind pour ce cas |

---

## 7. Plan de securite Electron

### 7.1 Configuration BrowserWindow

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,          // OBLIGATOIRE: pas de Node dans renderer
    contextIsolation: true,          // OBLIGATOIRE: isolation du contexte
    sandbox: true,                   // Sandbox le renderer process
    preload: path.join(__dirname, '../preload/index.js'),
    webSecurity: true,               // Pas de CORS bypass
    allowRunningInsecureContent: false,
  },
  titleBarStyle: 'hiddenInset',      // Style macOS natif
  vibrancy: 'sidebar',              // Effet vibrancy macOS
  trafficLightPosition: { x: 15, y: 10 },
});
```

### 7.2 Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';   // Requis pour xterm.js + Tailwind
font-src 'self';
connect-src 'self';
img-src 'self' data:;
```

### 7.3 Preload - Surface API minimale

Le preload expose UNIQUEMENT les methodes necessaires via `contextBridge.exposeInMainWorld`. Aucun module Node.js n'est expose directement.

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('theOne', {
  // Invoke pattern (request/response)
  invoke: <K extends keyof IpcChannelMap>(
    channel: K,
    params: IpcChannelMap[K]['params']
  ): Promise<IpcChannelMap[K]['result']> =>
    ipcRenderer.invoke(channel, params),

  // Event pattern (streaming)
  on: <K extends keyof IpcEventMap>(
    channel: K,
    callback: (data: IpcEventMap[K]) => void
  ): () => void => {
    const handler = (_event: IpcRendererEvent, data: IpcEventMap[K]) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
```

### 7.4 Regles de securite

1. **Validation IPC**: Chaque handler main process valide son payload avec Zod
2. **Pas de shell.openExternal** sans validation d'URL (whitelist de domaines)
3. **Pas de remote module** (deprecie et dangereux)
4. **File system**: acces restreint aux paths des workspaces declares
5. **Claude Code**: lance via child_process.spawn avec arguments sanitizes
6. **CSP stricte**: pas de eval, pas de scripts externes
7. **Auto-update**: signe et verifie via electron-updater

---

## 8. Strategie de persistance des donnees

### 8.1 SQLite (better-sqlite3)

**Emplacement**: `app.getPath('userData')/theone.db`

**Tables**:

```sql
-- Workspaces
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  paths TEXT NOT NULL,        -- JSON array of strings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Kanban tasks
CREATE TABLE kanban_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  column TEXT NOT NULL DEFAULT 'TODO',
  assigned_agent_id TEXT,
  priority INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_kanban_project ON kanban_tasks(project_id);

-- Auto-Clauder config
CREATE TABLE autoclauder_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  enabled INTEGER NOT NULL DEFAULT 1,
  default_claude_md TEXT DEFAULT '',
  default_settings TEXT DEFAULT '{}',
  apply_on_project_open INTEGER NOT NULL DEFAULT 0
);

-- Update check history
CREATE TABLE update_checks (
  target TEXT PRIMARY KEY,
  current_version TEXT,
  latest_version TEXT,
  has_update INTEGER DEFAULT 0,
  release_url TEXT,
  checked_at INTEGER NOT NULL
);

-- App settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 8.2 Migration Strategy

- Fichiers SQL numerotes dans `resources/migrations/`
- La table `_migrations` track les migrations appliquees
- `DatabaseService` applique les migrations au demarrage de l'app

### 8.3 Donnees non persistees (en memoire)

- Etat des terminaux (tabs, panes, splits) — reconstruit a chaque session
- Sessions Claude actives — processus vivants, pas besoin de persistance
- Output terminal — pas stocke (trop volumineux)

---

## 9. Gestion d'etat (State Management)

### 9.1 Architecture

```
Main Process                    Renderer Process
┌──────────────┐               ┌────────────────────┐
│ Services     │  ← IPC →     │ Zustand Stores      │
│ (source of   │               │ (UI state +         │
│  truth for   │               │  cached server      │
│  data)       │               │  state)             │
└──────────────┘               └────────────────────┘
```

### 9.2 Principes

1. **Main process = source de verite** pour les donnees persistees (workspaces, kanban, settings)
2. **Renderer = cache + UI state** via Zustand stores
3. **Synchronisation**: le renderer fetch via IPC et ecoute les events push du main process
4. **Feature slices**: chaque feature a son propre Zustand store (terminal, workspace, kanban, etc.)
5. **Pas de store global monolithique**: composition de stores independants

### 9.3 Flux de donnees

```
User action → React component → Zustand action → IPC invoke → Main service → DB
                                                                    ↓
                                                              IPC event push
                                                                    ↓
                                                    Zustand listener → React re-render
```

### 9.4 Stores Zustand

| Store | Responsabilite | Persiste? |
|-------|---------------|-----------|
| `useTerminalStore` | Tabs, panes, layouts, active pane | Non |
| `useWorkspaceStore` | Workspaces, projects, active selection | Cache IPC |
| `useClaudeSessionStore` | Sessions actives, statuts | Cache IPC |
| `useKanbanStore` | Taches par projet, drag state | Cache IPC |
| `useUpdateStore` | Infos de mises a jour | Cache IPC |
| `useSettingsStore` | Preferences UI | Cache IPC |

---

## 10. Strategie de test

### 10.1 Niveaux de test

| Niveau | Cible | Framework | Couverture visee |
|--------|-------|-----------|-----------------|
| **Unit** | Services main, stores Zustand, utils | Vitest | 90%+ |
| **Integration** | IPC handlers + services, Database | Vitest + mocks Electron | 80%+ |
| **Component** | Composants React individuels | Vitest + Testing Library | 70%+ |
| **E2E** | Flux utilisateur complets | Playwright | Chemins critiques |

### 10.2 Ce qu'on teste a chaque niveau

**Unit tests**:
- `PtyService`: creation, write, resize, close de PTY (mock node-pty)
- `WorkspaceService`: scan de projets, detection .claude (mock fs)
- `ClaudeSessionManager`: lancement, arret, relaunch (mock child_process)
- `KanbanService`: CRUD taches, changement de colonne (mock DB)
- `DatabaseService`: migrations, queries (in-memory SQLite)
- Zustand stores: toutes les actions et selectors
- Validation Zod: payloads valides et invalides

**Integration tests**:
- IPC round-trip: renderer invoke → main handler → service → response
- Database: migrations + CRUD reel sur SQLite fichier
- PTY lifecycle: create → write → output → close
- Claude session lifecycle: launch → output stream → stop

**E2E tests**:
- Ouvrir l'app, creer un workspace, ajouter un projet
- Ouvrir un terminal, taper une commande, verifier l'output
- Splitter un terminal, redimensionner
- Creer une tache Kanban, la deplacer
- Lancer une session Claude (si Claude Code installe)

### 10.3 Outils de test specifiques

- **electron-mock**: harness pour simuler l'API Electron dans les tests
- **ipc-simulator**: simule le canal IPC pour tester handlers sans Electron
- **pty-mock**: mock de node-pty pour tests sans vrai shell

---

## 11. Plan d'implementation par phases

### Phase 1 - Fondations (US prioritaires: Terminal + Tabs)
1. Setup projet (Electron + Vite + React + TypeScript)
2. Configuration securite Electron (BrowserWindow, preload, CSP)
3. Infrastructure IPC type-safe
4. Service PTY + terminal basique (xterm.js)
5. Systeme d'onglets

### Phase 2 - Workspaces et splits
6. Splits de terminaux (jusqu'a 4 panes)
7. Service workspace + scan projets
8. Detection .claude avec indicateurs visuels
9. Sidebar workspace/projets

### Phase 3 - Integration Claude
10. ClaudeSessionManager (lancement/arret Claude Code)
11. Auto-split terminal pour agents multiples
12. Mode loop avec relance automatique
13. Auto-Clauder service

### Phase 4 - Kanban et Updates
14. Database SQLite + migrations
15. Kanban board avec drag-and-drop
16. Assignation d'agents aux taches
17. Update checker (Node, npm, Claude Code)

### Phase 5 - Polish
18. Menu macOS natif
19. Packaging et distribution (electron-builder)
20. E2E tests
21. Optimisation performance (xterm.js WebGL renderer)
