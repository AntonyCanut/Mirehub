import { useCallback, useMemo } from 'react'
import { ModelSelector } from './ModelSelector'
import { EffortSlider } from './EffortSlider'
import { EnvVarsEditor } from './EnvVarsEditor'
import { CompanyAnnouncements } from './CompanyAnnouncements'

interface Props {
  settings: Record<string, unknown>
  onSettingsChange: (settings: Record<string, unknown>) => void
}

export function ModelConfigTab({ settings, onSettingsChange }: Props) {
  const model = (settings.model as string) ?? ''
  const effortLevel = (settings.effortLevel as 'low' | 'medium' | 'high') ?? 'high'
  const envVars = useMemo(() => (settings.env as Record<string, string>) ?? {}, [settings.env])
  const announcements = useMemo(() => (settings.companyAnnouncements as string[]) ?? [], [settings.companyAnnouncements])

  const handleModelChange = useCallback((m: string) => {
    const next = { ...settings }
    if (m) next.model = m
    else delete next.model
    onSettingsChange(next)
  }, [settings, onSettingsChange])

  const handleEffortChange = useCallback((level: 'low' | 'medium' | 'high') => {
    const next = { ...settings, effortLevel: level }
    onSettingsChange(next)
  }, [settings, onSettingsChange])

  const handleEnvChange = useCallback((vars: Record<string, string>) => {
    const next = { ...settings }
    if (Object.keys(vars).length > 0) next.env = vars
    else delete next.env
    onSettingsChange(next)
  }, [settings, onSettingsChange])

  const handleAnnouncementsChange = useCallback((items: string[]) => {
    const next = { ...settings }
    if (items.length > 0) next.companyAnnouncements = items
    else delete next.companyAnnouncements
    onSettingsChange(next)
  }, [settings, onSettingsChange])

  return (
    <div className="cs-model-config">
      <ModelSelector
        model={model}
        onModelChange={handleModelChange}
      />
      <EffortSlider value={effortLevel} onChange={handleEffortChange} />
      <EnvVarsEditor envVars={envVars} onChange={handleEnvChange} />
      <CompanyAnnouncements announcements={announcements} onChange={handleAnnouncementsChange} />
    </div>
  )
}
