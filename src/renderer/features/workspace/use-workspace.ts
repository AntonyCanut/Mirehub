import { useWorkspaceStore, useFilteredWorkspaces } from './workspace-store'

/**
 * Convenience hook for workspace feature.
 * Returns commonly used workspace state and actions.
 */
export function useWorkspace() {
  const {
    workspaces,
    projects,
    namespaces,
    activeNamespaceId,
    activeWorkspaceId,
    activeProjectId,
    initialized,
    init,
    setActiveWorkspace,
    setActiveProject,
    setActiveNamespace,
    createWorkspace,
    createWorkspaceFromPath,
    createWorkspaceFromNew,
    deleteWorkspace,
    updateWorkspace,
    addProject,
    removeProject,
    moveProject,
    navigateWorkspace,
    createNamespace,
    updateNamespace,
    deleteNamespace,
    refreshWorkspace,
    rescanClaude,
  } = useWorkspaceStore()

  const filteredWorkspaces = useFilteredWorkspaces()

  return {
    // State
    workspaces,
    filteredWorkspaces,
    projects,
    namespaces,
    activeNamespaceId,
    activeWorkspaceId,
    activeProjectId,
    initialized,

    // Actions
    init,
    setActiveWorkspace,
    setActiveProject,
    setActiveNamespace,
    createWorkspace,
    createWorkspaceFromPath,
    createWorkspaceFromNew,
    deleteWorkspace,
    updateWorkspace,
    addProject,
    removeProject,
    moveProject,
    navigateWorkspace,
    createNamespace,
    updateNamespace,
    deleteNamespace,
    refreshWorkspace,
    rescanClaude,
  }
}
