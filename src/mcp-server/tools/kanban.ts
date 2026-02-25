import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { WorkspaceContext } from '../lib/context.js'
import {
  readKanbanTasks,
  createKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
} from '../lib/kanban-store.js'
import type { KanbanStatus } from '../../shared/types/index.js'

export function registerKanbanTools(server: McpServer, ctx: WorkspaceContext): void {
  // kanban_list
  server.tool(
    'kanban_list',
    'List kanban tickets with optional filters (status, priority)',
    {
      status: z.enum(['TODO', 'WORKING', 'PENDING', 'DONE', 'FAILED']).optional().describe('Filter by status'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by priority'),
    },
    async ({ status, priority }) => {
      let tasks = readKanbanTasks(ctx.workspaceId)
      if (status) tasks = tasks.filter((t) => t.status === status)
      if (priority) tasks = tasks.filter((t) => t.priority === priority)

      const summary = tasks.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        status: t.status,
        priority: t.priority,
        labels: t.labels,
        targetProjectId: t.targetProjectId,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(summary, null, 2),
        }],
      }
    },
  )

  // kanban_get
  server.tool(
    'kanban_get',
    'Get a kanban ticket by ID or ticket number',
    {
      id: z.string().optional().describe('Task UUID'),
      ticketNumber: z.number().optional().describe('Ticket number (e.g. 42)'),
    },
    async ({ id, ticketNumber }) => {
      const tasks = readKanbanTasks(ctx.workspaceId)
      const task = id
        ? tasks.find((t) => t.id === id)
        : tasks.find((t) => t.ticketNumber === ticketNumber)

      if (!task) {
        return {
          content: [{ type: 'text' as const, text: `Ticket not found` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }],
      }
    },
  )

  // kanban_create — status forced to TODO
  server.tool(
    'kanban_create',
    'Create a new kanban ticket (status is always TODO)',
    {
      title: z.string().describe('Ticket title'),
      description: z.string().describe('Ticket description (markdown)'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe('Priority level'),
      targetProjectId: z.string().optional().describe('Target project UUID'),
      labels: z.array(z.string()).optional().describe('Labels/tags'),
    },
    async ({ title, description, priority, targetProjectId, labels }) => {
      const task = createKanbanTask(ctx.workspaceId, {
        title,
        description,
        priority,
        status: 'TODO', // FORCED — AI tickets always start as TODO
        targetProjectId,
        labels,
      })

      return {
        content: [{
          type: 'text' as const,
          text: `Created ticket T-${task.ticketNumber}: ${task.title}\n${JSON.stringify(task, null, 2)}`,
        }],
      }
    },
  )

  // kanban_update — PENDING is forbidden
  server.tool(
    'kanban_update',
    'Update a kanban ticket. PENDING status is not allowed.',
    {
      id: z.string().describe('Task UUID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.enum(['TODO', 'WORKING', 'DONE', 'FAILED']).optional().describe('New status (PENDING not allowed)'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('New priority'),
      result: z.string().optional().describe('Result/output text'),
      error: z.string().optional().describe('Error message'),
      labels: z.array(z.string()).optional().describe('Labels/tags'),
    },
    async ({ id, title, description, status, priority, result, error, labels }) => {
      // Double-check: PENDING is excluded from the enum, but guard anyway
      if (status === ('PENDING' as KanbanStatus)) {
        return {
          content: [{ type: 'text' as const, text: 'PENDING status is not allowed via MCP.' }],
          isError: true,
        }
      }

      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description = description
      if (status !== undefined) updates.status = status
      if (priority !== undefined) updates.priority = priority
      if (result !== undefined) updates.result = result
      if (error !== undefined) updates.error = error
      if (labels !== undefined) updates.labels = labels

      try {
        const task = updateKanbanTask(ctx.workspaceId, id, updates)
        return {
          content: [{
            type: 'text' as const,
            text: `Updated ticket T-${task.ticketNumber}: ${task.title}\n${JSON.stringify(task, null, 2)}`,
          }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: String(err) }],
          isError: true,
        }
      }
    },
  )

  // kanban_delete
  server.tool(
    'kanban_delete',
    'Delete a kanban ticket',
    {
      id: z.string().describe('Task UUID to delete'),
    },
    async ({ id }) => {
      try {
        deleteKanbanTask(ctx.workspaceId, id)
        return {
          content: [{ type: 'text' as const, text: `Deleted ticket ${id}` }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: String(err) }],
          isError: true,
        }
      }
    },
  )
}
