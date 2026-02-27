---
author: "SpaceMalamute"
authorUrl: "https://github.com/SpaceMalamute"
---

---
description: "Electron IPC patterns — typed channels, invoke/handle, validation"
paths:
  - "**/src/main/ipc/**/*.ts"
  - "**/src/main/**/*handler*"
  - "**/src/main/**/*ipc*"
  - "**/shared/types/**/*.ts"
  - "**/src/shared/**/*.ts"
---

# IPC Communication

## Channel Definition

- Define all channel names as typed constants in a shared file
- Use `namespace:action` naming — group by domain, not by process

## GOOD

```typescript
// src/shared/channels.ts
export const Channels = {
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_CLOSE: 'window:close',
} as const;

export type Channel = (typeof Channels)[keyof typeof Channels];
```

## BAD

```typescript
// Inline magic strings — no autocompletion, no refactoring
ipcMain.handle('readFile', handler);
ipcRenderer.invoke('readFile', path);

// Generic channel names — no namespace grouping
ipcMain.handle('do-stuff', handler);
```

## invoke/handle (Request-Response)

- Use for all operations that return a result
- Always validate inputs in the main process handler
- Return typed results — avoid `any`

## GOOD

```typescript
// Main process handler
ipcMain.handle(Channels.FILE_READ, async (_event, filePath: unknown) => {
  if (typeof filePath !== 'string') throw new Error('Invalid file path');
  const safePath = path.resolve(app.getPath('userData'), path.basename(filePath));
  return fs.readFile(safePath, 'utf-8');
});
```

## BAD

```typescript
// Trusting renderer input without validation
ipcMain.handle('file:read', async (_event, filePath: string) => {
  return fs.readFile(filePath, 'utf-8'); // Path traversal vulnerability
});

// Using send/on for request-response — no built-in error propagation
ipcRenderer.send('file:read', path);
ipcRenderer.on('file:read-result', (_e, data) => { /* ... */ });
```

## send/on (Fire-and-Forget)

- Use only for one-way notifications (progress updates, event broadcasts)
- Main-to-renderer: use `webContents.send` on a specific window
- Never use `send/on` when you need a response — use `invoke/handle`

## Error Handling

- Errors thrown in `handle` callbacks propagate to the renderer's `invoke` as rejections
- Wrap handler logic in try/catch and return structured error objects for expected failures
- Log unexpected errors in the main process before re-throwing
