import { useI18n } from '../../lib/i18n'
import { useCommandPalette } from './use-command-palette'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useI18n()
  const {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    listRef,
    filtered,
    handleKeyDown,
  } = useCommandPalette(open, onClose)

  if (!open) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrap">
          <svg
            className="command-palette-search-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="command-palette-input"
            type="text"
            placeholder={t('command.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-palette-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="command-palette-empty">{t('command.noResults')}</div>
          )}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              className={`command-palette-item${i === selectedIndex ? ' command-palette-item--selected' : ''}`}
              onClick={() => item.action()}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-palette-item-category">{item.category}</span>
              <span className="command-palette-item-label">{item.label}</span>
              {item.shortcut && (
                <span className="command-palette-item-shortcut">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
