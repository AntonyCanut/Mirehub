---
author: "SpaceMalamute"
authorUrl: "https://github.com/SpaceMalamute"
---

---
description: "Electron security checklist — CSP, navigation, shell.openExternal"
paths:
  - "**/src/main/**/*.ts"
  - "**/electron/main/**/*.ts"
  - "**/src/preload/**/*.ts"
---

# Security

## Content Security Policy

- Set a strict CSP via `session.defaultSession.webRequest.onHeadersReceived`
- At minimum: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- Never use `'unsafe-eval'` in production

## GOOD

```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"],
    },
  });
});
```

## Navigation Restrictions

- Block all navigations away from the app origin
- Deny new window creation unless explicitly needed

## GOOD

```typescript
win.webContents.on('will-navigate', (event, url) => {
  if (new URL(url).origin !== 'http://localhost:5173') {
    event.preventDefault();
  }
});

win.webContents.setWindowOpenHandler(({ url }) => {
  if (url.startsWith('https:')) shell.openExternal(url);
  return { action: 'deny' };
});
```

## BAD

```typescript
// No navigation guard — renderer can navigate to arbitrary URLs
// No setWindowOpenHandler — new windows inherit full privileges

// Disabling security features
new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,    // Full Node.js in renderer
    contextIsolation: false,  // No process boundary
    webSecurity: false,       // Disables same-origin policy
  },
});
```

## shell.openExternal

- Always validate URLs before calling `shell.openExternal`
- Only allow `https:` and `mailto:` protocols
- Never pass user-controlled strings directly

## GOOD

```typescript
function safeOpenExternal(url: string): void {
  const parsed = new URL(url);
  if (['https:', 'mailto:'].includes(parsed.protocol)) {
    shell.openExternal(url);
  }
}
```

## BAD

```typescript
// Arbitrary protocol execution — attacker can trigger file:// or custom protocols
shell.openExternal(userInput);
```

## Checklist

- `contextIsolation: true` — never disable
- `nodeIntegration: false` — never enable
- `sandbox: true` — keep renderer sandboxed
- `webSecurity: true` — never disable
- CSP header set on all responses
- `will-navigate` handler blocks external navigation
- `setWindowOpenHandler` denies or controls new windows
- `shell.openExternal` validates protocol before opening
