// Workspace and project types

export interface Namespace {
  id: string
  name: string
  color?: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface Workspace {
  id: string
  name: string
  icon?: string
  color: string
  namespaceId?: string
  projectIds: string[]
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface Project {
  id: string
  name: string
  path: string
  hasClaude: boolean
  hasGit?: boolean
  workspaceId: string
  createdAt: number
}

export interface WorkspaceExportData {
  name: string
  color: string
  icon?: string
  projectPaths: string[]
  exportedAt: number
}
