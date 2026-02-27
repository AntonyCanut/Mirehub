interface CardOption {
  value: string
  label: string
  description: string
}

interface Props {
  label: string
  options: CardOption[]
  value: string
  onChange: (value: string) => void
}

export function CardSelector({ label, options, value, onChange }: Props) {
  return (
    <div className="claude-rules-section">
      <label className="claude-rules-label">{label}</label>
      <div className="claude-rules-mode-list">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`claude-rules-mode-btn${value === opt.value ? ' claude-rules-mode-btn--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="claude-rules-mode-name">{opt.label}</span>
            <span className="claude-rules-mode-desc">{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
