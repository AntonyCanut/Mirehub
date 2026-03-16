import type { IpcMain, BrowserWindow } from 'electron'
import crypto from 'crypto'
import http from 'http'
import { IPC_CHANNELS } from '../../shared/types'
import { startCompanionServer, stopCompanionServer, getCompanionServerInfo } from '../services/companion-server'

const API_HOST = process.env['KANBAI_API_HOST'] ?? 'localhost'
const API_PORT = parseInt(process.env['KANBAI_API_PORT'] ?? '3847', 10)

let currentToken: string | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function apiRequest<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const req = http.request({ hostname: API_HOST, port: API_PORT, path, method, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw}`))
          return
        }
        if (!raw || res.statusCode === 204) {
          resolve(null as T)
          return
        }
        try {
          resolve(JSON.parse(raw) as T)
        } catch {
          reject(new Error(`Invalid JSON: ${raw}`))
        }
      })
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(code: string, getWindow: () => BrowserWindow | null): void {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const status = await apiRequest<{ status: string; companionId?: string; companionName?: string }>(
        'GET',
        `/api/v1/pair/status/${code}`,
      )
      const win = getWindow()
      if (!win || win.isDestroyed()) return

      if (status.status === 'connected') {
        stopPolling()
        // Start data server for companion data retrieval
        if (currentToken) {
          startCompanionServer(currentToken)
            .then((info) => {
              win.webContents.send(IPC_CHANNELS.COMPANION_DATA_INFO, info)
            })
            .catch((err) => {
              console.error('[Companion] Failed to start data server:', err)
            })
        }
        win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'connected', status.companionName ?? null)
      } else if (status.status === 'expired') {
        stopPolling()
        stopCompanionServer()
        currentToken = null
        win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'disconnected')
      }
    } catch {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'lost')
      }
    }
  }, 2000)
}

export function registerCompanionHandlers(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.COMPANION_REGISTER, async (_event, workspaceId: string) => {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()

    const result = await apiRequest<{ sessionId: string; token: string }>(
      'POST',
      '/api/v1/pair/register',
      { code, appId: 'kanbai-desktop', workspaceId },
    )

    currentToken = result.token
    startPolling(code, getWindow)

    return { code }
  })

  ipcMain.handle(IPC_CHANNELS.COMPANION_CANCEL, async () => {
    stopPolling()
    stopCompanionServer()
    if (currentToken) {
      try {
        await apiRequest<unknown>('DELETE', '/api/v1/pair/unregister', undefined, currentToken)
      } catch {
        // Best effort — session may already be expired
      }
    }
    currentToken = null
  })

  // No-op: sync is handled automatically via shared kanban.json file
  ipcMain.handle(IPC_CHANNELS.COMPANION_SYNC_TICKETS, async () => {})

  ipcMain.handle(IPC_CHANNELS.COMPANION_DATA_INFO, () => {
    return getCompanionServerInfo()
  })

  ipcMain.handle(IPC_CHANNELS.COMPANION_DISCONNECT, async () => {
    stopPolling()
    stopCompanionServer()
    if (currentToken) {
      try {
        await apiRequest<unknown>('DELETE', '/api/v1/pair/unregister', undefined, currentToken)
      } catch {
        // Best effort — session may already be expired
      }
    }
    currentToken = null
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'disconnected')
    }
  })
}

export async function initDevCompanion(getWindow: () => BrowserWindow | null): Promise<void> {
  const devCode = process.env['KANBAI_DEV_CODE']
  if (!devCode) return

  const devWorkspace = process.env['KANBAI_DEV_WORKSPACE'] ?? 'default'

  try {
    const result = await apiRequest<{ sessionId: string; token: string }>(
      'POST',
      '/api/v1/pair/register',
      { code: devCode, appId: 'kanbai-desktop', workspaceId: devWorkspace },
    )
    currentToken = result.token
    startPolling(devCode, getWindow)
    // Notify renderer of waiting state after a short delay (window may not be ready yet)
    setTimeout(() => {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'waiting')
      }
    }, 2000)
    console.log(`[DEV] Registered pairing code: ${devCode} — waiting for companion`)
  } catch (err) {
    console.log(`[DEV] Companion registration failed (API not running?): ${(err as Error).message}`)
    setTimeout(() => {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.COMPANION_STATUS_CHANGED, 'maintenance')
      }
    }, 2000)
  }
}

export function cleanupCompanion(): void {
  stopPolling()
  stopCompanionServer()
  if (currentToken) {
    // Best-effort cleanup on quit — fire and forget
    try {
      apiRequest<unknown>('DELETE', '/api/v1/pair/unregister', undefined, currentToken).catch(() => {})
    } catch {
      // Ignore
    }
  }
  currentToken = null
}
