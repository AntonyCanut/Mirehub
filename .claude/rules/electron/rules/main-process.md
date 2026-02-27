---
author: "SpaceMalamute"
authorUrl: "https://github.com/SpaceMalamute"
---

---
description: "Electron main process patterns — app lifecycle, window management"
paths:
  - "**/src/main/**/*.ts"
  - "**/electron/main/**/*.ts"
  - "**/electron.vite.config.*"
---

# Main Process

## App Lifecycle

- Always use `app.whenReady()` (Promise-based) instead of `app.on('ready')`
- Handle `window-all-closed` — quit on non-macOS, no-op on macOS
- Handle `activate` — recreate window when dock icon clicked on macOS

## GOOD

```typescript
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

## BAD

```typescript
// Creating windows before app is ready
createMainWindow();

// Missing macOS activate handler — dock click does nothing
app.on('window-all-closed', () => app.quit());
```

## BrowserWindow Creation

- Show window only after `ready-to-show` to avoid visual flash
- Set `webPreferences` explicitly — never rely on defaults
- Load renderer via electron-vite resolved paths

## GOOD

```typescript
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on('ready-to-show', () => win.show());
  return win;
}
```

## BAD

```typescript
// Missing show:false / ready-to-show — white flash on startup
const win = new BrowserWindow({ width: 1200, height: 800 });

// Missing security-critical webPreferences
const win = new BrowserWindow({
  webPreferences: { preload: join(__dirname, '../preload/index.js') },
});
```

## Window Management

- Store window references to prevent garbage collection
- Use `win.isDestroyed()` before interacting with a closed window
- Clean up IPC listeners when windows close to avoid memory leaks
