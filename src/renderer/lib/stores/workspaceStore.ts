import { create } from 'zustand'
import type { Workspace, Project } from '../../../shared/types/index'
import { useTerminalTabStore } from './terminalTabStore'

interface WorkspaceState {
  workspaces: Workspace[]
  projects: Project[]
  activeWorkspaceId: string | null
  activeProjectId: string | null
  initialized: boolean
  pendingClaudeImport: string | null
}

interface WorkspaceActions {
  init: () => Promise<void>
  loadWorkspaces: () => Promise<void>
  createWorkspace: (name: string, color?: string) => Promise<Workspace | null>
  createWorkspaceFromFolder: () => Promise<Workspace | null>
  deleteWorkspace: (id: string) => Promise<void>
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>
  addProject: (workspaceId: string) => Promise<Project | null>
  removeProject: (id: string) => Promise<void>
  moveProject: (projectId: string, targetWorkspaceId: string) => Promise<void>
  rescanClaude: (projectId: string) => Promise<void>
  rescanAllClaude: () => Promise<void>
  setupWorkspaceEnv: (workspaceId: string) => Promise<string | null>
  setActiveWorkspace: (id: string | null) => void
  setActiveProject: (id: string | null) => void
  navigateWorkspace: (direction: 'next' | 'prev') => void
  clearPendingClaudeImport: () => void
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

/**
 * Get the working directory for a workspace.
 * If multiple projects: use the virtual env (symlinks).
 * If single project: use its path directly.
 */
async function getWorkspaceCwd(workspaceId: string, projects: Project[]): Promise<string> {
  const workspaceProjects = projects.filter((p) => p.workspaceId === workspaceId)
  if (workspaceProjects.length <= 1) {
    return workspaceProjects[0]?.path ?? '~'
  }
  // Multiple projects: setup and use virtual env
  const paths = workspaceProjects.map((p) => p.path)
  const result = await window.theone.workspaceEnv.setup(workspaceId, paths)
  if (result?.success && result.envPath) {
    return result.envPath
  }
  // Fallback to first project
  return workspaceProjects[0]?.path ?? '~'
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  projects: [],
  activeWorkspaceId: null,
  activeProjectId: null,
  initialized: false,
  pendingClaudeImport: null,

  init: async () => {
    if (get().initialized) return
    await get().loadWorkspaces()
    set({ initialized: true })
    // Scan all projects for .claude folders after init
    get().rescanAllClaude()
  },

  loadWorkspaces: async () => {
    const workspaces: Workspace[] = await window.theone.workspace.list()
    const projects: Project[] = await window.theone.project.list()
    set({ workspaces, projects })
  },

  createWorkspace: async (name: string, color?: string) => {
    const workspace = await window.theone.workspace.create({
      name,
      color: color ?? '#89b4fa',
    })
    if (workspace) {
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
      }))
    }
    return workspace
  },

  createWorkspaceFromFolder: async () => {
    try {
      const dirPath = await window.theone.project.selectDir()
      if (!dirPath) return null

      const folderName = dirPath.split('/').pop() || dirPath
      const workspace = await window.theone.workspace.create({
        name: folderName,
        color: '#89b4fa',
      })
      if (!workspace) return null

      set((state) => ({
        workspaces: [...state.workspaces, workspace],
      }))

      // Init .workspaces directory for local project data
      try {
        await window.theone.workspaceDir.init(dirPath)
      } catch {
        // Non-blocking
      }

      // Automatically add the selected folder as a project
      const project: Project = await window.theone.project.add({
        workspaceId: workspace.id,
        path: dirPath,
      })

      if (project) {
        try {
          const scanResult = await window.theone.project.scanClaude(dirPath)
          if (scanResult?.hasClaude) {
            project.hasClaude = true
          }
        } catch {
          // Scan failure is non-blocking
        }

        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          activeWorkspaceId: workspace.id,
          workspaces: state.workspaces.map((w) =>
            w.id === workspace.id ? { ...w, projectIds: [...w.projectIds, project.id] } : w,
          ),
        }))

        // Create a single split tab: Claude (left) + Terminal (right)
        const termStore = useTerminalTabStore.getState()
        termStore.createSplitTab(workspace.id, dirPath, 'Claude + Terminal', 'claude', null)

        // Setup workspace env
        await get().setupWorkspaceEnv(workspace.id)
      } else {
        set({ activeWorkspaceId: workspace.id })
      }

      return workspace
    } catch (err) {
      console.error('Failed to create workspace:', err)
      return null
    }
  },

  deleteWorkspace: async (id: string) => {
    await window.theone.workspace.delete(id)
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      projects: state.projects.filter((p) => p.workspaceId !== id),
      activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
    }))
  },

  updateWorkspace: async (id: string, data: Partial<Workspace>) => {
    await window.theone.workspace.update({ id, ...data })
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }))
  },

  addProject: async (workspaceId: string) => {
    const dirPath = await window.theone.project.selectDir()
    if (!dirPath) return null

    const project: Project = await window.theone.project.add({
      workspaceId,
      path: dirPath,
    })

    if (project) {
      // Scan for .claude folder after adding the project
      try {
        const scanResult = await window.theone.project.scanClaude(dirPath)
        if (scanResult?.hasClaude) {
          project.hasClaude = true
        }
      } catch {
        // Scan failure is non-blocking
      }

      set((state) => ({
        projects: [...state.projects, project],
        workspaces: state.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, projectIds: [...w.projectIds, project.id] } : w,
        ),
        pendingClaudeImport: !project.hasClaude ? project.id : state.pendingClaudeImport,
      }))

      // Rebuild workspace env if there are now multiple projects
      const { projects } = get()
      const workspaceProjects = projects.filter((p) => p.workspaceId === workspaceId)
      if (workspaceProjects.length > 1) {
        await get().setupWorkspaceEnv(workspaceId)
      }
    }

    return project
  },

  removeProject: async (id: string) => {
    const project = get().projects.find((p) => p.id === id)
    await window.theone.project.remove(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      workspaces: state.workspaces.map((w) =>
        w.id === project?.workspaceId
          ? { ...w, projectIds: w.projectIds.filter((pid) => pid !== id) }
          : w,
      ),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }))

    // Rebuild workspace env after removing a project
    if (project?.workspaceId) {
      await get().setupWorkspaceEnv(project.workspaceId)
    }
  },

  moveProject: async (projectId: string, targetWorkspaceId: string) => {
    const project = get().projects.find((p) => p.id === projectId)
    if (!project || project.workspaceId === targetWorkspaceId) return

    const sourceWorkspaceId = project.workspaceId

    // Remove from source workspace, add to target workspace
    await window.theone.project.remove(projectId)
    const newProject = await window.theone.project.add({
      workspaceId: targetWorkspaceId,
      path: project.path,
    })

    if (newProject) {
      set((state) => ({
        projects: state.projects
          .filter((p) => p.id !== projectId)
          .concat(newProject),
        workspaces: state.workspaces.map((w) => {
          if (w.id === sourceWorkspaceId) {
            return { ...w, projectIds: w.projectIds.filter((pid) => pid !== projectId) }
          }
          if (w.id === targetWorkspaceId) {
            return { ...w, projectIds: [...w.projectIds, newProject.id] }
          }
          return w
        }),
      }))

      // Rebuild envs for both workspaces
      await Promise.all([
        get().setupWorkspaceEnv(sourceWorkspaceId),
        get().setupWorkspaceEnv(targetWorkspaceId),
      ])
    }
  },

  rescanClaude: async (projectId: string) => {
    const project = get().projects.find((p) => p.id === projectId)
    if (!project) return
    try {
      const result = await window.theone.project.scanClaude(project.path)
      const hasClaude = result?.hasClaude ?? false
      if (hasClaude !== project.hasClaude) {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, hasClaude } : p,
          ),
        }))
      }
    } catch {
      // Scan failure is non-blocking
    }
  },

  rescanAllClaude: async () => {
    const projects = get().projects
    if (!projects || projects.length === 0) return
    const updates: Array<{ id: string; hasClaude: boolean }> = []
    await Promise.allSettled(
      projects.map(async (p) => {
        try {
          const result = await window.theone.project.scanClaude(p.path)
          const hasClaude = result?.hasClaude ?? false
          if (hasClaude !== p.hasClaude) {
            updates.push({ id: p.id, hasClaude })
          }
        } catch {
          // Scan failure is non-blocking
        }
      }),
    )
    if (updates.length > 0) {
      set((state) => ({
        projects: state.projects.map((p) => {
          const update = updates.find((u) => u.id === p.id)
          return update ? { ...p, hasClaude: update.hasClaude } : p
        }),
      }))
    }
  },

  setupWorkspaceEnv: async (workspaceId: string) => {
    const { projects } = get()
    const workspaceProjects = projects.filter((p) => p.workspaceId === workspaceId)
    if (workspaceProjects.length <= 1) return null
    const paths = workspaceProjects.map((p) => p.path)
    const result = await window.theone.workspaceEnv.setup(workspaceId, paths)
    return result?.envPath ?? null
  },

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id })

    if (id) {
      // Auto-select the first project in this workspace
      const { projects } = get()
      const workspaceProjects = projects.filter((p) => p.workspaceId === id)
      if (workspaceProjects.length > 0) {
        const firstProject = workspaceProjects[0]!
        set({ activeProjectId: firstProject.id })

        const termStore = useTerminalTabStore.getState()
        const workspaceTabs = termStore.tabs.filter((t) => t.workspaceId === id)
        if (workspaceTabs.length === 0) {
          // Auto-create split tab (Claude + Terminal) if none exist for this workspace
          // Use workspace env for multi-project workspaces
          getWorkspaceCwd(id, projects)
            .then((cwd) => {
              termStore.createSplitTab(id, cwd, 'Claude + Terminal', 'claude', null)
            })
            .catch((err) => {
              console.error('Failed to get workspace cwd:', err)
              // Fallback to first project path
              termStore.createSplitTab(id, firstProject.path, 'Claude + Terminal', 'claude', null)
            })
        } else {
          // Activate the first tab of this workspace so content is displayed
          termStore.activateFirstInWorkspace(id)
        }
      }
    }
  },
  setActiveProject: (id: string | null) => set({ activeProjectId: id }),

  clearPendingClaudeImport: () => set({ pendingClaudeImport: null }),

  navigateWorkspace: (direction: 'next' | 'prev') => {
    const { workspaces, activeWorkspaceId } = get()
    if (workspaces.length === 0) return

    const currentIndex = activeWorkspaceId
      ? workspaces.findIndex((w) => w.id === activeWorkspaceId)
      : -1

    let nextIndex: number
    if (direction === 'next') {
      nextIndex = currentIndex + 1 >= workspaces.length ? 0 : currentIndex + 1
    } else {
      nextIndex = currentIndex - 1 < 0 ? workspaces.length - 1 : currentIndex - 1
    }

    const nextWorkspace = workspaces[nextIndex]
    if (nextWorkspace) {
      set({ activeWorkspaceId: nextWorkspace.id })
    }
  },
}))
