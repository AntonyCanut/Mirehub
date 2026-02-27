interface Feature {
  key: string
  label: string
  description: string
  active: boolean
  onToggle: () => void
}

interface Props {
  features: Feature[]
}

export function FeatureToggleGrid({ features }: Props) {
  return (
    <div className="cs-feature-grid">
      {features.map((f) => (
        <button
          key={f.key}
          className={`cs-feature-card${f.active ? ' cs-feature-card--active' : ''}`}
          onClick={f.onToggle}
        >
          <span className="cs-feature-card-name">{f.label}</span>
          <span className="cs-feature-card-desc">{f.description}</span>
        </button>
      ))}
    </div>
  )
}
