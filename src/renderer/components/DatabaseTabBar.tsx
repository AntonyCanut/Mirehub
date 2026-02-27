import { useDatabaseTabStore } from '../lib/stores/databaseTabStore'

interface DatabaseTabBarProps {
  connectionId: string
}

export function DatabaseTabBar({ connectionId }: DatabaseTabBarProps) {
  const { tabsByConnection, activeTabByConnection, setActiveTab, closeTab, createTab } =
    useDatabaseTabStore()

  const tabs = tabsByConnection[connectionId] ?? []
  const activeTabId = activeTabByConnection[connectionId]

  return (
    <div className="terminal-tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab${tab.id === activeTabId ? ' active' : ''}`}
          onClick={() => setActiveTab(connectionId, tab.id)}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.stopPropagation()
              closeTab(connectionId, tab.id)
            }
          }}
        >
          <span className="tab-label">{tab.label}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(connectionId, tab.id)
            }}
            title="Fermer l'onglet"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btn-icon tab-add"
        title="Nouvelle requête"
        onClick={() => createTab(connectionId)}
      >
        +
      </button>
    </div>
  )
}
