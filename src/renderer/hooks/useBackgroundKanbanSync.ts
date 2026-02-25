import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useKanbanStore } from '../lib/stores/kanbanStore'
import type { KanbanTask } from '../../shared/types/index'

/**
 * Global hook that monitors kanban files for non-active workspaces.
 * When a workspace has WORKING or TODO tasks and is not currently displayed,
 * this hook ensures file watchers + polling are active so that ticket
 * completions trigger automatic pickup of the next task.
 */
export function useBackgroundKanbanSync(): void {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const watchedRef = useRef<Set<string>>(new Set())
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const syncBackgroundWorkspace = useKanbanStore.getState().syncBackgroundWorkspace

    // Determine which workspaces need background monitoring
    async function refreshWatchList(): Promise<void> {
      // Seed backgroundTasks for all non-active workspaces by loading their kanban files.
      // This ensures workspaces that were never visited during this session are still monitored.
      const { workspaces } = useWorkspaceStore.getState()
      for (const ws of workspaces) {
        if (ws.id === activeWorkspaceId) continue
        if (ws.deletedAt) continue
        try {
          const tasks: KanbanTask[] = await window.mirehub.kanban.list(ws.id)
          useKanbanStore.setState((state) => ({
            backgroundTasks: { ...state.backgroundTasks, [ws.id]: tasks },
          }))
        } catch { /* best-effort */ }
      }

      const { backgroundTasks } = useKanbanStore.getState()
      const needed = new Set<string>()

      for (const [wsId, tasks] of Object.entries(backgroundTasks)) {
        if (wsId === activeWorkspaceId) continue
        const hasActive = tasks.some((t) => t.status === 'WORKING' || t.status === 'TODO')
        if (hasActive) needed.add(wsId)
      }

      // Add watchers for newly needed workspaces
      for (const wsId of needed) {
        if (!watchedRef.current.has(wsId)) {
          watchedRef.current.add(wsId)
          window.mirehub.kanban.watchAdd(wsId).catch(() => { /* best-effort */ })
          // Polling fallback every 30s
          const timer = setInterval(() => {
            syncBackgroundWorkspace(wsId)
          }, 30000)
          pollTimersRef.current.set(wsId, timer)
        }
      }

      // Remove watchers for workspaces no longer needed
      for (const wsId of watchedRef.current) {
        if (!needed.has(wsId) || wsId === activeWorkspaceId) {
          watchedRef.current.delete(wsId)
          window.mirehub.kanban.watchRemove(wsId).catch(() => { /* best-effort */ })
          const timer = pollTimersRef.current.get(wsId)
          if (timer) {
            clearInterval(timer)
            pollTimersRef.current.delete(wsId)
          }
        }
      }
    }

    // Listen for file change events from non-active workspaces
    const unsubscribe = window.mirehub.kanban.onFileChanged(({ workspaceId }) => {
      if (workspaceId !== activeWorkspaceId && watchedRef.current.has(workspaceId)) {
        syncBackgroundWorkspace(workspaceId)
      }
    })

    // Initial refresh + periodic refresh every 60s
    refreshWatchList()
    refreshTimerRef.current = setInterval(refreshWatchList, 60000)

    return () => {
      unsubscribe()
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      // Clean up all watchers and poll timers
      for (const wsId of watchedRef.current) {
        window.mirehub.kanban.watchRemove(wsId).catch(() => { /* best-effort */ })
      }
      watchedRef.current.clear()
      for (const timer of pollTimersRef.current.values()) {
        clearInterval(timer)
      }
      pollTimersRef.current.clear()
    }
  }, [activeWorkspaceId])
}
