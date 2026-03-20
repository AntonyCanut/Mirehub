// Settings and session types

export type Locale = 'fr' | 'en'

export type ThemeName = 'dark' | 'light' | 'terracotta' | 'system'

export interface AppSettings {
  theme: ThemeName
  locale: Locale
  defaultShell: string
  fontSize: number
  fontFamily: string
  scrollbackLines: number
  claudeDetectionColor: string
  autoClauderEnabled: boolean
  defaultAutoClauderTemplateId?: string
  notificationSound: boolean
  notificationBadge: boolean
  checkUpdatesOnLaunch: boolean
  autoCloseCompletedTerminals: boolean
  autoCloseCtoTerminals: boolean
  autoApprove: boolean
  tutorialCompleted: boolean
  tutorialSeenSections: string[]
}

export interface SessionTab {
  workspaceId: string
  cwd: string
  label: string
  isSplit: boolean
  leftCommand: string | null
  rightCommand: string | null
}

export interface SessionData {
  activeWorkspaceId: string | null
  activeProjectId: string | null
  activeNamespaceId: string | null
  tabs: SessionTab[]
  savedAt: number
}

export interface UpdateInfo {
  tool: string
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  installed: boolean
  scope: 'global' | 'project' | 'unit'
  projectId?: string
}
