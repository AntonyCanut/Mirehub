import { IpcMain, BrowserWindow } from 'electron'
import { spawn, IPty } from 'node-pty'
import { v4 as uuid } from 'uuid'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { IPC_CHANNELS } from '../../shared/types'

interface ManagedTerminal {
  id: string
  pty: IPty
  cwd: string
}

const terminals = new Map<string, ManagedTerminal>()

/**
 * Ensure a custom ZDOTDIR with a .zshrc that initialises compinit
 * BEFORE sourcing the user's real ~/.zshrc. This prevents the
 * "command not found: compdef" error that occurs when completion
 * scripts call compdef before compinit has been loaded.
 */
function ensureZshWrapper(): string {
  const shellDir = path.join(os.homedir(), '.theone', 'shell')
  const wrapperPath = path.join(shellDir, '.zshrc')
  if (!fs.existsSync(shellDir)) {
    fs.mkdirSync(shellDir, { recursive: true })
  }
  const wrapperContent = [
    'autoload -Uz compinit && compinit -C',
    'ZDOTDIR="$HOME"',
    '[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"',
  ].join('\n')
  // Only write if missing or changed
  if (!fs.existsSync(wrapperPath) || fs.readFileSync(wrapperPath, 'utf-8') !== wrapperContent) {
    fs.writeFileSync(wrapperPath, wrapperContent, 'utf-8')
  }
  return shellDir
}

export function registerTerminalHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_event, options: { cwd?: string; shell?: string }) => {
      const id = uuid()
      const shell = options.shell || process.env.SHELL || '/bin/zsh'
      const cwd = options.cwd || os.homedir()

      // No -l for zsh (node-pty PTY makes it interactive; login shell causes compdef issues)
      // Keep -l for bash where it's needed for PATH setup
      const isZsh = shell.endsWith('/zsh')
      const shellArgs = shell.endsWith('/bash') ? ['-l'] : []

      // For zsh: use a custom ZDOTDIR that loads compinit before the user's .zshrc
      const shellEnv: Record<string, string> = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>

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

      const managed: ManagedTerminal = { id, pty, cwd }
      terminals.set(id, managed)

      // Forward output to renderer
      pty.onData((data: string) => {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data })
        }
      })

      pty.onExit(({ exitCode, signal }) => {
        terminals.delete(id)
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_CLOSE, { id, exitCode, signal })
        }
      })

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

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CLOSE, async (_event, { id }: { id: string }) => {
    const terminal = terminals.get(id)
    if (terminal) {
      terminal.pty.kill()
      terminals.delete(id)
    }
  })
}

export function cleanupTerminals(): void {
  for (const [id, terminal] of terminals) {
    terminal.pty.kill()
    terminals.delete(id)
  }
}
