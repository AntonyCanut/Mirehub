# Kanbai - Gemini CLI Instructions

## Project Overview

Kanbai is an AI-enhanced macOS terminal built with Electron. It combines a full terminal emulator (xterm.js + node-pty), workspace/project management, native Claude Code integration, and a Kanban board with AI agent assignment.

## Language

- Code (variables, functions, comments): **English**
- Git commits, PR descriptions: **French**

## Tech Stack

- **Electron 33+** — Desktop framework with macOS native access
- **TypeScript 5.x** — Strict mode everywhere, no `any`
- **React 19** — Renderer UI
- **Vite 6** — Build tooling (main + preload + renderer)
- **Zustand 5** — State management (lightweight, per-domain stores)
- **xterm.js 6** — Terminal emulator with WebGL rendering
- **node-pty** — Pseudo-terminal backend
- **Monaco Editor** — Code editor/viewer
- **Vitest** — Unit and integration tests
- **electron-builder** — macOS packaging (.dmg, .app)

## Architecture

Three-process Electron model:

1. **Main Process** (`src/main/`) — Node.js, full OS access
   - `index.ts` — App lifecycle, BrowserWindow creation
   - `ipc/` — IPC handlers (1 file per domain: terminal, workspace, project, claude, kanban, git, filesystem, updates, session, workspaceEnv, app)
   - `services/storage.ts` — StorageService singleton (JSON persistence at `~/.kanbai/data.json`)

2. **Preload** (`src/preload/`) — Bridge between processes
   - Exposes `window.kanbai` API via `contextBridge`
   - Domain-grouped methods (terminal, workspace, project, fs, git, claude, kanban, etc.)

3. **Renderer** (`src/renderer/`) — Chromium, sandboxed
   - React app with Zustand state management
   - Flat component architecture in `components/`
   - Stores in `lib/stores/` (terminal, workspace, claude, kanban, update, view)

4. **Shared** (`src/shared/`) — Types and constants used by all processes
   - `types/index.ts` — ALL interfaces + `IPC_CHANNELS` constant

## Security Rules (Mandatory)

- `contextIsolation: true` — always on
- `nodeIntegration: false` — never enable
- `webSecurity: true` — never disable
- `sandbox: true` — keep renderer sandboxed
- Never expose `ipcRenderer` directly to renderer
- Validate all inputs in main process IPC handlers
- No `shell.openExternal` with unvalidated URLs

## IPC Conventions

- Channel format: `namespace:action` (e.g., `terminal:create`, `git:status`)
- Request-response: `ipcRenderer.invoke` / `ipcMain.handle`
- Events: `ipcRenderer.send` / `ipcMain.on` (fire-and-forget only)
- All channel names in `IPC_CHANNELS` constant

## State Management

- Main process = source of truth for persisted data
- Renderer uses Zustand stores as cache + UI state
- Data flow: User action → React → Zustand → IPC invoke → Main service → JSON file
- Each domain has its own store (no monolithic global store)

## Code Conventions

- TypeScript strict mode everywhere
- No `any` without documented justification
- ESLint + Prettier for formatting
- Conventional Commits in French: `type(scope): description`
- No Co-Authored-By trailers
- Files: `kebab-case.ts`
- Small functions (< 30 lines), max 3 nesting levels
- CSS custom properties (no Tailwind)

## Key Types

All in `src/shared/types/index.ts`:
- `Workspace`, `Project` — workspace/project management
- `TerminalSession`, `TerminalTab`, `TerminalPane` — terminal system
- `ClaudeSession` — AI integration
- `KanbanTask` — status: `TODO | WORKING | PENDING | DONE | FAILED`
- `AppSettings` — user preferences
- `GitStatus`, `GitLogEntry`, `FileEntry` — git and filesystem

## Commands

```bash
npm run dev         # Dev with hot-reload
npm run build       # Production build
npm run test        # Unit tests (Vitest)
npm run lint        # ESLint
npm run typecheck   # TypeScript check
npm run package     # Package app (electron-builder)
```

## Testing

- **Vitest** for unit and integration tests
- Unit tests: `tests/unit/` — services, stores, utilities
- Integration tests: `tests/integration/` — IPC round-trips
- Mock infrastructure: `tests/mocks/electron.ts`, `tests/helpers/storage.ts`
- Always run tests before completing work

## Data Persistence

- `~/.kanbai/data.json` — main data store (workspaces, projects, settings)
- `.workspaces/kanban.json` — per-project Kanban tasks
- StorageService singleton loads JSON at startup, writes on every change
