import fs from 'fs'
import os from 'os'
import path from 'path'
import type { DevOpsFile, DevOpsConnection } from '../../../shared/types'
import type { CompanionFeature, CompanionContext, CompanionResult, CompanionCommandDef } from '../../../shared/types/companion'
import {
  devopsListPipelines,
  devopsGetPipelineRuns,
  devopsRunPipeline,
  devopsGetBuildTimeline,
  devopsGetApprovals,
  devopsApprove,
  devopsGetBuildLog,
} from '../../ipc/devops'
import { StorageService } from '../../services/storage'

function resolveWorkspacePath(workspaceId: string): string | undefined {
  const storage = new StorageService()
  const workspace = storage.getWorkspace(workspaceId)
  if (!workspace) return undefined
  const sanitized = workspace.name.replace(/[/\\:*?"<>|]/g, '_')
  const envDir = path.join(os.homedir(), '.kanbai', 'envs', sanitized)
  return fs.existsSync(envDir) ? envDir : undefined
}

function loadDevOpsFile(workspacePath: string): DevOpsFile {
  const filePath = path.join(workspacePath, '.kanbai', 'devops.json')
  if (!fs.existsSync(filePath)) return { version: 1, connections: [] }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DevOpsFile
  } catch {
    return { version: 1, connections: [] }
  }
}

function findConnection(data: DevOpsFile, connectionId: string): DevOpsConnection | undefined {
  return data.connections.find((c) => c.id === connectionId)
}

export const devopsFeature: CompanionFeature = {
  id: 'devops',
  name: 'DevOps',
  workspaceScoped: true,
  projectScoped: false,

  async getState(ctx: CompanionContext): Promise<CompanionResult> {
    const workspacePath = resolveWorkspacePath(ctx.workspaceId)
    if (!workspacePath) return { success: true, data: [] }
    const data = loadDevOpsFile(workspacePath)
    return {
      success: true,
      data: data.connections.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider ?? 'azure-devops',
        organizationUrl: c.organizationUrl,
        projectName: c.projectName,
      })),
    }
  },

  getCommands(): CompanionCommandDef[] {
    return [
      {
        name: 'listPipelines',
        description: 'List all pipelines for a connection',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
        },
      },
      {
        name: 'getPipelineRuns',
        description: 'Get recent runs for a pipeline',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          pipelineId: { type: 'number', required: true, description: 'Pipeline ID' },
          count: { type: 'number', required: false, description: 'Number of runs (default 10)' },
        },
      },
      {
        name: 'getRunTimeline',
        description: 'Get stages and jobs for a pipeline run',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          buildId: { type: 'number', required: true, description: 'Build/run ID' },
        },
      },
      {
        name: 'runPipeline',
        description: 'Trigger a pipeline run',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          pipelineId: { type: 'number', required: true, description: 'Pipeline ID' },
          branch: { type: 'string', required: false, description: 'Branch name' },
        },
      },
      {
        name: 'getApprovals',
        description: 'Get pending approvals for pipeline runs',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          buildIds: { type: 'string', required: true, description: 'Comma-separated build IDs' },
        },
      },
      {
        name: 'approve',
        description: 'Approve or reject a pending approval',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          approvalId: { type: 'string', required: true, description: 'Approval ID' },
          status: { type: 'string', required: true, description: '"approved" or "rejected"' },
          comment: { type: 'string', required: false, description: 'Comment' },
        },
      },
      {
        name: 'getBuildLog',
        description: 'Get build log content',
        params: {
          connectionId: { type: 'string', required: true, description: 'Connection ID' },
          buildId: { type: 'number', required: true, description: 'Build/run ID' },
          logId: { type: 'number', required: true, description: 'Log ID' },
        },
      },
    ]
  },

  async execute(command: string, params: Record<string, unknown>, ctx: CompanionContext): Promise<CompanionResult> {
    const workspacePath = resolveWorkspacePath(ctx.workspaceId)
    if (!workspacePath) return { success: false, error: 'Workspace path not found' }
    const data = loadDevOpsFile(workspacePath)
    const connectionId = String(params.connectionId ?? '')
    const connection = findConnection(data, connectionId)

    if (!connection && command !== 'listPipelines') {
      return { success: false, error: `Connection not found: ${connectionId}` }
    }

    try {
      if (command === 'listPipelines') {
        if (!connection) return { success: false, error: `Connection not found: ${connectionId}` }
        const result = await devopsListPipelines(connection)
        return { success: result.success, data: result.pipelines, error: result.error }
      }

      if (command === 'getPipelineRuns') {
        const pipelineId = Number(params.pipelineId)
        const count = Number(params.count) || 10
        const result = await devopsGetPipelineRuns(connection!, pipelineId, count)
        return { success: result.success, data: result.runs, error: result.error }
      }

      if (command === 'getRunTimeline') {
        const buildId = Number(params.buildId)
        const result = await devopsGetBuildTimeline(connection!, buildId)
        return { success: result.success, data: result.stages, error: result.error }
      }

      if (command === 'runPipeline') {
        const pipelineId = Number(params.pipelineId)
        const branch = params.branch ? String(params.branch) : undefined
        const result = await devopsRunPipeline(connection!, pipelineId, branch)
        return { success: result.success, data: result.run, error: result.error }
      }

      if (command === 'getApprovals') {
        const buildIds = String(params.buildIds).split(',').map(Number).filter((n) => !isNaN(n))
        const result = await devopsGetApprovals(connection!, buildIds)
        return { success: result.success, data: result.approvals, error: result.error }
      }

      if (command === 'approve') {
        const approvalId = String(params.approvalId)
        const status = String(params.status) as 'approved' | 'rejected'
        if (status !== 'approved' && status !== 'rejected') {
          return { success: false, error: 'Status must be "approved" or "rejected"' }
        }
        const comment = params.comment ? String(params.comment) : undefined
        const result = await devopsApprove(connection!, approvalId, status, comment)
        return result
      }

      if (command === 'getBuildLog') {
        const buildId = Number(params.buildId)
        const logId = Number(params.logId)
        const result = await devopsGetBuildLog(connection!, buildId, logId)
        return { success: result.success, data: result.content, error: result.error }
      }

      return { success: false, error: `Unknown command: ${command}` }
    } catch (err) {
      return { success: false, error: `DevOps error: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}
