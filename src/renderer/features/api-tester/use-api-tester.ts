import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '../workspace/workspace-store'
import type {
  ApiTestFile,
  ApiCollection,
  ApiRequest,
  ApiResponse,
  ApiTestResult,
  ApiEnvironment,
} from '../../../shared/types'

type RequestTab = 'headers' | 'body' | 'tests' | 'chain'
type ResponseTab = 'body' | 'headers' | 'testResults'
type SidebarSelection =
  | { type: 'request'; collectionId: string; requestId: string }
  | { type: 'chain'; chainId: string }
  | null

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function defaultApiTestFile(): ApiTestFile {
  return {
    version: 1,
    environments: [],
    collections: [],
    chains: [],
    healthChecks: [],
  }
}

function createEmptyRequest(name: string): ApiRequest {
  return {
    id: generateId(),
    name,
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    bodyType: 'none',
    tests: [],
  }
}

export type { RequestTab, ResponseTab, SidebarSelection }

export function useApiTester() {
  const { activeProjectId, projects } = useWorkspaceStore()
  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Data state
  const [data, setData] = useState<ApiTestFile>(defaultApiTestFile())
  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState<SidebarSelection>(null)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())

  // Request editing state
  const [requestTab, setRequestTab] = useState<RequestTab>('headers')
  const [responseTab, setResponseTab] = useState<ResponseTab>('body')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [testResults, setTestResults] = useState<ApiTestResult[]>([])
  const [sending, setSending] = useState(false)

  // UI state
  const [showEnvModal, setShowEnvModal] = useState(false)
  const [showDoc, setShowDoc] = useState(true)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load data when project changes
  useEffect(() => {
    if (!activeProject) return
    setLoading(true)
    window.kanbai.api.load(activeProject.path).then((loaded) => {
      setData(loaded)
      setLoading(false)
    })
  }, [activeProject])

  // Auto-save with debounce
  const saveData = useCallback(
    (newData: ApiTestFile) => {
      if (!activeProject) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        window.kanbai.api.save(activeProject.path, newData)
      }, 500)
    },
    [activeProject],
  )

  const updateData = useCallback(
    (updater: (prev: ApiTestFile) => ApiTestFile) => {
      setData((prev) => {
        const next = updater(prev)
        saveData(next)
        return next
      })
    },
    [saveData],
  )

  // Get active environment variables
  const getActiveVariables = useCallback((): Record<string, string> => {
    const env = data.environments.find((e) => e.isActive)
    return env?.variables ?? {}
  }, [data.environments])

  // Get the currently selected request
  const getSelectedRequest = useCallback((): {
    request: ApiRequest
    collectionId: string
  } | null => {
    if (!selection || selection.type !== 'request') return null
    const col = data.collections.find((c) => c.id === selection.collectionId)
    if (!col) return null
    const req = col.requests.find((r) => r.id === selection.requestId)
    if (!req) return null
    return { request: req, collectionId: col.id }
  }, [selection, data.collections])

  // Update a request within the data
  const updateRequest = useCallback(
    (collectionId: string, requestId: string, updater: (r: ApiRequest) => ApiRequest) => {
      updateData((prev) => ({
        ...prev,
        collections: prev.collections.map((col) =>
          col.id === collectionId
            ? {
                ...col,
                requests: col.requests.map((r) => (r.id === requestId ? updater(r) : r)),
              }
            : col,
        ),
      }))
    },
    [updateData],
  )

  // Send request
  const handleSend = useCallback(async () => {
    const selected = getSelectedRequest()
    if (!selected) return
    const { request } = selected
    setSending(true)
    setResponse(null)
    setTestResults([])
    try {
      const result = await window.kanbai.api.execute(
        {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          bodyType: request.bodyType,
          tests: request.tests,
        },
        getActiveVariables(),
      )
      setResponse(result.response)
      setTestResults(result.testResults)
      setResponseTab('body')
    } catch (err) {
      setResponse({
        status: 0,
        statusText: String(err),
        headers: {},
        body: String(err),
        time: 0,
        size: 0,
      })
    } finally {
      setSending(false)
    }
  }, [getSelectedRequest, getActiveVariables])

  // Handle URL input Enter key
  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // Collection CRUD
  const addCollection = useCallback(() => {
    const col: ApiCollection = {
      id: generateId(),
      name: 'New Collection',
      requests: [],
    }
    updateData((prev) => ({ ...prev, collections: [...prev.collections, col] }))
    setExpandedCollections((prev) => new Set(prev).add(col.id))
  }, [updateData])

  const deleteCollection = useCallback(
    (colId: string) => {
      updateData((prev) => ({
        ...prev,
        collections: prev.collections.filter((c) => c.id !== colId),
      }))
      if (selection?.type === 'request' && selection.collectionId === colId) {
        setSelection(null)
      }
    },
    [updateData, selection],
  )

  const addRequest = useCallback(
    (colId: string) => {
      const req = createEmptyRequest('New Request')
      updateData((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === colId ? { ...c, requests: [...c.requests, req] } : c,
        ),
      }))
      setExpandedCollections((prev) => new Set(prev).add(colId))
      setSelection({ type: 'request', collectionId: colId, requestId: req.id })
      setResponse(null)
      setTestResults([])
    },
    [updateData],
  )

  const deleteRequest = useCallback(
    (colId: string, reqId: string) => {
      updateData((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === colId ? { ...c, requests: c.requests.filter((r) => r.id !== reqId) } : c,
        ),
      }))
      if (selection?.type === 'request' && selection.requestId === reqId) {
        setSelection(null)
      }
    },
    [updateData, selection],
  )

  const duplicateRequest = useCallback(
    (colId: string, reqId: string) => {
      const col = data.collections.find((c) => c.id === colId)
      const req = col?.requests.find((r) => r.id === reqId)
      if (!req) return
      const newReq: ApiRequest = { ...req, id: generateId(), name: req.name + ' (copy)' }
      updateData((prev) => ({
        ...prev,
        collections: prev.collections.map((c) =>
          c.id === colId ? { ...c, requests: [...c.requests, newReq] } : c,
        ),
      }))
    },
    [data.collections, updateData],
  )

  // Environment management
  const addEnvironment = useCallback(() => {
    const env: ApiEnvironment = {
      id: generateId(),
      name: 'New Environment',
      variables: {},
    }
    updateData((prev) => ({ ...prev, environments: [...prev.environments, env] }))
  }, [updateData])

  const deleteEnvironment = useCallback(
    (envId: string) => {
      updateData((prev) => ({
        ...prev,
        environments: prev.environments.filter((e) => e.id !== envId),
      }))
    },
    [updateData],
  )

  const setActiveEnvironment = useCallback(
    (envId: string | null) => {
      updateData((prev) => ({
        ...prev,
        environments: prev.environments.map((e) => ({ ...e, isActive: e.id === envId })),
      }))
    },
    [updateData],
  )

  const updateEnvironment = useCallback(
    (envId: string, updater: (e: ApiEnvironment) => ApiEnvironment) => {
      updateData((prev) => ({
        ...prev,
        environments: prev.environments.map((e) => (e.id === envId ? updater(e) : e)),
      }))
    },
    [updateData],
  )

  // Import/Export
  const handleExport = useCallback(async () => {
    await window.kanbai.api.export(data)
  }, [data])

  const handleImport = useCallback(async () => {
    const result = await window.kanbai.api.import()
    if (result.success && result.data) {
      setData(result.data)
      if (activeProject) {
        window.kanbai.api.save(activeProject.path, result.data)
      }
    }
  }, [activeProject])

  // Toggle collection expand
  const toggleCollection = useCallback((colId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      return next
    })
  }, [])

  const selectRequest = useCallback(
    (collectionId: string, requestId: string) => {
      setSelection({ type: 'request', collectionId, requestId })
      setResponse(null)
      setTestResults([])
    },
    [],
  )

  const selectedRequest = getSelectedRequest()
  const activeEnv = data.environments.find((e) => e.isActive)

  return {
    // State
    activeProject,
    data,
    loading,
    selection,
    expandedCollections,
    requestTab,
    responseTab,
    response,
    testResults,
    sending,
    showEnvModal,
    showDoc,
    selectedRequest,
    activeEnv,

    // State setters
    setRequestTab,
    setResponseTab,
    setShowEnvModal,
    setShowDoc,

    // Actions
    handleSend,
    handleUrlKeyDown,
    addCollection,
    deleteCollection,
    addRequest,
    deleteRequest,
    duplicateRequest,
    addEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    updateEnvironment,
    updateRequest,
    handleExport,
    handleImport,
    toggleCollection,
    selectRequest,
  }
}
