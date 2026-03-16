import { useEffect, useCallback, useState, useMemo } from 'react'
import { useDevOpsStore } from './devops-store'
import { useWorkspaceStore } from '../../lib/stores/workspaceStore'

export function useDevOps() {
  const { activeWorkspaceId, workspaces } = useWorkspaceStore()
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const {
    data,
    loading,
    activeConnectionId,
    pipelines,
    pipelinesLoading,
    pipelinesError,
    selectedPipelineId,
    pipelineRuns,
    runsLoading,
    monitoringActive,
    loadData,
    loadPipelines,
    loadPipelineRuns,
    selectPipeline,
    startMonitoring,
    stopMonitoring,
    setActiveConnection,
  } = useDevOpsStore()

  const [workspacePath, setWorkspacePath] = useState('')

  const activeConnection = useMemo(
    () => data?.connections.find((c) => c.id === activeConnectionId) ?? null,
    [data, activeConnectionId],
  )

  useEffect(() => {
    if (!activeWorkspace) {
      setWorkspacePath('')
      return
    }
    window.kanbai.workspaceEnv.getPath(activeWorkspace.name).then((envPath) => {
      setWorkspacePath(envPath ?? '')
    })
  }, [activeWorkspace])

  useEffect(() => {
    if (workspacePath) {
      loadData(workspacePath)
    }
  }, [workspacePath, loadData])

  useEffect(() => {
    if (activeConnection) {
      loadPipelines(activeConnection)
      startMonitoring(activeConnection)
    }
    return () => {
      stopMonitoring()
    }
  }, [activeConnection, loadPipelines, startMonitoring, stopMonitoring])

  const handleSelectPipeline = useCallback(
    (pipelineId: number) => {
      selectPipeline(pipelineId)
      if (activeConnection) {
        loadPipelineRuns(activeConnection, pipelineId)
      }
    },
    [activeConnection, selectPipeline, loadPipelineRuns],
  )

  return {
    data,
    loading,
    activeConnection,
    activeConnectionId,
    pipelines,
    pipelinesLoading,
    pipelinesError,
    selectedPipelineId,
    pipelineRuns,
    runsLoading,
    monitoringActive,
    workspacePath,
    setActiveConnection,
    selectPipeline: handleSelectPipeline,
  }
}
