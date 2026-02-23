import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../shared/types'
import { useI18n } from '../lib/i18n'
import { useAppUpdateStore } from '../lib/stores/appUpdateStore'

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
  locale: 'fr',
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
  const { t, locale, setLocale } = useI18n()
  const { status: updateStatus, checkForUpdate } = useAppUpdateStore()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [appVersion, setAppVersion] = useState<{ version: string; name: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    window.mirehub.settings.get().then((s: AppSettings) => {
      setSettings({ ...DEFAULT_SETTINGS, ...s })
      if (s.locale) {
        setLocale(s.locale)
      }
      setLoading(false)
    })
    window.mirehub.app.version().then(setAppVersion)
  }, [setLocale])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    window.mirehub.settings.set({ [key]: value })

    // Apply theme immediately when changed
    if (key === 'theme') {
      const theme = value as string
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    }
  }, [])

  const handleLocaleChange = useCallback((newLocale: 'fr' | 'en') => {
    setLocale(newLocale)
    setSettings((prev) => ({ ...prev, locale: newLocale }))
  }, [setLocale])

  if (loading) {
    return <div className="file-viewer-empty">{t('common.loading')}</div>
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>{t('settings.title')}</h3>
      </div>
      <div className="settings-body">
        {/* General */}
        <div className="settings-group">
          <h4 className="settings-group-title">{t('settings.general')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.language')}</label>
            <div className="settings-radio-group">
              <button
                className={`settings-radio-btn${locale === 'fr' ? ' settings-radio-btn--active' : ''}`}
                onClick={() => handleLocaleChange('fr')}
              >
                {t('settings.french')}
              </button>
              <button
                className={`settings-radio-btn${locale === 'en' ? ' settings-radio-btn--active' : ''}`}
                onClick={() => handleLocaleChange('en')}
              >
                {t('settings.english')}
              </button>
            </div>
          </div>
        </div>

        {/* Apparence */}
        <div className="settings-group">
          <h4 className="settings-group-title">{t('settings.appearance')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.theme')}</label>
            <div className="settings-radio-group">
              {(['dark', 'light', 'terracotta', 'system'] as const).map((th) => (
                <button
                  key={th}
                  className={`settings-radio-btn${settings.theme === th ? ' settings-radio-btn--active' : ''}`}
                  onClick={() => updateSetting('theme', th)}
                >
                  {t(`settings.theme${th.charAt(0).toUpperCase() + th.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('settings.fontSize')}</label>
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
            <label className="settings-label">{t('settings.fontFamily')}</label>
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
          <h4 className="settings-group-title">{t('settings.terminal')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.defaultShell')}</label>
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
            <label className="settings-label">{t('settings.scrollbackLines')}</label>
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
          <h4 className="settings-group-title">{t('settings.claude')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.detectionColor')}</label>
            <input
              type="color"
              value={settings.claudeDetectionColor}
              onChange={(e) => updateSetting('claudeDetectionColor', e.target.value)}
              className="settings-color-input"
            />
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('settings.autoClaude')}</label>
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
          <h4 className="settings-group-title">{t('settings.notifications')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.sound')}</label>
            <button
              className={`settings-toggle${settings.notificationSound ? ' settings-toggle--active' : ''}`}
              onClick={() => updateSetting('notificationSound', !settings.notificationSound)}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('settings.checkUpdates')}</label>
            <button
              className={`settings-toggle${settings.checkUpdatesOnLaunch ? ' settings-toggle--active' : ''}`}
              onClick={() => updateSetting('checkUpdatesOnLaunch', !settings.checkUpdatesOnLaunch)}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        </div>

        {/* About */}
        <div className="settings-group">
          <h4 className="settings-group-title">{t('settings.about')}</h4>
          <div className="settings-row">
            <label className="settings-label">{t('settings.appName')}</label>
            <span className="settings-value">{appVersion?.name ?? 'Workspaces'}</span>
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('settings.version')}</label>
            <span className="settings-value">{appVersion?.version ?? '—'}</span>
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('settings.developer')}</label>
            <span className="settings-value">Antony KERVAZO CANUT</span>
          </div>
          <div className="settings-row">
            <label className="settings-label">{t('appUpdate.checkNow')}</label>
            <button
              className="settings-btn"
              onClick={checkForUpdate}
              disabled={updateStatus === 'checking'}
            >
              {updateStatus === 'checking' ? t('common.loading') : t('appUpdate.checkNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
