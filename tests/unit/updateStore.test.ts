import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockUpdatesApi = {
  check: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  onStatus: vi.fn(),
}

vi.stubGlobal('window', {
  kanbai: {
    updates: mockUpdatesApi,
  },
})

const { useUpdateStore } = await import('../../src/renderer/lib/stores/updateStore')

describe('useUpdateStore', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      updates: [],
      isChecking: false,
      lastChecked: null,
      installingTool: null,
      installStatus: null,
    })

    vi.clearAllMocks()
    mockUpdatesApi.check.mockResolvedValue([])
  })

  it('marque une install comme succes uniquement si l IPC retourne success: true', async () => {
    mockUpdatesApi.install.mockResolvedValue({ success: true })

    await useUpdateStore.getState().installUpdate('codex', 'global')

    const state = useUpdateStore.getState()
    expect(state.installStatus).toEqual({ tool: 'codex', success: true })
    expect(state.installingTool).toBeNull()
    expect(mockUpdatesApi.check).toHaveBeenCalledOnce()
  })

  it('marque une install en echec si l IPC retourne success: false', async () => {
    mockUpdatesApi.install.mockResolvedValue({
      success: false,
      error: 'permission denied',
    })

    await useUpdateStore.getState().installUpdate('codex', 'global')

    const state = useUpdateStore.getState()
    expect(state.installStatus).toEqual({
      tool: 'codex',
      success: false,
      error: 'permission denied',
    })
    expect(mockUpdatesApi.check).not.toHaveBeenCalled()
  })

  it('marque une desinstallation en echec si l IPC retourne success: false', async () => {
    mockUpdatesApi.uninstall.mockResolvedValue({
      success: false,
      error: 'cannot uninstall',
    })

    await useUpdateStore.getState().uninstallUpdate('rtk')

    const state = useUpdateStore.getState()
    expect(state.installStatus).toEqual({
      tool: 'rtk',
      success: false,
      error: 'cannot uninstall',
    })
    expect(mockUpdatesApi.check).not.toHaveBeenCalled()
  })
})
