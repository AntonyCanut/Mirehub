import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'

const ACTIVITY_DIR = path.join(os.homedir(), '.mirehub', 'activity')
const HOOKS_DIR = path.join(os.homedir(), '.mirehub', 'hooks')
const HOOK_SCRIPT_NAME = 'mirehub-activity.sh'

/**
 * Ensures the global activity hook script exists at ~/.mirehub/hooks/mirehub-activity.sh
 */
export function ensureActivityHookScript(): void {
  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true })
  }
  if (!fs.existsSync(ACTIVITY_DIR)) {
    fs.mkdirSync(ACTIVITY_DIR, { recursive: true })
  }

  const scriptPath = path.join(HOOKS_DIR, HOOK_SCRIPT_NAME)
  const script = `#!/bin/bash
# Mirehub Claude Activity Hook (auto-generated)
# Signals Claude activity status to Mirehub via status files
STATUS_DIR="$HOME/.mirehub/activity"
mkdir -p "$STATUS_DIR"

# Hash the project path for unique filename
if command -v md5 &>/dev/null; then
  HASH=$(echo -n "$PWD" | md5)
elif command -v md5sum &>/dev/null; then
  HASH=$(echo -n "$PWD" | md5sum | cut -d' ' -f1)
else
  HASH=$(echo -n "$PWD" | shasum | cut -d' ' -f1)
fi
HASH="\${HASH:0:16}"
FILE="$STATUS_DIR/$HASH.json"

STATUS="\${1:-working}"

# For 'working' status, throttle writes (max once per 30s)
if [ "$STATUS" = "working" ] && [ -f "$FILE" ]; then
  MTIME=$(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  AGE=$((NOW - MTIME))
  if [ "$AGE" -lt 30 ]; then
    exit 0
  fi
fi

printf '{"status":"%s","path":"%s","timestamp":%s}\\n' "$STATUS" "$PWD" "$(date +%s)" > "$FILE"
`
  fs.writeFileSync(scriptPath, script, { mode: 0o755 })
}

/**
 * Installs PreToolUse + Stop hooks in a project's settings.local.json
 * to signal Claude activity back to Mirehub.
 * Merges with existing hooks (e.g. kanban hooks) without overwriting.
 */
export function installActivityHooks(projectPath: string): void {
  ensureActivityHookScript()

  const claudeDir = path.join(projectPath, '.claude')
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  const settingsPath = path.join(claudeDir, 'settings.local.json')
  let settings: Record<string, unknown> = {}
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } catch { /* ignore corrupt file */ }
  }

  if (!settings.hooks) {
    settings.hooks = {}
  }
  const hooks = settings.hooks as Record<string, unknown[]>

  const scriptPath = path.join(HOOKS_DIR, HOOK_SCRIPT_NAME)
  const hookIdentifier = 'mirehub-activity.sh'

  // Install PreToolUse hook (for "working" signal)
  if (!hooks.PreToolUse) {
    hooks.PreToolUse = []
  }
  const preToolHooks = hooks.PreToolUse as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
  const hasPreTool = preToolHooks.some((h) =>
    h.hooks?.some((hk) => hk.command?.includes(hookIdentifier)),
  )
  if (!hasPreTool) {
    preToolHooks.push({
      matcher: '',
      hooks: [{ type: 'command', command: `bash "${scriptPath}" working` }],
    })
  }

  // Install Stop hook (for "done" signal)
  if (!hooks.Stop) {
    hooks.Stop = []
  }
  const stopHooks = hooks.Stop as Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
  const hasStop = stopHooks.some((h) =>
    h.hooks?.some((hk) => hk.command?.includes(hookIdentifier)),
  )
  if (!hasStop) {
    stopHooks.push({
      matcher: '',
      hooks: [{ type: 'command', command: `bash "${scriptPath}" done` }],
    })
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

/**
 * Watches ~/.mirehub/activity/ for status file changes.
 * Broadcasts CLAUDE_ACTIVITY events to all renderer windows.
 */
export function startActivityWatcher(): () => void {
  if (!fs.existsSync(ACTIVITY_DIR)) {
    fs.mkdirSync(ACTIVITY_DIR, { recursive: true })
  }

  let debounceTimer: NodeJS.Timeout | null = null

  const watcher = fs.watch(ACTIVITY_DIR, (_eventType, filename) => {
    if (!filename || !filename.endsWith('.json')) return

    // Debounce rapid file changes
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      broadcastActivityFromFile(path.join(ACTIVITY_DIR, filename))
    }, 200)
  })

  // Also do an initial scan for any existing activity files
  try {
    const files = fs.readdirSync(ACTIVITY_DIR).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      broadcastActivityFromFile(path.join(ACTIVITY_DIR, file))
    }
  } catch { /* ignore */ }

  // Periodic cleanup: remove activity files older than 5 minutes
  const cleanupInterval = setInterval(() => {
    try {
      const now = Date.now() / 1000
      const files = fs.readdirSync(ACTIVITY_DIR).filter((f) => f.endsWith('.json'))
      for (const file of files) {
        const filePath = path.join(ACTIVITY_DIR, file)
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          if (data.status === 'done' && now - data.timestamp > 300) {
            fs.unlinkSync(filePath)
          }
        } catch {
          // Remove corrupt files
          try { fs.unlinkSync(filePath) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, 60000)

  return () => {
    watcher.close()
    clearInterval(cleanupInterval)
    if (debounceTimer) clearTimeout(debounceTimer)
  }
}

function broadcastActivityFromFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    if (!data.path || !data.status) return

    const payload = {
      path: data.path,
      status: data.status,
      timestamp: data.timestamp || Math.floor(Date.now() / 1000),
    }

    // Send to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.CLAUDE_ACTIVITY, payload)
        }
      } catch { /* render frame disposed — ignore */ }
    }
  } catch { /* ignore read/parse errors */ }
}
