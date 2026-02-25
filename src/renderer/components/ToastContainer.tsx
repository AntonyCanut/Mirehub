import { useNotificationStore } from '../lib/stores/notificationStore'

const typeColors: Record<string, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--accent)',
}

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismissToast = useNotificationStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          style={{ borderLeftColor: typeColors[toast.type] || 'var(--accent)' }}
          onClick={() => dismissToast(toast.id)}
        >
          <div className="toast-content">
            <span className="toast-title">{toast.title}</span>
            <span className="toast-body">{toast.body}</span>
          </div>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); dismissToast(toast.id) }}>
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
