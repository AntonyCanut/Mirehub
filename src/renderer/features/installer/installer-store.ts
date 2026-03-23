import { create } from 'zustand'
import type { PrerequisiteInfo } from '../../../shared/types'

interface InstallerState {
  prerequisites: PrerequisiteInfo[]
  isChecking: boolean
  dismissed: boolean
}

interface InstallerActions {
  checkPrerequisites: () => Promise<void>
  dismiss: () => void
}

type InstallerStore = InstallerState & InstallerActions

export const useInstallerStore = create<InstallerStore>((set) => ({
  prerequisites: [],
  isChecking: false,
  dismissed: false,

  checkPrerequisites: async () => {
    set({ isChecking: true })
    try {
      const prerequisites = await window.kanbai.installer.check()
      set({ prerequisites })
    } catch {
      // Non-critical — silently fail
    } finally {
      set({ isChecking: false })
    }
  },

  dismiss: () => set({ dismissed: true }),
}))
