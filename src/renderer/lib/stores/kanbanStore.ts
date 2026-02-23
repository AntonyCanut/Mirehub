import { create } from 'zustand'
import type { KanbanTask, KanbanStatus } from '../../../shared/types/index'
import { useTerminalTabStore } from './terminalTabStore'
import { useWorkspaceStore } from './workspaceStore'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function pickNextTask(tasks: KanbanTask[]): KanbanTask | null {
  const todo = tasks.filter((t) => t.status === 'TODO')
  if (!todo.length) return null
  todo.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    return a.createdAt - b.createdAt
  })
  return todo[0]!
}

interface KanbanState {
  tasks: KanbanTask[]
  isLoading: boolean
  draggedTaskId: string | null
  currentWorkspaceId: string | null
  kanbanTabIds: Record<string, string>
}

interface KanbanActions {
  loadTasks: (workspaceId: string) => Promise<void>
  syncTasksFromFile: () => Promise<void>
  createTask: (
    workspaceId: string,
    title: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
    targetProjectId?: string,
  ) => Promise<void>
  updateTaskStatus: (taskId: string, status: KanbanStatus) => Promise<void>
  updateTask: (taskId: string, data: Partial<KanbanTask>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  duplicateTask: (task: KanbanTask) => Promise<void>
  setDragged: (taskId: string | null) => void
  getTasksByStatus: (status: KanbanStatus) => KanbanTask[]
  sendToClaude: (task: KanbanTask) => Promise<void>
  attachFiles: (taskId: string) => Promise<void>
  removeAttachment: (taskId: string, attachmentId: string) => Promise<void>
}

type KanbanStore = KanbanState & KanbanActions

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  draggedTaskId: null,
  currentWorkspaceId: null,
  kanbanTabIds: {},

  loadTasks: async (workspaceId: string) => {
    set({ isLoading: true, currentWorkspaceId: workspaceId })
    try {
      const tasks: KanbanTask[] = await window.mirehub.kanban.list(workspaceId)
      set({ tasks })

      // One-at-a-time scheduling: resume a WORKING without terminal, or pick next TODO
      const capturedWorkspaceId = workspaceId
      setTimeout(() => {
        // Guard against stale callbacks after workspace switch
        if (get().currentWorkspaceId !== capturedWorkspaceId) return

        const { kanbanTabIds } = get()

        // 1. Resume a WORKING task that lost its terminal (only one)
        const workingWithoutTerminal = tasks.find(
          (t) => t.status === 'WORKING' && !kanbanTabIds[t.id],
        )
        if (workingWithoutTerminal) {
          get().sendToClaude(workingWithoutTerminal)
          return
        }

        // 2. If no WORKING task at all, pick the next TODO by priority
        const hasWorking = tasks.some((t) => t.status === 'WORKING')
        if (!hasWorking) {
          const next = pickNextTask(tasks)
          if (next) get().sendToClaude(next)
        }
      }, 500)
    } finally {
      set({ isLoading: false })
    }
  },

  syncTasksFromFile: async () => {
    const { currentWorkspaceId, tasks: oldTasks, kanbanTabIds } = get()
    if (!currentWorkspaceId) return
    try {
      const newTasks: KanbanTask[] = await window.mirehub.kanban.list(currentWorkspaceId)

      let taskFinished = false

      // Detect status transitions for tasks with a terminal tab
      for (const newTask of newTasks) {
        const oldTask = oldTasks.find((t) => t.id === newTask.id)
        const tabId = kanbanTabIds[newTask.id]
        if (!oldTask || !tabId) continue
        if (oldTask.status === newTask.status) continue

        const termStore = useTerminalTabStore.getState()
        if (newTask.status === 'DONE') {
          termStore.setTabColor(tabId, '#a6e3a1')
          taskFinished = true
        }
        if (newTask.status === 'FAILED') {
          termStore.setTabColor(tabId, '#f38ba8')
          taskFinished = true
        }
        if (newTask.status === 'PENDING') {
          termStore.setTabColor(tabId, '#f9e2af')
          termStore.setTabActivity(tabId, true)
          // PENDING does NOT trigger next task — the task is still "in progress"
        }
      }

      set({ tasks: newTasks })

      // After a task finishes (DONE/FAILED), pick the next one with a delay
      if (taskFinished) {
        const hasWorking = newTasks.some((t) => t.status === 'WORKING')
        if (!hasWorking) {
          setTimeout(() => {
            const currentTasks = get().tasks
            const next = pickNextTask(currentTasks)
            if (next) get().sendToClaude(next)
          }, 1000)
        }
      }
    } catch { /* ignore sync errors */ }
  },

  createTask: async (workspaceId, title, description, priority, targetProjectId?) => {
    const task: KanbanTask = await window.mirehub.kanban.create({
      workspaceId,
      targetProjectId,
      title,
      description,
      status: 'TODO',
      priority,
    })
    set((state) => ({ tasks: [...state.tasks, task] }))

    // Auto-send only if no WORKING task exists (one-at-a-time)
    const hasWorking = get().tasks.some((t) => t.status === 'WORKING')
    if (!hasWorking) {
      // Pick by priority — the new task might not be highest priority
      const next = pickNextTask(get().tasks)
      if (next) get().sendToClaude(next)
    }
  },

  updateTaskStatus: async (taskId, status) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    await window.mirehub.kanban.update({ id: taskId, status, workspaceId: currentWorkspaceId })
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t)),
    }))
  },

  updateTask: async (taskId, data) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    await window.mirehub.kanban.update({ id: taskId, ...data, workspaceId: currentWorkspaceId })
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...data, updatedAt: Date.now() } : t)),
    }))
  },

  deleteTask: async (taskId) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    await window.mirehub.kanban.delete(taskId, currentWorkspaceId)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }))
  },

  duplicateTask: async (task) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    const newTask: KanbanTask = await window.mirehub.kanban.create({
      workspaceId: currentWorkspaceId,
      targetProjectId: task.targetProjectId,
      title: `Copy of ${task.title}`,
      description: task.description,
      status: 'TODO',
      priority: task.priority,
      labels: task.labels,
      dueDate: task.dueDate,
    })
    set((state) => ({ tasks: [...state.tasks, newTask] }))
  },

  setDragged: (taskId) => set({ draggedTaskId: taskId }),

  getTasksByStatus: (status) => {
    return get().tasks.filter((t) => t.status === status)
  },

  sendToClaude: async (task: KanbanTask) => {
    const { currentWorkspaceId, kanbanTabIds } = get()
    if (!currentWorkspaceId) return

    // If a tab already exists for this task, activate it and return
    const existingTabId = kanbanTabIds[task.id]
    if (existingTabId) {
      try {
        const termStore = useTerminalTabStore.getState()
        const tab = termStore.tabs.find((t) => t.id === existingTabId)
        if (tab) {
          termStore.setActiveTab(existingTabId)
          return
        }
        // Tab was closed — remove stale mapping and proceed
      } catch { /* proceed to create new tab */ }
    }

    // Determine cwd: if task targets a specific project, use its path; otherwise use workspace env
    const { projects, workspaces } = useWorkspaceStore.getState()
    let cwd: string | null = null
    if (task.targetProjectId) {
      const project = projects.find((p) => p.id === task.targetProjectId)
      if (project) cwd = project.path
    }
    if (!cwd) {
      // Use workspace env path or fallback to first project
      const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
      const workspaceProjects = projects.filter((p) => p.workspaceId === currentWorkspaceId)
      if (workspace && workspaceProjects.length > 0) {
        try {
          const envResult = await window.mirehub.workspaceEnv.setup(
            workspace.name,
            workspaceProjects.map((p) => p.path),
          )
          if (envResult?.success && envResult.envPath) {
            cwd = envResult.envPath
          }
        } catch { /* fallback below */ }
      }
      if (!cwd) {
        cwd = workspaceProjects[0]?.path ?? null
      }
    }
    if (!cwd) return

    // Get kanban file path via IPC
    let kanbanFilePath: string
    try {
      kanbanFilePath = await window.mirehub.kanban.getPath(currentWorkspaceId)
    } catch {
      kanbanFilePath = `~/.mirehub/kanban/${currentWorkspaceId}.json`
    }

    const promptParts = [
      `Tu travailles sur un ticket Kanban.`,
      ``,
      `## Ticket`,
      `- **ID**: ${task.id}`,
      `- **Titre**: ${task.title}`,
      task.description ? `- **Description**: ${task.description}` : null,
      `- **Priorite**: ${task.priority}`,
      task.targetProjectId ? `- **Scope**: Projet ${task.targetProjectId}` : `- **Scope**: Workspace entier`,
    ]

    // Add attachments section if any
    if (task.attachments && task.attachments.length > 0) {
      promptParts.push(``, `## Fichiers joints`, `Les fichiers suivants sont attaches a ce ticket. Lis-les pour du contexte.`)
      for (const att of task.attachments) {
        promptParts.push(`- **${att.filename}** (${att.mimeType}): \`${att.storedPath}\``)
      }
    }

    promptParts.push(
      ``,
      `## Fichier Kanban`,
      `Le fichier kanban se trouve a: ${kanbanFilePath}`,
      ``,
      `## Instructions`,
      `1. Realise la tache decrite ci-dessus dans le projet.`,
      `2. Quand tu as termine avec succes, edite le fichier \`${kanbanFilePath}\`:`,
      `   - Trouve le ticket avec l'id \`${task.id}\``,
      `   - Change son champ \`status\` de \`WORKING\` a \`DONE\``,
      `   - Ajoute un champ \`result\` avec un resume court de ce que tu as fait`,
      `   - Mets a jour \`updatedAt\` avec \`Date.now()\``,
      `3. Si tu as besoin de precisions de l'utilisateur:`,
      `   - Change le status a \`PENDING\``,
      `   - Ajoute un champ \`question\` expliquant ce que tu as besoin de savoir`,
      `4. Si tu ne peux pas realiser la tache, change le status a \`FAILED\` et ajoute un champ \`error\` expliquant pourquoi.`,
    )

    const prompt = promptParts.filter(Boolean).join('\n')

    // Write prompt to file — Claude will read it via a one-liner once initialized
    try {
      await window.mirehub.kanban.writePrompt(cwd, task.id, prompt)
    } catch (err) {
      console.error('Failed to write prompt file for task:', task.id, err)
      return
    }

    // Launch Claude interactively (profiles loaded, conversation visible)
    const initialCommand = `unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT && export MIREHUB_KANBAN_TASK_ID="${task.id}" MIREHUB_KANBAN_FILE="${kanbanFilePath}" && claude --dangerously-skip-permissions`

    // Create an interactive terminal tab for this task
    let tabId: string | null = null
    try {
      const termStore = useTerminalTabStore.getState()
      const { activeWorkspaceId } = useWorkspaceStore.getState()
      if (activeWorkspaceId) {
        tabId = termStore.createTab(activeWorkspaceId, cwd, `[IA] ${task.title}`, initialCommand)
        if (tabId) {
          termStore.setTabColor(tabId, '#fab387')
          set((state) => ({
            kanbanTabIds: { ...state.kanbanTabIds, [task.id]: tabId! },
          }))
        }
      }
    } catch {
      // Terminal tab creation is non-blocking
    }

    // Update local state to WORKING immediately (optimistic)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, status: 'WORKING' as KanbanStatus, updatedAt: Date.now() } : t)),
    }))

    // Persist WORKING status to file
    try {
      await window.mirehub.kanban.update({
        id: task.id,
        status: 'WORKING',
        workspaceId: currentWorkspaceId,
      })
    } catch { /* file update is best-effort */ }

    // Poll for the PTY session to be ready, then send the prompt to Claude
    if (tabId) {
      const capturedTabId = tabId
      const relativePromptPath = `.mirehub/.kanban-prompt-${task.id}.md`
      let pollAttempts = 0
      const pollInterval = setInterval(() => {
        pollAttempts++
        if (pollAttempts > 50) { // 10s max
          clearInterval(pollInterval)
          return
        }
        const tab = useTerminalTabStore.getState().tabs.find((t) => t.id === capturedTabId)
        if (!tab) {
          clearInterval(pollInterval)
          return
        }
        if (tab.paneTree.type === 'leaf' && tab.paneTree.sessionId) {
          clearInterval(pollInterval)
          const sessionId = tab.paneTree.sessionId
          // Wait for Claude to fully initialize before sending the prompt
          setTimeout(() => {
            // Send text first, then Enter separately (like a physical keypress)
            window.mirehub.terminal.write(sessionId, `Lis et execute les instructions du fichier ${relativePromptPath}`)
            setTimeout(() => {
              window.mirehub.terminal.write(sessionId, '\r')
            }, 100)
            // Cleanup prompt file after Claude has had time to read it
            setTimeout(() => {
              try {
                window.mirehub.kanban.cleanupPrompt(cwd!, task.id)
              } catch { /* best-effort */ }
            }, 30000)
          }, 3000)
        }
      }, 200)
    }
  },

  attachFiles: async (taskId: string) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    const filePaths = await window.mirehub.kanban.selectFiles()
    if (!filePaths || filePaths.length === 0) return

    for (const filePath of filePaths) {
      const attachment = await window.mirehub.kanban.attachFile(taskId, currentWorkspaceId, filePath)
      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t
          return { ...t, attachments: [...(t.attachments || []), attachment], updatedAt: Date.now() }
        }),
      }))
    }
  },

  removeAttachment: async (taskId: string, attachmentId: string) => {
    const { currentWorkspaceId } = get()
    if (!currentWorkspaceId) return
    await window.mirehub.kanban.removeAttachment(taskId, currentWorkspaceId, attachmentId)
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t
        return {
          ...t,
          attachments: (t.attachments || []).filter((a) => a.id !== attachmentId),
          updatedAt: Date.now(),
        }
      }),
    }))
  },
}))
