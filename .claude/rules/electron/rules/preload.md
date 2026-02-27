---
author: "SpaceMalamute"
authorUrl: "https://github.com/SpaceMalamute"
---

---
description: "Electron preload script patterns — contextBridge, typed API"
paths:
  - "**/src/preload/**/*.ts"
  - "**/preload/**/*.ts"
---

# Preload Scripts

## contextBridge Pattern

- Expose only named methods via `contextBridge.exposeInMainWorld`
- Never expose `ipcRenderer` directly — wrap each call in a function
- Keep preload surface area minimal — one method per IPC action

## GOOD

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  readFile: (path: string): Promise<string> =>
    ipcRenderer.invoke('file:read', path),
  onProgressUpdate: (callback: (progress: number) => void) => {
    const listener = (_event: IpcRendererEvent, progress: number) => callback(progress);
    ipcRenderer.on('task:progress', listener);
    return () => ipcRenderer.removeListener('task:progress', listener);
  },
});
```

## BAD

```typescript
// Exposing raw ipcRenderer — renderer gets full Node.js IPC access
contextBridge.exposeInMainWorld('electron', { ipcRenderer });

// Exposing send/on directly — no channel restriction
contextBridge.exposeInMainWorld('api', {
  send: ipcRenderer.send,
  on: ipcRenderer.on,
});
```

## Type Safety

- Declare the exposed API type in `src/shared/types/`
- Augment the `Window` interface so the renderer has type-safe access

## GOOD

```typescript
// src/shared/types/api.ts
export interface ElectronAPI {
  readFile(path: string): Promise<string>;
  onProgressUpdate(callback: (progress: number) => void): () => void;
}

// src/preload/index.d.ts
import type { ElectronAPI } from '../shared/types/api';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
```

## Cleanup

- Always return an unsubscribe function for `ipcRenderer.on` listeners
- Renderer components must call the unsubscribe on unmount to prevent leaks
