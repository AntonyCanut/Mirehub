import fs from 'fs'
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

/** Resolve the base path where devops.json is stored.
 *  Uses projectPath (per-project config) when available,
 *  otherwise falls back to iterating all projects in the workspace. */
function resolveDevOpsBasePath(ctx: CompanionContext): string | undefined {
  if (ctx.projectPath) return ctx.projectPath
  return undefined
}

function loadDevOpsFile(basePath: string): DevOpsFile {
  const filePath = path.join(basePath, '.kanbai', 'devops.json')
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

/** Load all DevOps connections across all projects in a workspace */
function loadAllWorkspaceConnections(workspaceId: string): Array<{ connection: DevOpsConnectionInfo; projectId: string }> {
  const storage = new StorageService()
  const projects = storage.getProjects(workspaceId)
  const results: Array<{ connection: DevOpsConnectionInfo; projectId: string }> = []

  for (const project of projects) {
    const data = loadDevOpsFile(project.path)
    for (const conn of data.connections) {
      results.push({
        connection: {
          id: conn.id,
          name: conn.name,
          provider: conn.provider ?? 'azure-devops',
          organizationUrl: conn.organizationUrl,
          projectName: conn.projectName,
        },
        projectId: project.id,
      })
    }
  }

  return results
}

interface DevOpsConnectionInfo {
  id: string
  name: string
  provider: string
  organizationUrl: string
  projectName: string
}

export const devopsFeature: CompanionFeature = {
  id: 'devops',
  name: 'DevOps',
  workspaceScoped: true,
  projectScoped: false,

  async getState(ctx: CompanionContext): Promise<CompanionResult> {
    // If a specific project is targeted, return its connections
    const basePath = resolveDevOpsBasePath(ctx)
    if (basePath) {
      const data = loadDevOpsFile(basePath)
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
    }

    // No project specified — aggregate connections from all projects in workspace
    const allConnections = loadAllWorkspaceConnections(ctx.workspaceId)
    return {
      success: true,
      data: allConnections.map((entry) => entry.connection),
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
    const basePath = resolveDevOpsBasePath(ctx)
    const connectionId = String(params.connectionId ?? '')

    // Resolve connection: try project path first, then search all projects
    let connection: DevOpsConnection | undefined
    if (basePath) {
      const data = loadDevOpsFile(basePath)
      connection = findConnection(data, connectionId)
    } else {
      // Search all projects in workspace for the connection
      const storage = new StorageService()
      const projects = storage.getProjects(ctx.workspaceId)
      for (const project of projects) {
        const data = loadDevOpsFile(project.path)
        connection = findConnection(data, connectionId)
        if (connection) break
      }
    }

    if (!connection) {
      return { success: false, error: `Connection not found: ${connectionId}` }
    }

    try {
      if (command === 'listPipelines') {
        const result = await devopsListPipelines(connection)
        return { success: result.success, data: result.pipelines, error: result.error }
      }

      if (command === 'getPipelineRuns') {
        const pipelineId = Number(params.pipelineId)
        const count = Number(params.count) || 10
        const result = await devopsGetPipelineRuns(connection, pipelineId, count)
        return { success: result.success, data: result.runs, error: result.error }
      }

      if (command === 'getRunTimeline') {
        const buildId = Number(params.buildId)
        const result = await devopsGetBuildTimeline(connection, buildId)
        return { success: result.success, data: result.stages, error: result.error }
      }

      if (command === 'runPipeline') {
        const pipelineId = Number(params.pipelineId)
        const branch = params.branch ? String(params.branch) : undefined
        const result = await devopsRunPipeline(connection, pipelineId, branch)
        return { success: result.success, data: result.run, error: result.error }
      }

      if (command === 'getApprovals') {
        const buildIds = String(params.buildIds).split(',').map(Number).filter((n) => !isNaN(n))
        const result = await devopsGetApprovals(connection, buildIds)
        return { success: result.success, data: result.approvals, error: result.error }
      }

      if (command === 'approve') {
        const approvalId = String(params.approvalId)
        const status = String(params.status) as 'approved' | 'rejected'
        if (status !== 'approved' && status !== 'rejected') {
          return { success: false, error: 'Status must be "approved" or "rejected"' }
        }
        const comment = params.comment ? String(params.comment) : undefined
        const result = await devopsApprove(connection, approvalId, status, comment)
        return result
      }

      if (command === 'getBuildLog') {
        const buildId = Number(params.buildId)
        const logId = Number(params.logId)
        const result = await devopsGetBuildLog(connection, buildId, logId)
        return { success: result.success, data: result.content, error: result.error }
      }

      return { success: false, error: `Unknown command: ${command}` }
    } catch (err) {
      return { success: false, error: `DevOps error: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}
