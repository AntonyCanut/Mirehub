# Kanbai - Codex Instructions

## Project Overview

Kanbai is an AI-enhanced macOS terminal built with Electron. It combines a full terminal emulator (xterm.js + node-pty), workspace/project management, native Claude Code integration, and a Kanban board with AI agent assignment.

## Language

- Code (variables, functions, comments): **English**
- Git commits, PR descriptions: **French**

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 33+ | Desktop framework, macOS native access |
| TypeScript | 5.x | Strict mode everywhere |
| React | 19 | Renderer UI |
| Vite | 6 | Build tooling (main + preload + renderer) |
| Zustand | 5 | State management (per-domain stores) |
| xterm.js | 6 | Terminal emulator |
| node-pty | 1.x | Pseudo-terminal backend |
| Monaco Editor | 0.55+ | Code editor/viewer |
| Vitest | 3.x | Unit and integration tests |
| electron-builder | 26+ | macOS packaging |

## Architecture

```
src/
  main/              # Main process (Node.js) — app lifecycle, IPC handlers, services
    ipc/             # IPC handlers (1 file per domain)
    services/        # StorageService (JSON persistence)
  preload/           # Preload scripts — contextBridge, exposes window.kanbai
  renderer/          # Renderer process (React + Zustand)
    components/      # All UI components (flat architecture)
    lib/stores/      # Zustand stores (per domain)
  shared/            # Shared types and constants (both processes)
    types/index.ts   # ALL interfaces + IPC_CHANNELS
tests/
  unit/              # Unit tests (services, stores, utils)
  integration/       # IPC round-trip tests
```

## Process Model

| Process | Environment | Access | Role |
|---------|-------------|--------|------|
| Main | Node.js | Full OS | Window management, IPC handlers, services |
| Renderer | Chromium | Sandboxed | UI rendering (React) |
| Preload | Isolated | Limited Node.js | Bridge via contextBridge |

## Security (Mandatory)

- `contextIsolation: true` — always
- `nodeIntegration: false` — never enable
- `webSecurity: true` — never disable
- Never expose `ipcRenderer` directly — wrap in contextBridge functions
- Validate all inputs in main process IPC handlers
- CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

## IPC Conventions

- Channel naming: `namespace:action` (e.g., `file:read`, `window:minimize`)
- All channels defined in `IPC_CHANNELS` constant (`src/shared/types/index.ts`)
- Request-response: `ipcRenderer.invoke` / `ipcMain.handle`
- Fire-and-forget: `ipcRenderer.send` / `ipcMain.on`
- Preload exposes API as `window.kanbai` with domain-grouped methods

## State Management

- Main process = source of truth (StorageService, `~/.kanbai/data.json`)
- Renderer = Zustand stores as cache + UI state
- Flow: User action → React → Zustand action → IPC invoke → Main service → JSON
- Stores: terminalStore, workspaceStore, claudeStore, kanbanStore, updateStore, viewStore

## Data Persistence

- `~/.kanbai/data.json` — workspaces, projects, settings, templates (via StorageService singleton)
- `.workspaces/kanban.json` — per-project Kanban tasks
- Session state saved/restored via StorageService

## Code Conventions

- TypeScript strict mode, no `any` without justification
- ESLint + Prettier for formatting
- Conventional Commits in French: `type(scope): description`
- No Co-Authored-By trailers in commits
- Files: `kebab-case.ts`, IPC handlers: `[namespace]-handler.ts`
- Small functions (< 30 lines), max 3 levels nesting

## Key Interfaces

All TypeScript interfaces in `src/shared/types/index.ts`:
- `Workspace`, `Project` — workspace/project management
- `TerminalSession`, `TerminalTab`, `TerminalPane` — terminal system
- `ClaudeSession` — Claude Code integration
- `KanbanTask` (status: TODO|WORKING|PENDING|DONE|FAILED)
- `AppSettings` — user preferences
- `GitStatus`, `GitLogEntry`, `FileEntry` — git/filesystem

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

- Vitest for all tests
- Unit: services, stores, utilities (`tests/unit/`)
- Integration: IPC round-trips with mocked Electron (`tests/integration/`)
- Mock infrastructure: `tests/mocks/electron.ts`, `tests/helpers/storage.ts`
- Always run tests before marking work as done
