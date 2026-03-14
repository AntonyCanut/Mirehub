import { create } from 'zustand'

export type CompanionStatus = 'disconnected' | 'waiting' | 'connected' | 'lost' | 'maintenance'

interface CompanionState {
  status: CompanionStatus
  pairingCode: string | null
  companionName: string | null
}

interface CompanionActions {
  setStatus: (status: CompanionStatus) => void
  setPairingCode: (code: string | null) => void
  setCompanionName: (name: string | null) => void
  register: (workspaceId: string) => Promise<void>
  cancel: () => Promise<void>
  disconnect: () => Promise<void>
}

type CompanionStore = CompanionState & CompanionActions

export const useCompanionStore = create<CompanionStore>((set) => ({
  status: 'disconnected',
  pairingCode: null,
  companionName: null,

  setStatus: (status) => set({ status }),
  setPairingCode: (code) => set({ pairingCode: code }),
  setCompanionName: (name) => set({ companionName: name }),

  register: async (workspaceId: string) => {
    try {
      const result = await window.kanbai.companion.register(workspaceId)
      set({ pairingCode: result.code, status: 'waiting' })
    } catch {
      set({ pairingCode: null, status: 'maintenance' })
    }
  },

  cancel: async () => {
    await window.kanbai.companion.cancel()
    set({ pairingCode: null, status: 'disconnected', companionName: null })
  },

  disconnect: async () => {
    await window.kanbai.companion.disconnect()
    set({ pairingCode: null, status: 'disconnected', companionName: null })
  },
}))

export function initCompanionListener(): () => void {
  return window.kanbai.companion.onStatusChanged((status: string, companionName?: string) => {
    const validStatus = status as CompanionStatus
    const store = useCompanionStore.getState()
    store.setStatus(validStatus)
    if (validStatus === 'connected' && companionName) {
      store.setCompanionName(companionName)
    }
    if (validStatus === 'disconnected') {
      store.setPairingCode(null)
      store.setCompanionName(null)
    }
  })
}
