import { IpcMain, BrowserWindow } from 'electron'
import { spawn, IPty } from 'node-pty'
import { v4 as uuid } from 'uuid'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { IPC_CHANNELS } from '../../shared/types'
import { IS_WIN, getDefaultShell, getDefaultShellArgs, killProcess, isShellValid, normalizeWindowsShell } from '../../shared/platform'

const execFileAsync = promisify(execFile)
import { StorageService } from '../services/storage'
import { getGitProfileEnvForWorkspace } from './git'

interface ManagedTerminal {
  id: string
  pty: IPty
  cwd: string
  workspaceId: string | null
  tabId: string | null
  label: string | null
  taskId: string | null
  ticketNumber: string | null
  createdAt: number
  lastActivity: number
  disposables: Array<{ dispose(): void }>
}

/** Threshold in ms — terminal is considered "working" if it received output within this window */
const ACTIVITY_THRESHOLD_MS = 5000

/** Interval for periodic session file persistence (keeps KanbaiApi data fresh) */
let sessionPersistInterval: ReturnType<typeof setInterval> | null = null
const SESSION_PERSIST_INTERVAL_MS = 3000

/** Exported terminal session info for the companion API */
export interface TerminalSessionInfo {
  id: string
  cwd: string
  workspaceId: string | null
  tabId: string | null
  taskId: string | null
  ticketNumber: string | null
  title: string
  status: 'working' | 'idle'
  createdAt: number
}

const terminals = new Map<string, ManagedTerminal>()

/**
 * Ring buffer per terminal — stores the last OUTPUT_BUFFER_MAX_SIZE bytes of
 * PTY output so the companion app can display recent terminal content.
 */
const OUTPUT_BUFFER_MAX_SIZE = 64 * 1024 // 64 KB per session
const outputBuffers = new Map<string, string>()

/**
 * Pending input commands written by external processes (KanbaiApi relay).
 * The Desktop app polls this file and feeds data to the matching PTY.
 */
const INPUT_QUEUE_PATH = path.join(os.homedir(), '.kanbai', 'terminal-input-queue.json')
const OUTPUT_DIR = path.join(os.homedir(), '.kanbai', 'terminal-output')

/**
 * Dispose listeners BEFORE killing the pty process.
 * This prevents native callbacks from firing into a dying JS context (SIGABRT).
 *
 * On macOS/Linux we use process.kill(pid, 'SIGKILL') so the child exits
 * immediately — minimising the window where node-pty's native read thread
 * can queue a ThreadSafeFunction callback into a shutting-down V8 isolate.
 *
 * On Windows we must use pty.kill() because ConPTY requires proper handle
 * cleanup via ClosePseudoConsole. Calling process.kill(pid) only terminates
 * the child shell but leaves the ConPTY baton alive — when the native read
 * thread later calls remove_pty_baton() the assertion fails (conpty.cc:106).
 */
function disposeTerminal(terminal: ManagedTerminal): void {
  for (const d of terminal.disposables) {
    d.dispose()
  }
  terminal.disposables.length = 0
  if (IS_WIN) {
    try {
      terminal.pty.kill()
    } catch {
      // PTY already exited
    }
  } else {
    killProcess(terminal.pty.pid, 'SIGKILL')
  }
}

/**
 * Ensure a custom ZDOTDIR with a .zshenv and .zshrc that properly
 * initialise the shell environment. This handles two issues:
 *
 * 1. When launched from Finder, process.env.PATH is minimal
 *    (/usr/bin:/bin:/usr/sbin:/sbin). We source /etc/zprofile and
 *    ~/.zprofile in .zshenv so path_helper and user PATH additions
 *    are available (claude, eza, brew tools, etc.).
 *
 * 2. compinit must be loaded BEFORE the user's .zshrc to prevent
 *    "command not found: compdef" errors.
 */
function ensureZshWrapper(): string {
  const shellDir = path.join(os.homedir(), '.kanbai', 'shell')
  if (!fs.existsSync(shellDir)) {
    fs.mkdirSync(shellDir, { recursive: true })
  }

  // .zshenv runs first (before .zshrc) — set up PATH here
  const zshenvContent = [
    '# Source system and user profile for PATH setup (critical when launched from Finder)',
    '[ -f /etc/zprofile ] && source /etc/zprofile',
    '[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile"',
  ].join('\n')

  const zshenvPath = path.join(shellDir, '.zshenv')
  if (!fs.existsSync(zshenvPath) || fs.readFileSync(zshenvPath, 'utf-8') !== zshenvContent) {
    fs.writeFileSync(zshenvPath, zshenvContent, 'utf-8')
  }

  // .zshrc — compinit + user config
  const zshrcContent = [
    'autoload -Uz compinit && compinit -C',
    'ZDOTDIR="$HOME"',
    '[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"',
  ].join('\n')

  const zshrcPath = path.join(shellDir, '.zshrc')
  if (!fs.existsSync(zshrcPath) || fs.readFileSync(zshrcPath, 'utf-8') !== zshrcContent) {
    fs.writeFileSync(zshrcPath, zshrcContent, 'utf-8')
  }

  return shellDir
}

export function getTerminalSessions(): Array<{ id: string; cwd: string }> {
  return Array.from(terminals.values()).map((t) => ({ id: t.id, cwd: t.cwd }))
}

/** Return enriched terminal session info for the companion feature */
export function getTerminalSessionsInfo(): TerminalSessionInfo[] {
  const now = Date.now()
  return Array.from(terminals.values()).map((t) => ({
    id: t.id,
    cwd: t.cwd,
    workspaceId: t.workspaceId,
    tabId: t.tabId,
    taskId: t.taskId,
    ticketNumber: t.ticketNumber,
    title: t.label || path.basename(t.cwd) || 'Terminal',
    status: (now - t.lastActivity < ACTIVITY_THRESHOLD_MS ? 'working' : 'idle') as 'working' | 'idle',
    createdAt: t.createdAt,
  }))
}

/** Persist current terminal sessions to ~/.kanbai/terminal-sessions.json for the companion API */
function persistTerminalSessions(): void {
  const sessions = getTerminalSessionsInfo()
  const filePath = path.join(os.homedir(), '.kanbai', 'terminal-sessions.json')
  try {
    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf-8')
  } catch {
    // Best-effort — companion may not be active
  }
}

/** Update the label for a terminal session (called from renderer via IPC) */
export function updateTerminalLabel(sessionId: string, label: string): void {
  const terminal = terminals.get(sessionId)
  if (terminal) {
    terminal.label = label
    persistTerminalSessions()
  }
}

/** Link a terminal session to a kanban task (called from renderer after tab creation) */
export function setTerminalTaskInfo(tabId: string, taskId: string, ticketNumber: string): void {
  for (const terminal of terminals.values()) {
    if (terminal.tabId === tabId) {
      terminal.taskId = taskId
      terminal.ticketNumber = ticketNumber
      persistTerminalSessions()
      return
    }
  }
}

/** Return buffered output for a terminal session */
export function getTerminalOutput(sessionId: string): string {
  return outputBuffers.get(sessionId) ?? ''
}

/**
 * Return a clean plain-text rendering of terminal output.
 * Simulates a minimal virtual terminal to handle CR, line-clear (EL),
 * erase-display, and cursor-position sequences that raw ANSI stripping misses.
 */
export function getTerminalOutputClean(sessionId: string): string {
  const raw = outputBuffers.get(sessionId) ?? ''
  if (!raw) return ''
  return renderTerminalToPlainText(raw)
}

/** Minimal virtual-terminal renderer: processes raw PTY bytes into readable text */
function renderTerminalToPlainText(raw: string): string {
  const lines: string[] = ['']
  let row = 0

  let i = 0
  while (i < raw.length) {
    const ch = raw[i] ?? ''

    // --- ESC sequence ---
    if (ch === '\x1b') {
      const next = raw[i + 1]

      // CSI: ESC [
      if (next === '[') {
        const match = raw.slice(i).match(/^\x1b\[([?]?)([0-9;]*)([@A-Za-z])/)
        if (match) {
          i += match[0].length
          const params = match[2] ?? ''
          const code = match[3] ?? ''

          if (code === 'H' || code === 'f') {
            // Cursor position — move to row;col (1-based)
            const parts = params.split(';')
            const targetRow = Math.max(0, (parseInt(parts[0] || '1', 10) - 1))
            while (lines.length <= targetRow) lines.push('')
            row = targetRow
          } else if (code === 'A') {
            // Cursor up
            const n = parseInt(params || '1', 10)
            row = Math.max(0, row - n)
          } else if (code === 'B') {
            // Cursor down
            const n = parseInt(params || '1', 10)
            row += n
            while (lines.length <= row) lines.push('')
          } else if (code === 'J') {
            // Erase display
            const n = parseInt(params || '0', 10)
            if (n === 2 || n === 3) {
              // Clear entire screen
              lines.length = 0
              lines.push('')
              row = 0
            } else if (n === 0) {
              // Clear from cursor to end
              lines[row] = lines[row]?.slice(0, 0) ?? ''
              lines.length = row + 1
            }
          } else if (code === 'K') {
            // Erase in line
            const n = parseInt(params || '0', 10)
            if (n === 0 || n === 2) {
              lines[row] = ''
            }
          }
          // All other CSI (colors, modes, etc.) — skip silently
          continue
        }
      }

      // OSC: ESC ]...BEL or ESC ]...ESC\
      if (next === ']') {
        const oscEnd = raw.indexOf('\x07', i + 2)
        const oscEnd2 = raw.indexOf('\x1b\\', i + 2)
        let end = -1
        if (oscEnd >= 0 && oscEnd2 >= 0) end = Math.min(oscEnd, oscEnd2)
        else if (oscEnd >= 0) end = oscEnd
        else if (oscEnd2 >= 0) end = oscEnd2
        if (end >= 0) {
          i = end + (raw[end] === '\x07' ? 1 : 2)
          continue
        }
      }

      // Other escape sequences (charset, etc.) — skip 2-3 chars
      if (next && '()#'.includes(next)) {
        i += 3
        continue
      }
      // Generic: skip ESC + one char
      i += 2
      continue
    }

    // --- Newline ---
    if (ch === '\n') {
      row++
      while (lines.length <= row) lines.push('')
      i++
      continue
    }

    // --- Carriage return ---
    if (ch === '\r') {
      // CR resets write position to start of current line (handled by overwrite on next char)
      // Just mark for overwrite by clearing current line content
      // (next chars will overwrite from position 0)
      if (raw[i + 1] === '\n') {
        // CR+LF: normal newline
        row++
        while (lines.length <= row) lines.push('')
        i += 2
        continue
      }
      // Bare CR: reset to beginning of line (used for progress bars, spinners)
      lines[row] = ''
      i++
      continue
    }

    // --- Skip other control chars ---
    if (ch.charCodeAt(0) < 32) {
      i++
      continue
    }

    // --- Normal character ---
    while (lines.length <= row) lines.push('')
    lines[row] += ch
    i++
  }

  // Clean up: trim trailing empty lines, collapse excessive blank line runs
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop()
  }

  const result: string[] = []
  let blankRun = 0
  for (const line of lines) {
    if (line.trim() === '') {
      blankRun++
      if (blankRun <= 2) result.push('')
    } else {
      blankRun = 0
      result.push(line)
    }
  }

  return result.join('\n')
}

/** Write input to a terminal session (used by companion feature) */
export function writeTerminalInput(sessionId: string, data: string): boolean {
  const terminal = terminals.get(sessionId)
  if (!terminal) return false
  terminal.pty.write(data)
  return true
}

/** Append PTY output to the ring buffer and persist to disk */
function appendOutputBuffer(sessionId: string, data: string): void {
  let buffer = outputBuffers.get(sessionId) ?? ''
  buffer += data
  if (buffer.length > OUTPUT_BUFFER_MAX_SIZE) {
    buffer = buffer.slice(buffer.length - OUTPUT_BUFFER_MAX_SIZE)
  }
  outputBuffers.set(sessionId, buffer)

  // Persist to file for KanbaiApi access
  try {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUTPUT_DIR, `${sessionId}.log`), buffer, 'utf-8')
  } catch {
    // Best-effort
  }
}

/** Process pending input commands from the relay queue file */
function processInputQueue(): void {
  try {
    if (!fs.existsSync(INPUT_QUEUE_PATH)) return
    const raw = fs.readFileSync(INPUT_QUEUE_PATH, 'utf-8')
    if (!raw.trim()) return
    const commands = JSON.parse(raw) as Array<{ sessionId: string; data: string }>
    // Clear queue immediately to avoid double-processing
    fs.writeFileSync(INPUT_QUEUE_PATH, '[]', 'utf-8')
    for (const cmd of commands) {
      writeTerminalInput(cmd.sessionId, cmd.data)
    }
  } catch {
    // Malformed or locked — skip this cycle
  }
}

let inputQueueInterval: ReturnType<typeof setInterval> | null = null

/** Start polling for external input commands (called once at registration) */
function startInputQueuePolling(): void {
  if (inputQueueInterval) return
  inputQueueInterval = setInterval(processInputQueue, 500)
}

/** Start periodic session persistence so KanbaiApi reads fresh status */
function startSessionPersistInterval(): void {
  if (sessionPersistInterval) return
  sessionPersistInterval = setInterval(() => {
    if (terminals.size > 0) persistTerminalSessions()
  }, 3000)
}

/** Stop input queue polling (called on cleanup) */
function stopInputQueuePolling(): void {
  if (inputQueueInterval) {
    clearInterval(inputQueueInterval)
    inputQueueInterval = null
  }
  if (sessionPersistInterval) {
    clearInterval(sessionPersistInterval)
    sessionPersistInterval = null
  }
}

export function registerTerminalHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_event, options: { cwd?: string; shell?: string; workspaceId?: string; tabId?: string; provider?: string; label?: string }) => {
      const id = uuid()
      const rawShell = new StorageService().getSettings().defaultShell
      // Normalize full paths (e.g. C:\WINDOWS\system32\cmd.exe → cmd.exe)
      const savedShell = normalizeWindowsShell(rawShell)
      // Validate saved shell exists — it may be a macOS path (e.g. /bin/zsh)
      // on a Windows machine if data.json was synced across platforms.
      // isShellValid handles Windows bare names (powershell.exe, cmd.exe, pwsh.exe)
      // that fs.existsSync cannot resolve through PATH.
      const shellExists = savedShell && isShellValid(savedShell)
      const shell = options.shell || (shellExists ? savedShell : null) || getDefaultShell()
      const cwd = options.cwd || os.homedir()

      // No -l for zsh (node-pty PTY makes it interactive; login shell causes compdef issues)
      // Keep -l for bash where it's needed for PATH setup
      const isZsh = !IS_WIN && shell.endsWith('/zsh')
      const shellArgs = getDefaultShellArgs(shell)

      // For zsh: use a custom ZDOTDIR that loads compinit before the user's .zshrc
      const shellEnv: Record<string, string> = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>

      // Remove Claude Code session markers so terminals can launch claude without
      // "nested session" errors (the app may itself be launched from a Claude session)
      delete shellEnv.CLAUDECODE
      delete shellEnv.CLAUDE_CODE_ENTRYPOINT

      // Inject workspace, tab ID, and AI provider for pixel-agents hook tracking
      if (options.workspaceId) shellEnv.KANBAI_WORKSPACE_ID = options.workspaceId
      if (options.tabId) shellEnv.KANBAI_TAB_ID = options.tabId
      if (options.provider) shellEnv.KANBAI_AI_PROVIDER = options.provider

      // Inject namespace git profile so AI tools (Claude Code, Codex, etc.)
      // commit with the correct identity for this workspace's namespace
      if (options.workspaceId) {
        const gitEnv = getGitProfileEnvForWorkspace(options.workspaceId)
        Object.assign(shellEnv, gitEnv)
      }

      if (isZsh) {
        shellEnv.ZDOTDIR = ensureZshWrapper()
      }

      const pty = spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: shellEnv,
      })

      const now = Date.now()
      const managed: ManagedTerminal = {
        id,
        pty,
        cwd,
        workspaceId: options.workspaceId ?? null,
        tabId: options.tabId ?? null,
        label: options.label ?? null,
        taskId: null,
        ticketNumber: null,
        createdAt: now,
        lastActivity: now,
        disposables: [],
      }
      terminals.set(id, managed)
      persistTerminalSessions()

      // Forward output to renderer and capture in ring buffer for companion API
      managed.disposables.push(
        pty.onData((data: string) => {
          // Guard: ignore callbacks for terminals already removed from the map
          if (!terminals.has(id)) return
          managed.lastActivity = Date.now()
          appendOutputBuffer(id, data)
          for (const win of BrowserWindow.getAllWindows()) {
            try {
              if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data })
              }
            } catch { /* render frame disposed — ignore */ }
          }
        }),
      )

      managed.disposables.push(
        pty.onExit(({ exitCode, signal }) => {
          terminals.delete(id)
          outputBuffers.delete(id)
          // Clean up output file
          try { fs.unlinkSync(path.join(OUTPUT_DIR, `${id}.log`)) } catch { /* ignore */ }
          persistTerminalSessions()
          for (const win of BrowserWindow.getAllWindows()) {
            try {
              if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send(IPC_CHANNELS.TERMINAL_CLOSE, { id, exitCode, signal })
              }
            } catch { /* render frame disposed — ignore */ }
          }
        }),
      )

      return { id, pid: pty.pid }
    },
  )

  ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_event, { id, data }: { id: string; data: string }) => {
    const terminal = terminals.get(id)
    if (terminal) {
      terminal.pty.write(data)
    }
  })

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_RESIZE,
    (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      const terminal = terminals.get(id)
      if (terminal) {
        terminal.pty.resize(cols, rows)
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CHECK_BUSY, async (_event, { id }: { id: string }): Promise<boolean> => {
    const terminal = terminals.get(id)
    if (!terminal) return false
    const pid = terminal.pty.pid
    try {
      if (IS_WIN) {
        const { stdout } = await execFileAsync('wmic', ['process', 'where', `ParentProcessId=${pid}`, 'get', 'ProcessId'], { timeout: 3000 })
        // wmic output has header + data lines; more than just header means children exist
        const lines = stdout.trim().split('\n').filter((l: string) => l.trim().length > 0)
        return lines.length > 1
      }
      // macOS / Linux: pgrep returns 0 if child processes found
      await execFileAsync('pgrep', ['-P', String(pid)], { timeout: 3000 })
      return true
    } catch {
      // pgrep exits 1 when no children found, or command failed
      return false
    }
  })

  ipcMain.on(IPC_CHANNELS.TERMINAL_UPDATE_LABEL, (_event, { id, label }: { id: string; label: string }) => {
    updateTerminalLabel(id, label)
  })

  ipcMain.on(IPC_CHANNELS.TERMINAL_SET_TASK_INFO, (_event, { tabId, taskId, ticketNumber }: { tabId: string; taskId: string; ticketNumber: string }) => {
    setTerminalTaskInfo(tabId, taskId, ticketNumber)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_OUTPUT, async (_event, { id }: { id: string }): Promise<string> => {
    return getTerminalOutput(id)
  })

  // Start input queue polling for companion relay and periodic session persistence
  startInputQueuePolling()
  startSessionPersistInterval()

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CLOSE, async (_event, { id }: { id: string }) => {
    const terminal = terminals.get(id)
    if (terminal) {
      terminals.delete(id)
      persistTerminalSessions()
      disposeTerminal(terminal)
      // Notify renderer manually since onExit won't fire after dispose
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.TERMINAL_CLOSE, { id, exitCode: 0, signal: 0 })
          }
        } catch { /* render frame disposed — ignore */ }
      }
    }
  })
}

export function cleanupTerminals(): void {
  stopInputQueuePolling()
  for (const [, terminal] of terminals) {
    disposeTerminal(terminal)
  }
  terminals.clear()
  outputBuffers.clear()
  persistTerminalSessions()
}
