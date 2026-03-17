import { useMultiAgent } from './use-multi-agent'
import { Terminal } from '../terminal'
import { useI18n } from '../../lib/i18n'
import './multiagent.css'

export function MultiAgentView() {
  const { t } = useI18n()
  const {
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
    maxAgents,
  } = useMultiAgent()

  if (!activeProject) {
    return (
      <div className="multiagent-empty">
        {t('multiAgent.selectProject')}
      </div>
    )
  }

  return (
    <div className="multiagent">
      <div className="multiagent-toolbar">
        <div className="multiagent-tabs">
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={`multiagent-tab${activeAgentId === agent.id ? ' multiagent-tab--active' : ''}`}
              onClick={() => setActiveAgentId(agent.id)}
            >
              <span
                className={`multiagent-tab-dot multiagent-tab-dot--${agent.status}`}
              />
              {agent.label}
              <button
                className="multiagent-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveAgent(agent.id)
                }}
              >
                ×
              </button>
            </button>
          ))}
        </div>
        {agents.length < maxAgents && (
          <button className="multiagent-add" onClick={handleAddAgent}>
            + Agent
          </button>
        )}
      </div>

      {showPromptInput && (
        <div className="multiagent-prompt-bar">
          <input
            className="multiagent-prompt-input"
            placeholder={t('multiAgent.promptPlaceholder')}
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmAgent()}
            autoFocus
          />
          <button className="multiagent-prompt-go" onClick={handleConfirmAgent}>
            {t('multiAgent.launch')}
          </button>
          <button
            className="multiagent-prompt-cancel"
            onClick={() => setShowPromptInput(false)}
          >
            {t('multiAgent.cancel')}
          </button>
        </div>
      )}

      <div className={`multiagent-grid ${getLayoutClass()}`}>
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`multiagent-pane${activeAgentId === agent.id ? ' multiagent-pane--active' : ''}`}
            onClick={() => setActiveAgentId(agent.id)}
          >
            <div className="multiagent-pane-header">
              <span className={`multiagent-pane-status multiagent-pane-status--${agent.status}`}>
                ●
              </span>
              <span className="multiagent-pane-label">{agent.label}</span>
              {agent.prompt && (
                <span className="multiagent-pane-prompt" title={agent.prompt}>
                  {agent.prompt.slice(0, 40)}...
                </span>
              )}
            </div>
            <div className="multiagent-pane-terminal">
              <Terminal
                cwd={activeProject.path}
                isVisible={activeAgentId === agent.id}
                fontSize={14}
                initialCommand={agent.initialCommand}
              />
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="multiagent-placeholder">
            <p>{t('multiAgent.placeholder')}</p>
            <p className="multiagent-placeholder-sub">
              {t('multiAgent.placeholderSub')}
            </p>
            <button className="multiagent-start-btn" onClick={handleAddAgent}>
              {t('multiAgent.addAgent')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
