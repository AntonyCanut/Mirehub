# Kanbai - GitHub Copilot Instructions

## Project Overview

Kanbai is an AI-enhanced macOS terminal built with Electron. It combines a full terminal emulator (xterm.js + node-pty), workspace/project management, native Claude Code integration, and a Kanban board with AI agent assignment.

## Language

- Code (variables, functions, comments): **English**
- Git commits, PR descriptions: **French**

## Tech Stack

- Electron 33+ (macOS desktop)
- TypeScript 5.x (strict mode, no `any`)
- React 19 (renderer UI)
- Vite 6 (build tooling)
- Zustand 5 (state management, per-domain stores)
- xterm.js 6 + node-pty (terminal emulator)
- Monaco Editor (code viewer/editor)
- CSS custom properties (no Tailwind)
- Vitest (testing)
- electron-builder (packaging)

## Architecture

Three-process Electron model:

- **Main** (`src/main/`) — Node.js, IPC handlers in `ipc/`, StorageService in `services/`
- **Preload** (`src/preload/`) — contextBridge, exposes `window.kanbai` API
- **Renderer** (`src/renderer/`) — React, flat components in `components/`, Zustand stores in `lib/stores/`
- **Shared** (`src/shared/`) — All types in `types/index.ts`, constants in `constants/`

## Security (Mandatory)

- `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
- Never expose `ipcRenderer` directly — use contextBridge wrapper functions
- Validate all inputs in main process handlers
- No `shell.openExternal` without URL validation

## IPC Patterns

- Channel format: `namespace:action` (e.g., `terminal:create`, `git:status`)
- All channels in `IPC_CHANNELS` constant (`src/shared/types/index.ts`)
- Request-response: `ipcRenderer.invoke` / `ipcMain.handle`
- Events only: `ipcRenderer.send` / `ipcMain.on`
- Preload API: `window.kanbai.{domain}.{method}()`

## State Management

- Main process = source of truth (StorageService → `~/.kanbai/data.json`)
- Renderer = Zustand stores as cache (terminal, workspace, claude, kanban, update, view)
- Flow: React → Zustand → IPC invoke → Main service → JSON → IPC event → Zustand → React

## Code Conventions

- TypeScript strict mode, explicit return types on exports
- `interface` for object shapes, `type` for unions
- No `enum` — use `as const` + `typeof`
- Files: `kebab-case.ts`
- Small functions (< 30 lines), max 3 nesting levels
- Conventional Commits in French

## Key Types (src/shared/types/index.ts)

- `Workspace`, `Project` — workspace/project management
- `TerminalSession`, `TerminalTab`, `TerminalPane` — terminal system
- `ClaudeSession` — AI session management
- `KanbanTask` — Kanban with status: `TODO | WORKING | PENDING | DONE | FAILED`
- `AppSettings`, `GitStatus`, `FileEntry`

## Testing

- Vitest: `tests/unit/` (services, stores) + `tests/integration/` (IPC round-trips)
- Mock infra: `tests/mocks/electron.ts`, `tests/helpers/storage.ts`
