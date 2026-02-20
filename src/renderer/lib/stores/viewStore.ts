import { create } from 'zustand'

export type ViewMode = 'terminal' | 'git' | 'kanban' | 'file' | 'npm' | 'diff' | 'claude' | 'settings'

interface ViewState {
  viewMode: ViewMode
  selectedFilePath: string | null
  isEditorDirty: boolean
  availableMagicTabs: string[]
  // Multi-select for diff
  selectedFiles: string[]
  diffFiles: [string, string] | null
  // Clipboard for file operations
  clipboardPath: string | null
  clipboardOperation: 'copy' | null
  setViewMode: (mode: ViewMode) => void
  openFile: (filePath: string) => void
  setEditorDirty: (dirty: boolean) => void
  setAvailableMagicTabs: (tabs: string[]) => void
  toggleFileSelection: (filePath: string) => void
  openDiff: () => void
  clearSelection: () => void
  setClipboard: (path: string, operation: 'copy') => void
  clearClipboard: () => void
}

export const useViewStore = create<ViewState>((set, get) => ({
  viewMode: 'terminal',
  selectedFilePath: null,
  isEditorDirty: false,
  availableMagicTabs: [],
  selectedFiles: [],
  diffFiles: null,
  clipboardPath: null,
  clipboardOperation: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  openFile: (filePath) => set({ viewMode: 'file', selectedFilePath: filePath, isEditorDirty: false }),
  setEditorDirty: (dirty) => set({ isEditorDirty: dirty }),
  setAvailableMagicTabs: (tabs) => set({ availableMagicTabs: tabs }),
  toggleFileSelection: (filePath) => {
    const { selectedFiles } = get()
    if (selectedFiles.includes(filePath)) {
      set({ selectedFiles: selectedFiles.filter((f) => f !== filePath) })
    } else if (selectedFiles.length < 2) {
      const newSelection = [...selectedFiles, filePath]
      set({ selectedFiles: newSelection })
      // Auto-open diff when 2 files selected
      if (newSelection.length === 2) {
        set({ diffFiles: [newSelection[0]!, newSelection[1]!], viewMode: 'diff' })
      }
    } else {
      // Replace oldest selection
      set({ selectedFiles: [selectedFiles[1]!, filePath] })
    }
  },
  openDiff: () => {
    const { selectedFiles } = get()
    if (selectedFiles.length === 2) {
      set({ diffFiles: [selectedFiles[0]!, selectedFiles[1]!], viewMode: 'diff' })
    }
  },
  clearSelection: () => set({ selectedFiles: [], diffFiles: null }),
  setClipboard: (path, operation) => set({ clipboardPath: path, clipboardOperation: operation }),
  clearClipboard: () => set({ clipboardPath: null, clipboardOperation: null }),
}))
