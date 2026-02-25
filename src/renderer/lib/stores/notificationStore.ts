import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: number
  read: boolean
  autoDismissMs: number
}

interface NotificationState {
  notifications: AppNotification[]
  toasts: AppNotification[]
}

interface NotificationActions {
  addNotification: (type: NotificationType, title: string, body: string, autoDismissMs?: number) => void
  dismissToast: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
}

type NotificationStore = NotificationState & NotificationActions

const MAX_NOTIFICATIONS = 50
const MAX_TOASTS = 3
const DEFAULT_DISMISS_MS = 5000

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  toasts: [],

  addNotification: (type, title, body, autoDismissMs = DEFAULT_DISMISS_MS) => {
    const id = crypto.randomUUID()
    const notification: AppNotification = {
      id,
      type,
      title,
      body,
      createdAt: Date.now(),
      read: false,
      autoDismissMs,
    }

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
      toasts: [notification, ...state.toasts].slice(0, MAX_TOASTS),
    }))

    // Auto-dismiss toast
    setTimeout(() => {
      get().dismissToast(id)
    }, autoDismissMs)
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }))
  },

  clearAll: () => {
    set({ notifications: [], toasts: [] })
  },
}))

/** Standalone helper — callable from other stores without circular deps */
export function pushNotification(type: NotificationType, title: string, body: string) {
  useNotificationStore.getState().addNotification(type, title, body)
}
