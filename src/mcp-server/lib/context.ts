import path from 'path'
import os from 'os'

export interface WorkspaceContext {
  workspaceId: string
  workspaceName: string
  kanbanDir: string
  analysisDir: string
  envsDir: string
  envPath: string
}

export function resolveWorkspaceContext(): WorkspaceContext {
  const workspaceId = process.env.MIREHUB_WORKSPACE_ID
  const workspaceName = process.env.MIREHUB_WORKSPACE_NAME

  if (!workspaceId) {
    throw new Error('MIREHUB_WORKSPACE_ID env var is required')
  }
  if (!workspaceName) {
    throw new Error('MIREHUB_WORKSPACE_NAME env var is required')
  }

  const home = os.homedir()
  const kanbanDir = path.join(home, '.mirehub', 'kanban')
  const analysisDir = path.join(home, '.mirehub', 'analysis')
  const envsDir = path.join(home, '.mirehub', 'envs')
  const sanitized = workspaceName.replace(/[/\\:*?"<>|]/g, '_')
  const envPath = path.join(envsDir, sanitized)

  return {
    workspaceId,
    workspaceName,
    kanbanDir,
    analysisDir,
    envsDir,
    envPath,
  }
}
