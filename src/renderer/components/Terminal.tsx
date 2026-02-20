import React, { useRef, useEffect, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import '../styles/terminal.css'

interface TerminalProps {
  cwd?: string
  shell?: string
  initialCommand?: string | null
  isVisible: boolean
  onActivity?: () => void
  onClose?: () => void
  onSessionCreated?: (sessionId: string) => void
}

export function Terminal({ cwd, shell, initialCommand, isVisible, onActivity, onClose, onSessionCreated }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const cleanupDataRef = useRef<(() => void) | null>(null)
  const cleanupCloseRef = useRef<(() => void) | null>(null)
  const isVisibleRef = useRef(isVisible)
  const onActivityRef = useRef(onActivity)
  const onCloseRef = useRef(onClose)
  const onSessionCreatedRef = useRef(onSessionCreated)

  isVisibleRef.current = isVisible
  onActivityRef.current = onActivity
  onCloseRef.current = onClose
  onSessionCreatedRef.current = onSessionCreated

  const fitTerminal = useCallback(() => {
    const fitAddon = fitAddonRef.current
    const xterm = xtermRef.current
    const sessionId = sessionIdRef.current
    if (!fitAddon || !xterm) return

    try {
      fitAddon.fit()
      if (sessionId) {
        window.theone.terminal.resize(sessionId, xterm.cols, xterm.rows)
      }
    } catch {
      // Ignore fit errors when terminal is not yet visible
    }
  }, [])

  // Refit when visibility changes
  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => fitTerminal())
    }
  }, [isVisible, fitTerminal])

  useEffect(() => {
    if (!containerRef.current) return

    const xterm = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#45475a80',
        selectionForeground: '#cdd6f4',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    xterm.loadAddon(fitAddon)
    xterm.loadAddon(searchAddon)
    xterm.loadAddon(webLinksAddon)

    // Try loading WebGL addon, fall back to canvas
    import('@xterm/addon-webgl')
      .then(({ WebglAddon }) => {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => {
          webglAddon.dispose()
        })
        xterm.loadAddon(webglAddon)
      })
      .catch(() => {
        // WebGL not available, canvas2D renderer is the default fallback
      })

    xterm.open(containerRef.current)
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Fit after opening
    requestAnimationFrame(() => fitTerminal())

    // Handle user keyboard input
    xterm.onData((data: string) => {
      if (sessionIdRef.current) {
        window.theone.terminal.write(sessionIdRef.current, data)
      }
    })

    // Create PTY session
    window.theone.terminal.create({ cwd, shell }).then(
      (result: { id: string; pid: number }) => {
        sessionIdRef.current = result.id
        onSessionCreatedRef.current?.(result.id)

        // Listen for data from PTY
        const unsubData = window.theone.terminal.onData(
          (payload: { id: string; data: string }) => {
            if (payload.id === sessionIdRef.current) {
              xterm.write(payload.data)
              if (!isVisibleRef.current) {
                onActivityRef.current?.()
              }
            }
          },
        )
        cleanupDataRef.current = unsubData

        // Listen for PTY close
        const unsubClose = window.theone.terminal.onClose(
          (payload: { id: string; exitCode: number; signal: number }) => {
            if (payload.id === sessionIdRef.current) {
              xterm.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
              sessionIdRef.current = null
              onCloseRef.current?.()
            }
          },
        )
        cleanupCloseRef.current = unsubClose

        // Send initial resize
        fitTerminal()

        // Execute initial command if provided (e.g., 'claude' for Claude tabs)
        if (initialCommand) {
          window.theone.terminal.write(result.id, `${initialCommand}\n`)
        }
      },
    )

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitTerminal())
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      cleanupDataRef.current?.()
      cleanupCloseRef.current?.()
      if (sessionIdRef.current) {
        window.theone.terminal.close(sessionIdRef.current)
      }
      xterm.dispose()
    }
  }, [cwd, shell, initialCommand, fitTerminal])

  // Focus the terminal when it becomes visible
  useEffect(() => {
    if (isVisible && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ display: isVisible ? 'block' : 'none' }}
    />
  )
}
