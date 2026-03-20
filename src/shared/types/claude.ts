// Claude types

export interface ClaudeSession {
  id: string
  projectId: string
  terminalId: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  startedAt: number
  endedAt?: number
  prompt?: string
  loopMode: boolean
  loopCount: number
  loopDelay: number // ms
}

export interface AutoClauderTemplate {
  id: string
  name: string
  description: string
  claudeMd: string
  settings: Record<string, unknown>
  createdAt: number
}
