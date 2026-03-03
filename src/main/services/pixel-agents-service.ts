import fs from 'fs'
import path from 'path'
import os from 'os'

export interface PixelAgentEvent {
  type: string
  agentId?: string
  tool?: string
  status?: string
  [key: string]: unknown
}

interface ActiveAgent {
  id: string
  status: 'working' | 'thinking' | 'waiting' | 'idle'
  lastTool?: string
  ticket?: string
  workspaceId?: string
  tabId?: string
  provider?: string
  lastActivity: number
}

interface HookEvent {
  type: 'toolStart' | 'toolDone' | 'turnEnd' | 'sessionEnd'
  sessionId: string
  tool: string
  ts: number
  ticket?: string
  workspaceId?: string
  tabId?: string
  provider?: string
}

type EventCallback = (event: PixelAgentEvent) => void

const EVENTS_DIR = path.join(os.homedir(), '.kanbai', 'pixel-agents')
const EVENTS_FILE = path.join(EVENTS_DIR, 'events.jsonl')
const STALE_THRESHOLD_MS = 2 * 60 * 1000
const MAX_EVENTS_FILE_BYTES = 512 * 1024
const RECENT_WINDOW_SEC = 300

export class PixelAgentsService {
  private fileOffset = 0
  private activeAgents = new Map<string, ActiveAgent>()
  private emitCallback: EventCallback | null = null
  private pollInterval: ReturnType<typeof setInterval> | null = null

  /** Start polling for events. Must be called once at app startup. */
  start(): void {
    if (this.pollInterval) return

    if (!fs.existsSync(EVENTS_DIR)) {
      fs.mkdirSync(EVENTS_DIR, { recursive: true })
    }

    this.processExistingEvents()

    this.pollInterval = setInterval(() => {
      this.readNewEvents()
      this.cleanupStaleAgents()
    }, 1000)
  }

  /** Attach a callback to receive events (when the UI connects). */
  attachEmitter(callback: EventCallback): void {
    this.emitCallback = callback
  }

  /** Detach the event callback (when the UI disconnects). */
  detachEmitter(): void {
    this.emitCallback = null
  }

  /** Fully stop the service. Called on app quit. */
  shutdown(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.activeAgents.clear()
    this.fileOffset = 0
    this.emitCallback = null
  }

  private emitEvent(event: PixelAgentEvent): void {
    this.emitCallback?.(event)
  }

  getActiveAgents(): Array<{ id: string; status: string; lastTool?: string; ticket?: string; workspaceId?: string; tabId?: string; provider?: string }> {
    return Array.from(this.activeAgents.values()).map((a) => ({
      id: a.id,
      status: a.status,
      lastTool: a.lastTool,
      ticket: a.ticket,
      workspaceId: a.workspaceId,
      tabId: a.tabId,
      provider: a.provider,
    }))
  }

  /** Read recent events from events file to reconstruct current state */
  private processExistingEvents(): void {
    if (!fs.existsSync(EVENTS_FILE)) {
      this.fileOffset = 0
      return
    }

    try {
      const stat = fs.statSync(EVENTS_FILE)
      const content = fs.readFileSync(EVENTS_FILE, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())

      const cutoff = Math.floor(Date.now() / 1000) - RECENT_WINDOW_SEC

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as HookEvent
          if (event.ts && event.ts > cutoff) {
            this.processHookEvent(event)
          }
        } catch {
          /* skip invalid lines */
        }
      }

      this.fileOffset = stat.size
    } catch {
      this.fileOffset = 0
    }
  }

  /** Read new lines appended since last check */
  private readNewEvents(): void {
    if (!fs.existsSync(EVENTS_FILE)) return

    try {
      const stat = fs.statSync(EVENTS_FILE)

      if (stat.size < this.fileOffset) {
        // File was truncated — reset
        this.fileOffset = 0
      }

      if (stat.size <= this.fileOffset) return

      const fd = fs.openSync(EVENTS_FILE, 'r')
      const buffer = Buffer.alloc(stat.size - this.fileOffset)
      fs.readSync(fd, buffer, 0, buffer.length, this.fileOffset)
      fs.closeSync(fd)

      this.fileOffset = stat.size

      const lines = buffer.toString('utf-8').split('\n').filter((l) => l.trim())
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as HookEvent
          this.processHookEvent(event)
        } catch {
          /* skip invalid lines */
        }
      }
    } catch {
      /* ignore read errors */
    }
  }

  private processHookEvent(event: HookEvent): void {
    const sessionId = event.sessionId
    if (!sessionId) return

    if (event.type === 'toolStart') {
      const agent = this.getOrCreateAgent(sessionId, event.ticket, event.workspaceId, event.tabId, event.provider)
      agent.status = 'working'
      agent.lastTool = event.tool
      agent.lastActivity = Date.now()
      this.emitEvent({
        type: 'agentToolStart',
        agentId: sessionId,
        tool: event.tool,
        workspaceId: agent.workspaceId,
        tabId: agent.tabId,
        provider: agent.provider,
      })
    } else if (event.type === 'toolDone') {
      const agent = this.getOrCreateAgent(sessionId, event.ticket, event.workspaceId, event.tabId, event.provider)
      agent.status = 'thinking'
      agent.lastActivity = Date.now()
      this.emitEvent({
        type: 'agentToolDone',
        agentId: sessionId,
        tool: event.tool,
        workspaceId: agent.workspaceId,
        tabId: agent.tabId,
        provider: agent.provider,
      })
    } else if (event.type === 'turnEnd') {
      const agent = this.getOrCreateAgent(sessionId, event.ticket, event.workspaceId, event.tabId, event.provider)
      agent.status = 'waiting'
      agent.lastActivity = Date.now()
      this.emitEvent({ type: 'agentToolsClear', agentId: sessionId, workspaceId: agent.workspaceId })
      this.emitEvent({
        type: 'agentStatus',
        agentId: sessionId,
        status: 'waiting',
        workspaceId: agent.workspaceId,
      })
    } else if (event.type === 'sessionEnd') {
      const agent = this.activeAgents.get(sessionId)
      if (agent) {
        this.activeAgents.delete(sessionId)
        this.emitEvent({ type: 'agentClosed', agentId: sessionId, workspaceId: agent.workspaceId })
      }
    }
  }

  private getOrCreateAgent(sessionId: string, ticket?: string, workspaceId?: string, tabId?: string, provider?: string): ActiveAgent {
    let agent = this.activeAgents.get(sessionId)
    if (!agent) {
      agent = { id: sessionId, status: 'idle', ticket, workspaceId, tabId, provider, lastActivity: Date.now() }
      this.activeAgents.set(sessionId, agent)
      this.emitEvent({ type: 'agentJoined', agentId: sessionId, ticket, workspaceId, tabId, provider })
    } else {
      if (ticket && !agent.ticket) agent.ticket = ticket
      if (workspaceId && !agent.workspaceId) agent.workspaceId = workspaceId
      if (tabId && !agent.tabId) agent.tabId = tabId
      if (provider && !agent.provider) agent.provider = provider
    }
    return agent
  }

  private cleanupStaleAgents(): void {
    const now = Date.now()

    for (const [sessionId, agent] of this.activeAgents) {
      if (
        now - agent.lastActivity > STALE_THRESHOLD_MS &&
        (agent.status === 'waiting' || agent.status === 'idle')
      ) {
        this.activeAgents.delete(sessionId)
        this.emitEvent({ type: 'agentClosed', agentId: sessionId, workspaceId: agent.workspaceId })
      }
    }

    this.truncateEventsFileIfNeeded()
  }

  /** Prevent unbounded growth of the events file */
  private truncateEventsFileIfNeeded(): void {
    try {
      if (!fs.existsSync(EVENTS_FILE)) return
      const stat = fs.statSync(EVENTS_FILE)
      if (stat.size < MAX_EVENTS_FILE_BYTES) return

      const content = fs.readFileSync(EVENTS_FILE, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      const cutoff = Math.floor(Date.now() / 1000) - RECENT_WINDOW_SEC

      const recentLines = lines.filter((line) => {
        try {
          const event = JSON.parse(line) as HookEvent
          return event.ts && event.ts > cutoff
        } catch {
          return false
        }
      })

      const newContent = recentLines.length > 0 ? recentLines.join('\n') + '\n' : ''
      fs.writeFileSync(EVENTS_FILE, newContent, 'utf-8')
      this.fileOffset = Buffer.byteLength(newContent, 'utf-8')
    } catch {
      /* ignore truncation errors */
    }
  }
}
