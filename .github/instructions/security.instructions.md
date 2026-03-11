---
applyTo: "src/main/**,src/preload/**"
---

# Security Rules

## Electron Security (Mandatory)

- `contextIsolation: true` — always on
- `nodeIntegration: false` — never enable
- `webSecurity: true` — never disable
- `sandbox: true` — keep renderer sandboxed
- Never expose `ipcRenderer` directly — wrap in contextBridge functions

## Content Security Policy

- Set via `session.defaultSession.webRequest.onHeadersReceived`
- Minimum: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- Never use `'unsafe-eval'` in production

## Navigation & External Links

- Block all navigations away from app origin via `will-navigate`
- `setWindowOpenHandler` to deny or control new windows
- Validate URLs before `shell.openExternal` — allow only `https:` and `mailto:`

## IPC Security

- Validate all inputs in main process handlers (type check, sanitize)
- Never trust client-provided IDs for resource access without verification
- IPC handlers must not expose file system traversal paths

## Secrets

- Never commit `.env` with real secrets
- Never hardcode API keys, tokens, or credentials
- Use environment variables or secret managers

## Anti-patterns

- No `remote` module usage
- No `webSecurity: false`
- No `shell.openExternal(userInput)` without URL validation
- No raw user input in file paths or shell commands
