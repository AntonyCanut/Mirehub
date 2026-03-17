import { useState, useCallback, useEffect } from 'react'
import { useWorkspaceStore } from '../workspace'
import { AI_PROVIDERS, type AiProviderId } from '../../../shared/types/ai-provider'

export interface AgentPane {
  id: string
  label: string
  prompt: string
  initialCommand: string | null
  status: 'idle' | 'running' | 'completed' | 'failed'
}

const MAX_AGENTS = 4

export function useMultiAgent() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const [agents, setAgents] = useState<AgentPane[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [providerId, setProviderId] = useState<AiProviderId>('claude')

  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Load default AI provider on mount
  useEffect(() => {
    window.kanbai.settings.get().then((s) => {
      if (s.defaultAiProvider) {
        setProviderId(s.defaultAiProvider as AiProviderId)
      }
    })
  }, [])

  const handleAddAgent = useCallback(() => {
    if (agents.length >= MAX_AGENTS || !activeProject) return
    setShowPromptInput(true)
  }, [agents.length, activeProject])

  const handleConfirmAgent = useCallback(() => {
    if (!activeProject) return

    const provider = AI_PROVIDERS[providerId]
    const id = `agent-${Date.now()}`
    const prompt = newPrompt.trim()

    // Build the CLI command — same pattern as kanban sendToAi
    let initialCommand: string
    if (prompt) {
      // Escape double quotes in the prompt for shell safety
      const escapedPrompt = prompt.replace(/"/g, '\\"')
      initialCommand = `${provider.cliCommand} ${provider.interactiveArgs.join(' ')} "${escapedPrompt}"`
    } else {
      // Interactive mode with no initial prompt
      initialCommand = `${provider.cliCommand} ${provider.interactiveArgs.join(' ')}`
    }

    const newAgent: AgentPane = {
      id,
      label: `Agent ${agents.length + 1}`,
      prompt,
      initialCommand,
      status: 'running',
    }

    setAgents((prev) => [...prev, newAgent])
    setActiveAgentId(id)
    setShowPromptInput(false)
    setNewPrompt('')
  }, [activeProject, newPrompt, agents.length, providerId])

  const handleRemoveAgent = useCallback(
    (agentId: string) => {
      setAgents((prev) => prev.filter((a) => a.id !== agentId))
      if (activeAgentId === agentId) {
        setActiveAgentId(agents.find((a) => a.id !== agentId)?.id || null)
      }
    },
    [agents, activeAgentId],
  )

  const getLayoutClass = useCallback((): string => {
    switch (agents.length) {
      case 1:
        return 'multiagent-grid--1'
      case 2:
        return 'multiagent-grid--2'
      case 3:
        return 'multiagent-grid--3'
      case 4:
        return 'multiagent-grid--4'
      default:
        return ''
    }
  }, [agents.length])

  return {
    agents,
    activeAgentId,
    setActiveAgentId,
    showPromptInput,
    newPrompt,
    setNewPrompt,
    setShowPromptInput,
    activeProject,
    handleAddAgent,
    handleConfirmAgent,
    handleRemoveAgent,
    getLayoutClass,
    maxAgents: MAX_AGENTS,
  }
}
