---
applyTo: "tests/**"
---

# Testing Rules

## Framework

- Vitest for all tests
- AAA pattern (Arrange-Act-Assert)
- One assertion per test when practical

## Structure

- `tests/unit/` — services, stores, utilities
- `tests/integration/` — IPC round-trips with mocked Electron
- `tests/mocks/electron.ts` — `createMockIpcMain()` simulating Electron IPC
- `tests/helpers/storage.ts` — temp directory utilities for StorageService

## Naming

- `should [expected] when [condition]`
- Group by module with `describe` blocks

## Mocking

- Mock only external dependencies (Electron APIs, filesystem)
- Use `vi.mock` for Electron modules
- Use `vi.stubGlobal('window', { kanbai: { ... } })` for renderer store tests
- Clean up mocks after each test (`vi.restoreAllMocks`)
