import { IpcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { IPC_CHANNELS, Locale } from '../../shared/types'
import { DEFAULT_PROFILES } from '../../shared/constants/defaultProfiles'
import { DEFAULT_SKILLS } from '../../shared/constants/defaultSkills'
import { StorageService } from '../services/storage'

const storage = new StorageService()

function getCurrentLocale(): Locale {
  return storage.getSettings().locale ?? 'fr'
}

export function registerClaudeDefaultsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.CLAUDE_DEFAULTS_PROFILES, async () => {
    const locale = getCurrentLocale()
    return DEFAULT_PROFILES[locale]
  })

  ipcMain.handle(IPC_CHANNELS.CLAUDE_DEFAULTS_SKILLS, async () => {
    const locale = getCurrentLocale()
    return DEFAULT_SKILLS[locale]
  })

  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_DEPLOY_PROFILE,
    async (_event, { projectPath, profileId }: { projectPath: string; profileId: string }) => {
      const locale = getCurrentLocale()
      const profile = DEFAULT_PROFILES[locale].find((p) => p.id === profileId)
      if (!profile) return { success: false, error: 'Profile not found' }

      const agentsDir = path.join(projectPath, '.claude', 'agents')
      if (!fs.existsSync(agentsDir)) {
        fs.mkdirSync(agentsDir, { recursive: true })
      }
      fs.writeFileSync(path.join(agentsDir, profile.filename), profile.content, 'utf-8')
      return { success: true }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_DEPLOY_SKILL,
    async (_event, { projectPath, skillId }: { projectPath: string; skillId: string }) => {
      const locale = getCurrentLocale()
      const skill = DEFAULT_SKILLS[locale].find((s) => s.id === skillId)
      if (!skill) return { success: false, error: 'Skill not found' }

      const commandsDir = path.join(projectPath, '.claude', 'commands')
      if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true })
      }
      fs.writeFileSync(path.join(commandsDir, skill.filename), skill.content, 'utf-8')
      return { success: true }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CHECK_DEPLOYED,
    async (_event, { projectPath }: { projectPath: string }) => {
      const agentsDir = path.join(projectPath, '.claude', 'agents')
      const commandsDir = path.join(projectPath, '.claude', 'commands')

      const deployedProfiles: string[] = []
      const deployedSkills: string[] = []

      const locale = getCurrentLocale()

      for (const profile of DEFAULT_PROFILES[locale]) {
        if (fs.existsSync(path.join(agentsDir, profile.filename))) {
          deployedProfiles.push(profile.id)
        }
      }

      for (const skill of DEFAULT_SKILLS[locale]) {
        if (fs.existsSync(path.join(commandsDir, skill.filename))) {
          deployedSkills.push(skill.id)
        }
      }

      return { deployedProfiles, deployedSkills }
    },
  )
}
