import { vi } from 'vitest'

// Mock IpcMain that collects handlers for testing
export function createMockIpcMain() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const listeners = new Map<string, (...args: unknown[]) => unknown>()

  return {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      listeners.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    }),
    // Test helpers
    _handlers: handlers,
    _listeners: listeners,
    _invoke: async (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`No handler for channel: ${channel}`)
      return handler({}, ...args)
    },
    _emit: (channel: string, ...args: unknown[]) => {
      const listener = listeners.get(channel)
      if (!listener) throw new Error(`No listener for channel: ${channel}`)
      listener({}, ...args)
    },
  }
}

// Mock BrowserWindow
export function createMockBrowserWindow() {
  const webContents = {
    send: vi.fn(),
    openDevTools: vi.fn(),
  }

  return {
    webContents,
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
  }
}

// Mock dialog
export function createMockDialog() {
  return {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  }
}

// Mock Notification
export function createMockNotification() {
  return vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    on: vi.fn(),
  }))
}
