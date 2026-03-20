// Kanban types

export interface KanbanAttachment {
  id: string
  filename: string
  storedPath: string
  mimeType: string
  size: number
  addedAt: number
}

export interface KanbanTask {
  id: string
  workspaceId: string
  targetProjectId?: string
  ticketNumber?: number
  title: string
  description: string
  status: KanbanStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  agentId?: string
  question?: string
  result?: string
  error?: string
  labels?: string[]
  attachments?: KanbanAttachment[]
  dueDate?: number
  archived?: boolean
  disabled?: boolean
  isCtoTicket?: boolean
  parentTicketId?: string
  childTicketIds?: string[]
  conversationHistoryPath?: string
  createdAt: number
  updatedAt: number
}

export type KanbanStatus = 'TODO' | 'WORKING' | 'PENDING' | 'DONE' | 'FAILED'
