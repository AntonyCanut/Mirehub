import type { KanbanTask, KanbanTaskType, WorktreeEntry } from '../../../shared/types/index'
import { useWorkspaceStore } from '../workspace/workspace-store'
import { useI18n } from '../../lib/i18n'
import { pushNotification } from '../../shared/stores/notification-store'

export const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export const TYPE_PREFIX: Record<KanbanTaskType, string> = {
  bug: 'B', feature: 'F', test: 'T', doc: 'D', ia: 'A', refactor: 'R',
}

export function formatTicketLabel(task: KanbanTask): string {
  if (task.ticketNumber == null) return task.title
  const prefix = task.isPrequalifying ? 'T' : TYPE_PREFIX[task.type ?? 'feature']
  return `${prefix}-${String(task.ticketNumber).padStart(2, '0')}`
}

// Track tasks that have been re-launched once to avoid infinite loops
export const relaunchedTaskIds = new Set<string>()

// Track tasks currently being reactivated to prevent duplicate updates
export const reactivatingTaskIds = new Set<string>()

// Track tasks currently being launched to prevent duplicate sendToAi calls
export const launchingTaskIds = new Set<string>()

/** Derive the git repo root from a worktree path (removes /.kanbai-worktrees/{id}). */
export function repoPathFromWorktree(worktreePath: string): string {
  const worktreesDir = '/.kanbai-worktrees/'
  const idx = worktreePath.lastIndexOf(worktreesDir)
  if (idx === -1) return worktreePath
  return worktreePath.slice(0, idx)
}

/**
 * Auto-merge a completed task's worktree branch into the working branch,
 * then remove the worktree and delete the branch.
 * Uses worktreeBaseBranch to merge into the branch that was active at worktree creation.
 * Always runs when the task has worktree info — merge is mandatory when worktrees are used.
 *
 * On merge conflict: aborts the merge, preserves the worktree and branch,
 * sets the task to PENDING with conflict details, and notifies the user.
 */
export async function autoMergeWorktree(
  task: KanbanTask,
  workspaceId: string,
): Promise<void> {
  if (!task.worktreePath || !task.worktreeBranch) return
  try {
    const repoPath = repoPathFromWorktree(task.worktreePath)
    const ticketLabel = formatTicketLabel(task)
    const result = await window.kanbai.git.worktreeMergeAndCleanup(
      repoPath,
      task.worktreePath,
      task.worktreeBranch,
      ticketLabel,
      task.worktreeBaseBranch,
    )
    if (result?.success) {
      // Mark the matching worktreeHistory entry as merged
      const updatedHistory = markWorktreeEntryMerged(task.worktreeHistory, task.worktreeBranch!)
      await window.kanbai.kanban.update({
        id: task.id,
        workspaceId,
        ...(updatedHistory ? { worktreeHistory: updatedHistory } : {}),
      }).catch(() => { /* best-effort */ })

      if (task.worktreeEnvPath) {
        const workspace = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId)
        if (workspace) {
          const worktreeId = task.id.slice(0, 8)
          await window.kanbai.workspaceEnv.delete(workspace.name, worktreeId).catch(() => { /* best-effort */ })
        }
      }
    }
    if (!result?.success) {
      if (result?.conflict) {
        const conflictFiles: string[] = result.conflictFiles ?? []
        const t = useI18n.getState().t
        const wsName = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId)?.name ?? ''
        const conflictSummary = conflictFiles.length <= 5
          ? conflictFiles.join(', ')
          : `${conflictFiles.slice(0, 5).join(', ')} (+${conflictFiles.length - 5})`

        pushNotification(
          'warning',
          wsName,
          t('notifications.mergeConflict', {
            ticket: ticketLabel,
            branch: task.worktreeBranch,
            target: result.targetBranch ?? task.worktreeBaseBranch ?? 'main',
            files: conflictSummary,
            count: conflictFiles.length,
          }),
          { workspaceId },
        )

        const conflictQuestion = t('notifications.mergeConflictQuestion', {
          branch: task.worktreeBranch,
          target: result.targetBranch ?? task.worktreeBaseBranch ?? 'main',
          files: conflictFiles.join('\n  - '),
        })

        await window.kanbai.kanban.update({
          id: task.id,
          workspaceId,
          status: 'PENDING',
          question: conflictQuestion,
        }).catch(() => { /* best-effort */ })

        return
      }
      console.warn(`Auto-merge failed for ${ticketLabel}:`, result?.error)
    }
  } catch {
    // Auto-merge is best-effort — do not block task completion
  }
}

/** Mark a specific branch entry as merged in the worktreeHistory array. */
function markWorktreeEntryMerged(history: WorktreeEntry[] | undefined, branch: string): WorktreeEntry[] | undefined {
  if (!history?.length) return undefined
  return history.map((e) => e.branch === branch && !e.merged ? { ...e, merged: true } : e)
}

/** Check if any worktreeHistory entry is not yet merged. */
export function hasUnmergedWorktreeEntries(task: KanbanTask): boolean {
  if (!task.worktreeHistory?.length) {
    // Fallback for tasks without worktreeHistory (legacy) — check current worktree
    return !!(task.worktreeBranch && task.worktreePath)
  }
  return task.worktreeHistory.some((e) => !e.merged)
}

/**
 * Verify that DONE tasks with worktree info have actually been merged.
 * Checks both legacy single-worktree fields and the new worktreeHistory array.
 * For any unmerged entry, retries the merge. This catches cases where
 * the auto-merge was skipped (race condition, lock, process exit, etc.).
 */
export async function verifyAndRetryWorktreeMerges(
  tasks: KanbanTask[],
  workspaceId: string,
): Promise<void> {
  try {
    // Find DONE tasks that have unmerged worktree entries
    const unmergedDone = tasks.filter(
      (t) => t.status === 'DONE' && hasUnmergedWorktreeEntries(t),
    )
    if (unmergedDone.length === 0) return

    for (const task of unmergedDone) {
      try {
        if (task.worktreeHistory?.length) {
          // Check each unmerged entry in the history
          let historyChanged = false
          const updatedHistory = [...task.worktreeHistory]
          for (let i = 0; i < updatedHistory.length; i++) {
            const entry = updatedHistory[i]!
            if (entry.merged) continue
            const repoPath = repoPathFromWorktree(entry.worktreePath)
            try {
              const isMerged = await window.kanbai.git.branchIsMerged(repoPath, entry.branch)
              if (isMerged) {
                updatedHistory[i] = { ...entry, merged: true }
                historyChanged = true
                // Cleanup leftover worktree and branch
                await window.kanbai.git.worktreeRemove(repoPath, entry.worktreePath, true).catch(() => { /* best-effort */ })
                await window.kanbai.git.deleteBranch(repoPath, entry.branch).catch(() => { /* best-effort */ })
              } else {
                // Branch not merged — retry using the current worktree fields if they match
                if (task.worktreePath === entry.worktreePath) {
                  await autoMergeWorktree(task, workspaceId)
                }
              }
            } catch {
              // Per-entry verification is best-effort
            }
          }
          if (historyChanged) {
            await window.kanbai.kanban.update({
              id: task.id,
              workspaceId,
              worktreeHistory: updatedHistory,
            }).catch(() => { /* best-effort */ })
          }
        } else {
          // Legacy task without worktreeHistory — use single worktree fields
          const repoPath = repoPathFromWorktree(task.worktreePath!)
          const isMerged = await window.kanbai.git.branchIsMerged(repoPath, task.worktreeBranch!)
          if (isMerged) {
            await window.kanbai.git.worktreeRemove(repoPath, task.worktreePath!, true).catch(() => { /* best-effort */ })
            await window.kanbai.git.deleteBranch(repoPath, task.worktreeBranch!).catch(() => { /* best-effort */ })
          } else {
            await autoMergeWorktree(task, workspaceId)
          }
        }
      } catch {
        // Per-task verification is best-effort — continue with others
      }
    }
  } catch {
    // Global verification failure — do not block startup
  }
}

export function pickNextTask(tasks: KanbanTask[]): KanbanTask | null {
  const todo = tasks.filter((t) => t.status === 'TODO' && !t.disabled && !t.isPrequalifying && !launchingTaskIds.has(t.id))
  if (!todo.length) return null
  todo.sort((a, b) => {
    // CTO tickets always go last — they should never block regular tickets
    const aCto = a.isCtoTicket ? 1 : 0
    const bCto = b.isCtoTicket ? 1 : 0
    if (aCto !== bCto) return aCto - bCto
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    return a.createdAt - b.createdAt
  })
  return todo[0]!
}

/**
 * Returns the number of available slots for launching new tasks.
 * 0 means no room (or paused). >0 means that many tasks can be launched.
 */
export async function availableSlots(tasks: KanbanTask[], workspaceId: string): Promise<number> {
  let maxConcurrent = 1
  try {
    const kanbanConfig = await window.kanbai.kanban.getConfig(workspaceId)
    if (kanbanConfig?.paused) return 0
    if (kanbanConfig?.useWorktrees && kanbanConfig.maxConcurrentWorktrees > 1) {
      maxConcurrent = kanbanConfig.maxConcurrentWorktrees
    }
  } catch { /* default to 1 */ }
  const workingCount = tasks.filter((t) => t.status === 'WORKING').length + launchingTaskIds.size
  return Math.max(0, maxConcurrent - workingCount)
}

export function isChildOfCto(task: KanbanTask, tasks: KanbanTask[]): boolean {
  if (!task.parentTicketId) return false
  const parent = tasks.find((t) => t.id === task.parentTicketId)
  return parent?.isCtoTicket ?? false
}
