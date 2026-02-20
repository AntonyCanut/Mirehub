import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../shared/types'

const FONT_FAMILIES = [
  'Menlo',
  'Monaco',
  'JetBrains Mono',
  'Fira Code',
  'SF Mono',
  'Courier New',
]

const SHELLS = [
  { value: '/bin/zsh', label: 'zsh' },
  { value: '/bin/bash', label: 'bash' },
  { value: '/usr/local/bin/fish', label: 'fish' },
]

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultShell: '/bin/zsh',
  fontSize: 13,
  fontFamily: 'Menlo',
  scrollbackLines: 5000,
  claudeDetectionColor: '#7c3aed',
  autoClauderEnabled: false,
  notificationSound: true,
  checkUpdatesOnLaunch: true,
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.theone.settings.get().then((s: AppSettings) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
      setLoading(false)
    })
  }, [])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    window.theone.settings.set({ [key]: value })
  }, [])

  if (loading) {
    return <div className="file-viewer-empty">Chargement...</div>
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Preferences</h3>
      </div>
      <div className="settings-body">
        {/* Apparence */}
        <div className="settings-group">
          <h4 className="settings-group-title">Apparence</h4>
          <div className="settings-row">
            <label className="settings-label">Theme</label>
            <div className="settings-radio-group">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  className={`settings-radio-btn${settings.theme === t ? ' settings-radio-btn--active' : ''}`}
                  onClick={() => updateSetting('theme', t)}
                >
                  {t === 'dark' ? 'Sombre' : t === 'light' ? 'Clair' : 'Systeme'}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <label className="settings-label">Taille de police</label>
            <div className="settings-input-row">
              <input
                type="range"
                min={8}
                max={24}
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                className="settings-slider"
              />
              <span className="settings-value">{settings.fontSize}px</span>
            </div>
          </div>
          <div className="settings-row">
            <label className="settings-label">Famille de police</label>
            <select
              className="settings-select"
              value={settings.fontFamily}
              onChange={(e) => updateSetting('fontFamily', e.target.value)}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Terminal */}
        <div className="settings-group">
          <h4 className="settings-group-title">Terminal</h4>
          <div className="settings-row">
            <label className="settings-label">Shell par defaut</label>
            <select
              className="settings-select"
              value={settings.defaultShell}
              onChange={(e) => updateSetting('defaultShell', e.target.value)}
            >
              {SHELLS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <label className="settings-label">Lignes de scrollback</label>
            <div className="settings-input-row">
              <input
                type="number"
                min={1000}
                max={50000}
                step={1000}
                value={settings.scrollbackLines}
                onChange={(e) => updateSetting('scrollbackLines', Number(e.target.value))}
                className="settings-number-input"
              />
            </div>
          </div>
        </div>

        {/* Claude */}
        <div className="settings-group">
          <h4 className="settings-group-title">Claude</h4>
          <div className="settings-row">
            <label className="settings-label">Couleur de detection</label>
            <input
              type="color"
              value={settings.claudeDetectionColor}
              onChange={(e) => updateSetting('claudeDetectionColor', e.target.value)}
              className="settings-color-input"
            />
          </div>
          <div className="settings-row">
            <label className="settings-label">Auto-Clauder actif</label>
            <button
              className={`settings-toggle${settings.autoClauderEnabled ? ' settings-toggle--active' : ''}`}
              onClick={() => updateSetting('autoClauderEnabled', !settings.autoClauderEnabled)}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-group">
          <h4 className="settings-group-title">Notifications</h4>
          <div className="settings-row">
            <label className="settings-label">Son de notification</label>
            <button
              className={`settings-toggle${settings.notificationSound ? ' settings-toggle--active' : ''}`}
              onClick={() => updateSetting('notificationSound', !settings.notificationSound)}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <label className="settings-label">Verifier les MAJ au lancement</label>
            <button
              className={`settings-toggle${settings.checkUpdatesOnLaunch ? ' settings-toggle--active' : ''}`}
              onClick={() => updateSetting('checkUpdatesOnLaunch', !settings.checkUpdatesOnLaunch)}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
