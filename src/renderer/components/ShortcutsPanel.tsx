import { useMemo } from 'react'
import { useI18n } from '../lib/i18n'

interface ShortcutEntry {
  keys: string
  description: string
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutEntry[]
}

export function ShortcutsPanel() {
  const { t } = useI18n()

  const SHORTCUT_CATEGORIES = useMemo<ShortcutCategory[]>(() => [
    {
      title: t('shortcuts.terminal'),
      shortcuts: [
        { keys: 'Cmd+T', description: t('shortcuts.newTerminal') },
        { keys: 'Cmd+W', description: t('shortcuts.closeTerminal') },
        { keys: 'Cmd+D', description: t('shortcuts.splitHorizontal') },
        { keys: 'Cmd+Shift+D', description: t('shortcuts.splitVertical') },
        { keys: 'Cmd+1-9', description: t('shortcuts.nextTab') },
        { keys: 'Cmd+Shift+T', description: t('shortcuts.prevTab') },
      ],
    },
    {
      title: t('shortcuts.workspace'),
      shortcuts: [
        { keys: 'Cmd+Shift+[', description: t('shortcuts.prevWorkspace') },
        { keys: 'Cmd+Shift+]', description: t('shortcuts.nextWorkspace') },
        { keys: 'Cmd+K', description: t('shortcuts.commandPalette') },
        { keys: 'Cmd+Shift+N', description: t('shortcuts.newWorkspace') },
      ],
    },
    {
      title: t('shortcuts.general'),
      shortcuts: [
        { keys: 'Cmd+1', description: t('command.showTerminal') },
        { keys: 'Cmd+2', description: t('command.showGit') },
        { keys: 'Cmd+3', description: t('command.showKanban') },
        { keys: 'Cmd+4', description: t('command.showNpm') },
        { keys: 'Cmd+5', description: t('command.showClaude') },
      ],
    },
    {
      title: 'Git',
      shortcuts: [
        { keys: 'Cmd+Shift+G', description: t('command.showGit') },
        { keys: 'Cmd+Shift+C', description: 'Commit' },
        { keys: 'Cmd+Shift+P', description: 'Push' },
      ],
    },
    {
      title: t('shortcuts.fileEditor'),
      shortcuts: [
        { keys: 'Enter', description: t('shortcuts.saveFile') },
        { keys: 'Cmd+Shift+F', description: t('shortcuts.globalSearch') },
        { keys: 'Cmd+C', description: t('common.copy') },
        { keys: 'Cmd+V', description: 'Paste' },
        { keys: 'Delete / Backspace', description: t('common.delete') },
        { keys: 'F2', description: t('common.rename') },
      ],
    },
    {
      title: t('shortcuts.general'),
      shortcuts: [
        { keys: 'Cmd+Q', description: t('common.close') },
        { keys: 'Cmd+,', description: t('shortcuts.preferences') },
        { keys: 'Cmd+S', description: t('shortcuts.saveFile') },
        { keys: 'Cmd+Z', description: 'Undo' },
        { keys: 'Cmd+Shift+Z', description: 'Redo' },
      ],
    },
  ], [t])
  return (
    <div className="shortcuts-panel">
      <div className="shortcuts-panel-header">
        <h3>{t('shortcuts.title')}</h3>
      </div>
      <div className="shortcuts-panel-body">
        {SHORTCUT_CATEGORIES.map((category) => (
          <div key={category.title} className="shortcuts-category">
            <h4 className="shortcuts-category-title">{category.title}</h4>
            <div className="shortcuts-list">
              {category.shortcuts.map((shortcut) => (
                <div key={shortcut.keys} className="shortcuts-row">
                  <kbd className="shortcuts-keys">{shortcut.keys}</kbd>
                  <span className="shortcuts-desc">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
