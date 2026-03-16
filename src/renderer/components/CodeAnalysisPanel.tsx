import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useWorkspaceStore } from '../lib/stores/workspaceStore'
import { useViewStore } from '../shared/stores/view-store'
import { useI18n } from '../lib/i18n'
import type {
  AnalysisToolDef,
  AnalysisReport,
  AnalysisFinding,
  AnalysisSeverity,
  AnalysisProgress,
  ProjectStatsData,
  Project,
} from '../../shared/types'
import '../styles/analysis.css'

type GroupBy = 'file' | 'rule' | 'severity'
type TicketGroupBy = 'individual' | 'file' | 'rule' | 'severity'

const SEVERITY_ORDER: AnalysisSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

// Map file extensions to language identifiers used in tool catalog
const EXT_TO_LANGUAGES: Record<string, string[]> = {
  '.py': ['python'],
  '.pyw': ['python'],
  '.pyx': ['python'],
  '.js': ['javascript'],
  '.jsx': ['javascript'],
  '.mjs': ['javascript'],
  '.cjs': ['javascript'],
  '.ts': ['typescript'],
  '.tsx': ['typescript'],
  '.mts': ['typescript'],
  '.cts': ['typescript'],
  '.go': ['go'],
  '.java': ['java'],
  '.rb': ['ruby'],
  '.erb': ['ruby'],
  '.c': ['c'],
  '.h': ['c', 'cpp'],
  '.cpp': ['cpp'],
  '.cc': ['cpp'],
  '.cxx': ['cpp'],
  '.hpp': ['cpp'],
  '.hxx': ['cpp'],
  '.php': ['php'],
  '.tf': ['terraform'],
  '.hcl': ['terraform'],
  '.yaml': ['kubernetes', 'cloudformation'],
  '.yml': ['kubernetes', 'cloudformation'],
  '.dockerfile': ['docker'],
}

const ALL_REPORTS_ID = '__all__'
const ALL_PROJECTS_ID = '__all_projects__'

function formatDuration(ms: number): string {
  const seconds = (ms / 1000).toFixed(1)
  return seconds
}

function computeGrade(reports: AnalysisReport[]): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  let critical = 0, high = 0, medium = 0
  for (const r of reports) {
    critical += r.summary.critical
    high += r.summary.high
    medium += r.summary.medium
  }
  if (critical === 0 && high === 0 && medium <= 5) return 'A'
  if (critical === 0 && high <= 3 && medium <= 20) return 'B'
  if (critical === 0 && high <= 10) return 'C'
  if (critical <= 3 && high <= 20) return 'D'
  if (critical <= 10) return 'E'
  return 'F'
}

function computeProjectLanguages(stats: ProjectStatsData | null): Set<string> {
  if (!stats) return new Set<string>()
  const langs = new Set<string>()
  for (const entry of stats.fileTypeBreakdown) {
    const ext = entry.ext.startsWith('.') ? entry.ext : `.${entry.ext}`
    const mapped = EXT_TO_LANGUAGES[ext.toLowerCase()]
    if (mapped) {
      for (const lang of mapped) langs.add(lang)
    }
  }
  if (stats.fileTypeBreakdown.some((e) => e.ext === '' || e.ext === 'Dockerfile')) {
    langs.add('docker')
  }
  return langs
}

function filterRelevantTools(tools: AnalysisToolDef[], stats: ProjectStatsData | null, languages: Set<string>): AnalysisToolDef[] {
  if (!stats || languages.size === 0) return tools
  return tools.filter((tool) => {
    if (tool.languages.includes('*')) return true
    return tool.languages.some((lang) => languages.has(lang))
  })
}

export function CodeAnalysisPanel() {
  const { t } = useI18n()
  const { projects } = useWorkspaceStore()
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { openFile } = useViewStore()

  // Multi-project state: Maps keyed by project ID
  const [toolsByProject, setToolsByProject] = useState<Map<string, AnalysisToolDef[]>>(new Map())
  const [reportsByProject, setReportsByProject] = useState<Map<string, AnalysisReport[]>>(new Map())
  const [statsByProject, setStatsByProject] = useState<Map<string, ProjectStatsData>>(new Map())

  // Sidebar selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [activeReportId, setActiveReportId] = useState<string | null>(ALL_REPORTS_ID)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // Running / UI state
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<AnalysisSeverity | 'all'>('all')
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set())
  const [groupBy] = useState<GroupBy>('file')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [ticketGroupBy, setTicketGroupBy] = useState<TicketGroupBy>('individual')
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [detectingTools, setDetectingTools] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Install states
  const [installingTools, setInstallingTools] = useState<Set<string>>(new Set())
  const [installOutput, setInstallOutput] = useState<Record<string, string>>({})
  const [activeInstallTool, setActiveInstallTool] = useState<string | null>(null)
  const [copiedInstallOutput, setCopiedInstallOutput] = useState(false)

  // Finding detail
  const [selectedFinding, setSelectedFinding] = useState<AnalysisFinding | null>(null)
  const [copiedError, setCopiedError] = useState(false)

  const installBufferRef = useRef<HTMLPreElement>(null)

  // All projects in the current workspace
  const workspaceProjects = useMemo(() => {
    if (!activeWorkspaceId) return []
    return projects.filter((p) => p.workspaceId === activeWorkspaceId)
  }, [projects, activeWorkspaceId])

  // The project currently selected in the sidebar (or null for "All")
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === ALL_PROJECTS_ID) return null
    return workspaceProjects.find((p) => p.id === selectedProjectId) ?? null
  }, [workspaceProjects, selectedProjectId])

  // Compute relevant tools per project
  const relevantToolsByProject = useMemo(() => {
    const result = new Map<string, AnalysisToolDef[]>()
    for (const project of workspaceProjects) {
      const tools = toolsByProject.get(project.id) ?? []
      const stats = statsByProject.get(project.id) ?? null
      const languages = computeProjectLanguages(stats)
      result.set(project.id, filterRelevantTools(tools, stats, languages))
    }
    return result
  }, [workspaceProjects, toolsByProject, statsByProject])

  // Current view: tools for selected project or all
  const currentRelevantTools = useMemo(() => {
    if (selectedProjectId && selectedProjectId !== ALL_PROJECTS_ID) {
      return relevantToolsByProject.get(selectedProjectId) ?? []
    }
    // Deduplicate tools across all projects (by tool id)
    const seen = new Set<string>()
    const result: AnalysisToolDef[] = []
    for (const tools of relevantToolsByProject.values()) {
      for (const tool of tools) {
        if (!seen.has(tool.id)) {
          seen.add(tool.id)
          result.push(tool)
        }
      }
    }
    return result
  }, [selectedProjectId, relevantToolsByProject])

  // Reports for the current view
  const currentReports = useMemo(() => {
    if (selectedProjectId && selectedProjectId !== ALL_PROJECTS_ID) {
      return reportsByProject.get(selectedProjectId) ?? []
    }
    // All reports from all projects
    const allReports: AnalysisReport[] = []
    for (const reports of reportsByProject.values()) {
      allReports.push(...reports)
    }
    return allReports
  }, [selectedProjectId, reportsByProject])

  // All reports flattened (for grade computation)
  const allReportsFlat = useMemo(() => {
    const result: AnalysisReport[] = []
    for (const reports of reportsByProject.values()) {
      result.push(...reports)
    }
    return result
  }, [reportsByProject])

  const aggregatedReport = useMemo(() => {
    if (currentReports.length === 0) return null
    const allFindings: AnalysisFinding[] = []
    const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const r of currentReports) {
      allFindings.push(...r.findings)
      summary.total += r.summary.total
      summary.critical += r.summary.critical
      summary.high += r.summary.high
      summary.medium += r.summary.medium
      summary.low += r.summary.low
      summary.info += r.summary.info
    }
    return {
      id: ALL_REPORTS_ID,
      toolId: ALL_REPORTS_ID,
      toolName: t('analysis.allReports'),
      findings: allFindings,
      summary,
      duration: currentReports.reduce((sum, r) => sum + r.duration, 0),
      timestamp: Date.now(),
    } as AnalysisReport
  }, [currentReports, t])

  const activeReport = useMemo(() => {
    if (activeReportId === ALL_REPORTS_ID) return aggregatedReport
    if (!activeReportId) return null
    return currentReports.find((r) => r.id === activeReportId) ?? null
  }, [currentReports, activeReportId, aggregatedReport])

  const projectGrade = useMemo(() => {
    if (allReportsFlat.length === 0) return null
    return computeGrade(allReportsFlat)
  }, [allReportsFlat])

  // Count findings per project (for sidebar badges)
  const findingsCountByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const [projectId, reports] of reportsByProject) {
      let total = 0
      for (const r of reports) total += r.summary.total
      counts.set(projectId, total)
    }
    return counts
  }, [reportsByProject])

  // Detect tools for a single project
  const detectToolsForProject = useCallback(async (project: Project) => {
    try {
      const detected = await window.kanbai.analysis.detectTools(project.path)
      setToolsByProject((prev) => new Map(prev).set(project.id, detected))
    } catch {
      setToolsByProject((prev) => new Map(prev).set(project.id, []))
    }
  }, [])

  // Load reports for a single project
  const loadReportsForProject = useCallback(async (project: Project) => {
    try {
      const loaded = await window.kanbai.analysis.loadReports(project.path)
      if (loaded.length > 0) {
        setReportsByProject((prev) => new Map(prev).set(project.id, loaded))
      }
    } catch {
      // silently fail
    }
  }, [])

  // Load stats for a single project
  const loadStatsForProject = useCallback(async (project: Project) => {
    try {
      const stats = await window.kanbai.project.stats(project.path)
      setStatsByProject((prev) => new Map(prev).set(project.id, stats))
    } catch {
      // silently fail
    }
  }, [])

  // Detect tools and load data for all workspace projects
  const detectAllTools = useCallback(async () => {
    if (workspaceProjects.length === 0) return
    setDetectingTools(true)
    try {
      await Promise.allSettled(
        workspaceProjects.map((project) => detectToolsForProject(project)),
      )
    } finally {
      setDetectingTools(false)
    }
  }, [workspaceProjects, detectToolsForProject])

  // Load all data on workspace change
  useEffect(() => {
    if (workspaceProjects.length === 0) return

    // Load tools, stats, and reports for all projects
    setDetectingTools(true)
    const loadAll = async () => {
      try {
        await Promise.allSettled([
          ...workspaceProjects.map((p) => detectToolsForProject(p)),
          ...workspaceProjects.map((p) => loadStatsForProject(p)),
          ...workspaceProjects.map((p) => loadReportsForProject(p)),
        ])
      } finally {
        setDetectingTools(false)
      }
    }
    loadAll()

    // Reset selection state but keep data
    setActiveReportId(ALL_REPORTS_ID)
    setSelectedProjectId(null)
    setSelectedFindings(new Set())
    setInstallOutput({})
    setActiveInstallTool(null)
    setInstallingTools(new Set())
    setSelectedFinding(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load on workspace change only
  }, [activeWorkspaceId])

  // Subscribe to progress events
  useEffect(() => {
    const unsubscribe = window.kanbai.analysis.onProgress((data: AnalysisProgress) => {
      if (data.status === 'running') {
        setRunningTools((prev) => new Set(prev).add(data.toolId))
      } else {
        setRunningTools((prev) => {
          const next = new Set(prev)
          next.delete(data.toolId)
          return next
        })
      }
    })
    return unsubscribe
  }, [])

  // Subscribe to install progress events
  useEffect(() => {
    const unsub = window.kanbai.analysis.onInstallProgress((data) => {
      setInstallOutput((prev) => ({
        ...prev,
        [data.toolId]: (prev[data.toolId] || '') + data.output,
      }))
    })
    return unsub
  }, [])

  // Auto-scroll install buffer
  useEffect(() => {
    if (installBufferRef.current) {
      installBufferRef.current.scrollTop = installBufferRef.current.scrollHeight
    }
  }, [installOutput, activeInstallTool])

  // Copy error to clipboard
  const copyError = useCallback(() => {
    if (!activeReport?.error) return
    navigator.clipboard.writeText(activeReport.error)
    setCopiedError(true)
    setTimeout(() => setCopiedError(false), 2000)
  }, [activeReport])

  // Copy install output to clipboard
  const copyInstallOutput = useCallback(() => {
    if (!activeInstallTool || !installOutput[activeInstallTool]) return
    navigator.clipboard.writeText(installOutput[activeInstallTool])
    setCopiedInstallOutput(true)
    setTimeout(() => setCopiedInstallOutput(false), 2000)
  }, [activeInstallTool, installOutput])

  // Install a tool
  const installTool = useCallback(async (toolId: string) => {
    setInstallingTools((prev) => new Set(prev).add(toolId))
    setInstallOutput((prev) => ({ ...prev, [toolId]: '' }))
    setActiveInstallTool(toolId)
    try {
      const result = await window.kanbai.analysis.installTool(toolId)
      if (result.installed) {
        detectAllTools()
        setToastMessage(t('analysis.installSuccess'))
        setTimeout(() => setToastMessage(null), 3000)
      } else if (result.error) {
        setToastMessage(t('analysis.installError'))
        setTimeout(() => setToastMessage(null), 3000)
      }
    } catch {
      setToastMessage(t('analysis.installError'))
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setInstallingTools((prev) => {
        const n = new Set(prev)
        n.delete(toolId)
        return n
      })
    }
  }, [detectAllTools, t])

  // Run a tool on a specific project
  const runToolForProject = useCallback(async (project: Project, toolId: string) => {
    setActiveInstallTool(null)
    setRunningTools((prev) => new Set(prev).add(`${project.id}:${toolId}`))
    try {
      const report = await window.kanbai.analysis.run({
        projectPath: project.path,
        toolId,
      })
      setReportsByProject((prev) => {
        const next = new Map(prev)
        const existing = next.get(project.id) ?? []
        const filtered = existing.filter((r) => r.toolId !== toolId)
        next.set(project.id, [...filtered, report])
        return next
      })
      setActiveReportId(report.id)
    } catch {
      // error handled by progress events
    } finally {
      setRunningTools((prev) => {
        const next = new Set(prev)
        next.delete(`${project.id}:${toolId}`)
        return next
      })
    }
  }, [])

  // Cancel a running tool
  const cancelTool = useCallback(async (toolId: string) => {
    try {
      await window.kanbai.analysis.cancel(toolId)
      setRunningTools((prev) => {
        const next = new Set(prev)
        // Remove all entries matching this toolId
        for (const key of next) {
          if (key === toolId || key.endsWith(`:${toolId}`)) {
            next.delete(key)
          }
        }
        return next
      })
    } catch {
      // silently fail
    }
  }, [])

  // Delete a report
  const deleteReport = useCallback(async (reportId: string) => {
    // Find which project owns this report
    for (const [projectId, reports] of reportsByProject) {
      const report = reports.find((r) => r.id === reportId)
      if (report) {
        const project = workspaceProjects.find((p) => p.id === projectId)
        if (!project) return
        try {
          await window.kanbai.analysis.deleteReport(project.path, reportId)
          setReportsByProject((prev) => {
            const next = new Map(prev)
            const existing = next.get(projectId) ?? []
            next.set(projectId, existing.filter((r) => r.id !== reportId))
            return next
          })
          if (activeReportId === reportId) {
            setActiveReportId(ALL_REPORTS_ID)
          }
        } catch {
          // silently fail
        }
        return
      }
    }
  }, [reportsByProject, workspaceProjects, activeReportId])

  // Run all installed relevant tools on ALL workspace projects
  const runAll = useCallback(async () => {
    const promises = workspaceProjects.flatMap((project) => {
      const tools = relevantToolsByProject.get(project.id) ?? []
      return tools
        .filter((tool) => tool.installed)
        .map((tool) => runToolForProject(project, tool.id))
    })
    await Promise.allSettled(promises)
    setActiveReportId(ALL_REPORTS_ID)
    setSelectedProjectId(null)
  }, [workspaceProjects, relevantToolsByProject, runToolForProject])

  // Run all tools for a specific project
  const runAllForProject = useCallback(async (project: Project) => {
    const tools = relevantToolsByProject.get(project.id) ?? []
    const installed = tools.filter((tool) => tool.installed)
    await Promise.allSettled(installed.map((tool) => runToolForProject(project, tool.id)))
    setSelectedProjectId(project.id)
    setActiveReportId(ALL_REPORTS_ID)
  }, [relevantToolsByProject, runToolForProject])

  // Re-analyze current report or all reports
  const reanalyze = useCallback(async () => {
    if (activeReportId === ALL_REPORTS_ID) {
      if (selectedProjectId && selectedProjectId !== ALL_PROJECTS_ID) {
        const project = workspaceProjects.find((p) => p.id === selectedProjectId)
        if (project) await runAllForProject(project)
      } else {
        await runAll()
      }
    } else {
      const report = currentReports.find((r) => r.id === activeReportId)
      if (report) {
        // Find which project owns this report and run on that project
        for (const [projectId, reports] of reportsByProject) {
          if (reports.some((r) => r.id === activeReportId)) {
            const project = workspaceProjects.find((p) => p.id === projectId)
            if (project) await runToolForProject(project, report.toolId)
            break
          }
        }
      }
    }
  }, [activeReportId, selectedProjectId, currentReports, reportsByProject, workspaceProjects, runAll, runAllForProject, runToolForProject])

  // Filtered findings
  const filteredFindings = useMemo(() => {
    if (!activeReport) return []
    if (severityFilter === 'all') return activeReport.findings
    return activeReport.findings.filter((f) => f.severity === severityFilter)
  }, [activeReport, severityFilter])

  // Grouped findings
  const grouped = useMemo(() => {
    const groups: Record<string, AnalysisFinding[]> = {}
    for (const finding of filteredFindings) {
      let key: string
      if (groupBy === 'file') {
        // When showing all projects, prefix with project name
        if (!selectedProjectId || selectedProjectId === ALL_PROJECTS_ID) {
          const ownerProject = findProjectForFinding(finding, reportsByProject, workspaceProjects)
          const prefix = ownerProject ? `${ownerProject.name}/` : ''
          key = prefix + finding.file
        } else {
          key = finding.file
        }
      } else if (groupBy === 'rule') {
        key = finding.rule || '(no rule)'
      } else {
        key = finding.severity
      }
      if (!groups[key]) groups[key] = []
      groups[key]!.push(finding)
    }
    const entries = Object.entries(groups)
    if (groupBy === 'severity') {
      entries.sort(([a], [b]) => {
        return SEVERITY_ORDER.indexOf(a as AnalysisSeverity) - SEVERITY_ORDER.indexOf(b as AnalysisSeverity)
      })
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b))
    }
    return entries
  }, [filteredFindings, groupBy, selectedProjectId, reportsByProject, workspaceProjects])

  // Toggle group collapse
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }, [])

  // Toggle project collapse in sidebar
  const toggleProjectCollapse = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  // Toggle finding selection
  const toggleFinding = useCallback((findingId: string) => {
    setSelectedFindings((prev) => {
      const next = new Set(prev)
      if (next.has(findingId)) {
        next.delete(findingId)
      } else {
        next.add(findingId)
      }
      return next
    })
  }, [])

  // Select / deselect all visible
  const selectAll = useCallback(() => {
    setSelectedFindings(new Set(filteredFindings.map((f) => f.id)))
  }, [filteredFindings])

  const deselectAll = useCallback(() => {
    setSelectedFindings(new Set())
  }, [])

  // Handle click on finding row (show detail)
  const handleClickFinding = useCallback((finding: AnalysisFinding) => {
    setSelectedFinding((prev) => prev?.id === finding.id ? null : finding)
  }, [])

  // Handle click on file link (navigate to file)
  const handleNavigateToFile = useCallback(
    (finding: AnalysisFinding) => {
      // Find the project that owns this finding
      const ownerProject = selectedProject ?? findProjectForFinding(finding, reportsByProject, workspaceProjects)
      if (!ownerProject) return
      const fullPath = ownerProject.path + '/' + finding.file
      openFile(fullPath, finding.line)
    },
    [selectedProject, reportsByProject, workspaceProjects, openFile],
  )

  // Ticket preview count
  const ticketPreviewCount = useMemo(() => {
    if (selectedFindings.size === 0) return 0
    if (ticketGroupBy === 'individual') return selectedFindings.size
    const selected = filteredFindings.filter((f) => selectedFindings.has(f.id))
    const keys = new Set<string>()
    for (const f of selected) {
      if (ticketGroupBy === 'file') keys.add(f.file)
      else if (ticketGroupBy === 'rule') keys.add(f.rule || '(no rule)')
      else keys.add(f.severity)
    }
    return keys.size
  }, [selectedFindings, ticketGroupBy, filteredFindings])

  // Create tickets
  const handleCreateTickets = useCallback(async () => {
    if (!activeReport || !activeWorkspaceId) return
    try {
      if (activeReportId === ALL_REPORTS_ID) {
        // Group findings by source report
        const findingToReport = new Map<string, string>()
        for (const reports of reportsByProject.values()) {
          for (const r of reports) {
            for (const f of r.findings) {
              findingToReport.set(f.id, r.id)
            }
          }
        }
        const groupedByReport = new Map<string, string[]>()
        for (const fid of selectedFindings) {
          const rid = findingToReport.get(fid)
          if (rid) {
            if (!groupedByReport.has(rid)) groupedByReport.set(rid, [])
            groupedByReport.get(rid)!.push(fid)
          }
        }
        let totalTickets = 0
        for (const [reportId, findingIds] of groupedByReport) {
          const result = await window.kanbai.analysis.createTickets({
            findingIds,
            reportId,
            workspaceId: activeWorkspaceId,
            priority: ticketPriority,
            groupBy: ticketGroupBy,
          })
          if (result.success) totalTickets += result.ticketCount
        }
        setShowTicketModal(false)
        setSelectedFindings(new Set())
        setToastMessage(t('analysis.ticketsCreatedReanalyze', { count: String(totalTickets) }))
        setTimeout(() => setToastMessage(null), 5000)
      } else {
        const result = await window.kanbai.analysis.createTickets({
          findingIds: Array.from(selectedFindings),
          reportId: activeReport.id,
          workspaceId: activeWorkspaceId,
          priority: ticketPriority,
          groupBy: ticketGroupBy,
        })
        if (result.success) {
          setShowTicketModal(false)
          setSelectedFindings(new Set())
          setToastMessage(t('analysis.ticketsCreatedReanalyze', { count: String(result.ticketCount) }))
          setTimeout(() => setToastMessage(null), 5000)
        }
      }
    } catch {
      // silently fail
    }
  }, [activeReport, activeReportId, activeWorkspaceId, reportsByProject, selectedFindings, ticketPriority, ticketGroupBy, t])

  // Is a tool running for a given project?
  const isToolRunningForProject = useCallback((projectId: string, toolId: string) => {
    return runningTools.has(`${projectId}:${toolId}`)
  }, [runningTools])

  const installedCount = currentRelevantTools.filter((tool) => tool.installed).length
  const isAnyRunning = runningTools.size > 0

  // Name of the currently running tool (for display in content area)
  const runningToolName = useMemo(() => {
    if (runningTools.size === 0) return null
    const firstRunningKey = runningTools.values().next().value as string
    const toolId = firstRunningKey.includes(':') ? firstRunningKey.split(':')[1]! : firstRunningKey
    const tool = currentRelevantTools.find((t) => t.id === toolId)
    return tool?.name ?? toolId
  }, [runningTools, currentRelevantTools])

  // Total findings across all projects
  const totalFindingsAllProjects = useMemo(() => {
    let total = 0
    for (const reports of reportsByProject.values()) {
      for (const r of reports) total += r.summary.total
    }
    return total
  }, [reportsByProject])

  if (workspaceProjects.length === 0) {
    return <div className="analysis-panel-empty">{t('analysis.noProject')}</div>
  }

  return (
    <div className="analysis-panel">
      {/* Header */}
      <div className="analysis-header">
        <h3>{t('analysis.title')}</h3>
        {activeReport && (
          <span className="analysis-header-count">
            {activeReport.summary.total} {t('analysis.findings')}
          </span>
        )}
        {projectGrade && (
          <span className="analysis-grade-badge" data-grade={projectGrade}>
            {projectGrade}
          </span>
        )}
        <button
          className="analysis-refresh-btn"
          onClick={detectAllTools}
          disabled={detectingTools}
          title={t('common.refresh')}
        >
          {detectingTools ? '...' : '\u21BB'}
        </button>
      </div>

      {/* Panel body: sidebar + content */}
      <div className="analysis-panel-body">
        {/* Sidebar */}
        <div className="analysis-sidebar">
          <div className="analysis-sidebar-header">
            <span>{t('analysis.projects')}</span>
          </div>

          {/* Run All button at top */}
          {workspaceProjects.length > 0 && (
            <button
              className="analysis-run-all-btn analysis-run-all-btn--top"
              onClick={runAll}
              disabled={isAnyRunning}
            >
              {isAnyRunning ? t('analysis.running') : `\u25B6 ${t('analysis.runAllProjects')}`}
            </button>
          )}

          <div className="analysis-sidebar-list">
            {detectingTools && toolsByProject.size === 0 && (
              <div className="analysis-loading">
                <span className="analysis-spinner" />
                {t('analysis.detectingTools')}
              </div>
            )}

            {/* Project tree */}
            {workspaceProjects.map((project) => {
              const projectTools = relevantToolsByProject.get(project.id) ?? []
              const projectReports = reportsByProject.get(project.id) ?? []
              const reportsByToolForProject = new Map<string, AnalysisReport>()
              for (const r of projectReports) reportsByToolForProject.set(r.toolId, r)
              const isCollapsed = collapsedProjects.has(project.id)
              const projectFindingsCount = findingsCountByProject.get(project.id) ?? 0
              const isProjectSelected = selectedProjectId === project.id && activeReportId === ALL_REPORTS_ID

              return (
                <div key={project.id} className="analysis-project-node">
                  {/* Project header */}
                  <div
                    className={`analysis-project-header${isProjectSelected ? ' analysis-project-header--active' : ''}`}
                    onClick={() => {
                      setSelectedProjectId(project.id)
                      setActiveReportId(ALL_REPORTS_ID)
                      setSelectedFinding(null)
                    }}
                  >
                    <button
                      className="analysis-project-chevron"
                      onClick={(e) => { e.stopPropagation(); toggleProjectCollapse(project.id) }}
                    >
                      <span style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', display: 'inline-block', transition: 'transform 0.15s ease', fontSize: '8px' }}>
                        {'\u25B6'}
                      </span>
                    </button>
                    <span className="analysis-project-name">{project.name}</span>
                    {projectFindingsCount > 0 && (
                      <span className="analysis-tool-count">{projectFindingsCount}</span>
                    )}
                    <button
                      className="analysis-project-run-btn"
                      onClick={(e) => { e.stopPropagation(); runAllForProject(project) }}
                      disabled={isAnyRunning}
                      title={t('analysis.runAll')}
                    >
                      {'\u25B6'}
                    </button>
                  </div>

                  {/* Tools under this project */}
                  {!isCollapsed && (
                    <div className="analysis-project-tools">
                      {projectTools.length === 0 && !detectingTools && (
                        <div className="analysis-project-tools-empty">
                          {t('analysis.notRelevant')}
                        </div>
                      )}
                      {projectTools.map((tool) => {
                        const toolReport = reportsByToolForProject.get(tool.id)
                        const isToolActive = selectedProjectId === project.id && activeReportId !== ALL_REPORTS_ID && toolReport?.id === activeReportId
                        const isRunning = isToolRunningForProject(project.id, tool.id) || runningTools.has(tool.id)

                        return (
                          <div
                            key={tool.id}
                            className={`analysis-tool-item analysis-tool-item--nested${isToolActive ? ' analysis-tool-item--active' : ''}`}
                            onClick={() => {
                              if (toolReport) {
                                setSelectedProjectId(project.id)
                                setActiveReportId(toolReport.id)
                                setSelectedFinding(null)
                              }
                            }}
                            style={toolReport ? { cursor: 'pointer' } : undefined}
                          >
                            <span className="analysis-tool-category-dot" data-category={tool.category} />
                            <span className="analysis-tool-name">{tool.name}</span>
                            {toolReport && (
                              <span className="analysis-tool-count">{toolReport.summary.total}</span>
                            )}
                            {tool.installed ? (
                              isRunning ? (
                                <button
                                  className="analysis-tool-cancel-btn"
                                  onClick={(e) => { e.stopPropagation(); cancelTool(tool.id) }}
                                  title={t('common.cancel')}
                                >
                                  {'\u25A0'}
                                </button>
                              ) : (
                                <button
                                  className="analysis-tool-run-btn"
                                  onClick={(e) => { e.stopPropagation(); runToolForProject(project, tool.id) }}
                                  title={t('analysis.runAll')}
                                >
                                  {'\u25B6'}
                                </button>
                              )
                            ) : installingTools.has(tool.id) ? (
                              <span className="analysis-tool-installing-spinner" />
                            ) : (
                              <button
                                className="analysis-tool-install-btn"
                                onClick={(e) => { e.stopPropagation(); installTool(tool.id) }}
                                title={t('analysis.installButton')}
                              >
                                {'\u2B07'} {t('analysis.installButton')}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* "All" entry at bottom */}
            {allReportsFlat.length > 0 && (
              <div
                className={`analysis-tool-item analysis-tool-item--tous${!selectedProjectId || selectedProjectId === ALL_PROJECTS_ID ? (activeReportId === ALL_REPORTS_ID ? ' analysis-tool-item--active' : '') : ''}`}
                onClick={() => {
                  setSelectedProjectId(null)
                  setActiveReportId(ALL_REPORTS_ID)
                  setSelectedFinding(null)
                }}
              >
                <span className="analysis-tool-name">{t('common.all')}</span>
                {totalFindingsAllProjects > 0 && (
                  <span className="analysis-tool-count">{totalFindingsAllProjects}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="analysis-content">
          {/* Install buffer view */}
          {activeInstallTool && (
            <div className="analysis-install-buffer">
              <div className="analysis-install-buffer-header">
                <span>
                  {installingTools.has(activeInstallTool)
                    ? t('analysis.installing')
                    : t('analysis.installButton')}
                  {' '}{activeInstallTool}
                </span>
                <div className="analysis-install-buffer-actions">
                  <button
                    className={`analysis-install-buffer-copy${copiedInstallOutput ? ' analysis-install-buffer-copy--copied' : ''}`}
                    onClick={copyInstallOutput}
                    title={t('common.copy')}
                  >
                    {copiedInstallOutput ? '\u2713' : '\u2398'}
                  </button>
                  <button
                    className="analysis-install-buffer-close"
                    onClick={() => setActiveInstallTool(null)}
                  >
                    {'\u00D7'}
                  </button>
                </div>
              </div>
              <pre ref={installBufferRef}>
                {installOutput[activeInstallTool] || t('analysis.installing')}
              </pre>
            </div>
          )}

          {/* Reports view (when not viewing install buffer) */}
          {!activeInstallTool && (
            <>
              {/* Running indicator */}
              {isAnyRunning && (
                <div className="analysis-running-indicator">
                  <span className="analysis-spinner" />
                  <span>{t('analysis.runningTool', { tool: runningToolName ?? '' })}</span>
                </div>
              )}

              {/* Empty state: no reports yet, nothing running — central launch button */}
              {allReportsFlat.length === 0 && !isAnyRunning && (
                <div className="analysis-content-empty">
                  <span className="analysis-content-empty-icon">{'\u{1F50D}'}</span>
                  <span>{t('analysis.emptyTitle')}</span>
                  <span className="analysis-content-empty-hint">{t('analysis.emptyHint')}</span>
                  {installedCount > 0 && (
                    <button
                      className="analysis-launch-btn"
                      onClick={runAll}
                    >
                      {'\u25B6'} {t('analysis.launchAnalysis')}
                    </button>
                  )}
                </div>
              )}

              {/* Success state: individual report with 0 findings and nothing running */}
              {activeReport && activeReportId !== ALL_REPORTS_ID && activeReport.summary.total === 0 && !activeReport.error && !isAnyRunning && (
                <div className="analysis-success-message">
                  <span className="analysis-success-icon">{'\u2713'}</span>
                  <span>{t('analysis.allClear')}</span>
                </div>
              )}

              {currentReports.length > 0 && (
                <div className="analysis-reports">
                  {activeReport && (
                    <>
                      {/* Grade panel for All view */}
                      {activeReportId === ALL_REPORTS_ID && projectGrade && (
                        <div className="analysis-grade-panel">
                          <span className="analysis-grade-large" data-grade={projectGrade}>
                            {projectGrade}
                          </span>
                          <div className="analysis-grade-info">
                            <span className="analysis-grade-label">{t('analysis.projectGrade')}</span>
                            <span className="analysis-grade-detail">
                              {aggregatedReport?.summary.critical ?? 0} critical {'\u00B7'} {aggregatedReport?.summary.high ?? 0} high {'\u00B7'} {aggregatedReport?.summary.medium ?? 0} medium
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Error display */}
                      {activeReport.error && (
                        <div className="analysis-report-error">
                          <span className="analysis-report-error-text">
                            {t('analysis.error')}: {activeReport.error}
                          </span>
                          <button
                            className={`analysis-report-error-copy${copiedError ? ' analysis-report-error-copy--copied' : ''}`}
                            onClick={copyError}
                            title={t('common.copy')}
                          >
                            {copiedError ? '\u2713' : '\u2398'}
                          </button>
                        </div>
                      )}

                      {/* Duration + Re-analyze */}
                      {activeReport.duration > 0 && (
                        <span className="analysis-report-duration">
                          {t('analysis.duration')}: {formatDuration(activeReport.duration)} {t('analysis.seconds')}
                        </span>
                      )}
                      {!isAnyRunning && (
                        <button
                          className="analysis-reanalyze-btn"
                          onClick={reanalyze}
                        >
                          {'\u21BB'} {t('analysis.reanalyze')}
                        </button>
                      )}

                      {/* Summary badges */}
                      <div className="analysis-summary">
                        <button
                          className={`analysis-severity-badge${severityFilter === 'all' ? ' analysis-severity-badge--active' : ''}`}
                          data-severity="all"
                          onClick={() => setSeverityFilter('all')}
                        >
                          {t('common.all')} {activeReport.summary.total}
                        </button>
                        {SEVERITY_ORDER.map((sev) => {
                          const count = activeReport.summary[sev]
                          if (count === 0) return null
                          return (
                            <button
                              key={sev}
                              className={`analysis-severity-badge${severityFilter === sev ? ' analysis-severity-badge--active' : ''}`}
                              data-severity={sev}
                              onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
                            >
                              {sev} {count}
                            </button>
                          )
                        })}
                      </div>

                      {/* Findings list */}
                      <div className="analysis-findings">
                        {filteredFindings.length === 0 && (
                          <div className="analysis-findings-empty">{t('analysis.noFindings')}</div>
                        )}
                        {grouped.map(([group, items]) => (
                          <div key={group} className="analysis-group">
                            <button
                              className="analysis-group-header"
                              onClick={() => toggleGroup(group)}
                            >
                              <span
                                className="analysis-group-chevron"
                                style={{ transform: collapsedGroups.has(group) ? 'rotate(0deg)' : 'rotate(90deg)' }}
                              >
                                {'\u25B6'}
                              </span>
                              <span className="analysis-group-name">{group}</span>
                              <span className="analysis-group-count">{items.length}</span>
                            </button>
                            {!collapsedGroups.has(group) && (
                              <div className="analysis-entries">
                                {items.map((finding) => (
                                  <div key={finding.id}>
                                    <div
                                      className={`analysis-entry${selectedFinding?.id === finding.id ? ' analysis-entry--selected' : ''}`}
                                      onClick={() => handleClickFinding(finding)}
                                    >
                                      <input
                                        type="checkbox"
                                        className="analysis-entry-checkbox"
                                        checked={selectedFindings.has(finding.id)}
                                        onChange={() => toggleFinding(finding.id)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span
                                        className="analysis-entry-severity"
                                        data-severity={finding.severity}
                                      >
                                        {finding.severity}
                                      </span>
                                      <button
                                        className="analysis-entry-location"
                                        onClick={(e) => { e.stopPropagation(); handleNavigateToFile(finding) }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                      >
                                        {finding.file}:{finding.line}
                                      </button>
                                      <span className="analysis-entry-message">{finding.message}</span>
                                      {finding.rule && (
                                        <span className="analysis-entry-rule">{finding.rule}</span>
                                      )}
                                    </div>
                                    {selectedFinding?.id === finding.id && (
                                      <div className="analysis-finding-detail">
                                        <div className="analysis-finding-detail-row">
                                          <span className="analysis-finding-detail-label">{t('analysis.detailSeverity')}</span>
                                          <span className="analysis-entry-severity" data-severity={finding.severity}>
                                            {finding.severity}
                                          </span>
                                        </div>
                                        <div className="analysis-finding-detail-row">
                                          <span className="analysis-finding-detail-label">{t('analysis.detailFile')}</span>
                                          <button
                                            className="analysis-finding-detail-link"
                                            onClick={() => handleNavigateToFile(finding)}
                                          >
                                            {finding.file}:{finding.line}
                                            {finding.column ? `:${finding.column}` : ''}
                                            {finding.endLine ? ` - ${finding.endLine}${finding.endColumn ? `:${finding.endColumn}` : ''}` : ''}
                                          </button>
                                        </div>
                                        <div className="analysis-finding-detail-row">
                                          <span className="analysis-finding-detail-label">{t('analysis.detailMessage')}</span>
                                          <span className="analysis-finding-detail-value">{finding.message}</span>
                                        </div>
                                        {finding.rule && (
                                          <div className="analysis-finding-detail-row">
                                            <span className="analysis-finding-detail-label">{t('analysis.detailRule')}</span>
                                            <span className="analysis-finding-detail-value">
                                              {finding.ruleUrl ? (
                                                <button
                                                  className="analysis-finding-detail-link"
                                                  onClick={() => finding.ruleUrl && window.open(finding.ruleUrl)}
                                                >
                                                  {finding.rule}
                                                </button>
                                              ) : finding.rule}
                                            </span>
                                          </div>
                                        )}
                                        {finding.cwe && (
                                          <div className="analysis-finding-detail-row">
                                            <span className="analysis-finding-detail-label">CWE</span>
                                            <span className="analysis-finding-detail-value">{finding.cwe}</span>
                                          </div>
                                        )}
                                        {finding.snippet && (
                                          <div className="analysis-finding-detail-snippet">
                                            <span className="analysis-finding-detail-label">{t('analysis.detailSnippet')}</span>
                                            <pre>{finding.snippet}</pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      {activeReport.summary.total > 0 && (
                        <div className="analysis-footer">
                          <div className="analysis-footer-left">
                            <div className="analysis-select-btns">
                              <button className="analysis-select-btn" onClick={selectAll}>
                                {t('analysis.selectAll')}
                              </button>
                              <button className="analysis-select-btn" onClick={deselectAll}>
                                {t('analysis.deselectAll')}
                              </button>
                            </div>
                            <span className="analysis-footer-count">
                              {t('analysis.selectedFindings', { count: String(selectedFindings.size) })}
                            </span>
                          </div>
                          <div className="analysis-footer-right">
                            {activeReportId !== ALL_REPORTS_ID && (
                              <button
                                className="analysis-delete-report-btn"
                                onClick={() => deleteReport(activeReport.id)}
                                title={t('common.delete')}
                              >
                                {'\u00D7'}
                              </button>
                            )}
                            <button
                              className="analysis-create-tickets-btn"
                              disabled={selectedFindings.size === 0}
                              onClick={() => setShowTicketModal(true)}
                            >
                              {t('analysis.createTickets')}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ticket creation modal */}
      {showTicketModal && (
        <div className="analysis-modal-overlay" onClick={() => setShowTicketModal(false)}>
          <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="analysis-modal-header">
              <h3>{t('analysis.createTickets')}</h3>
              <button className="analysis-modal-close" onClick={() => setShowTicketModal(false)}>
                {'\u00D7'}
              </button>
            </div>
            <div className="analysis-modal-body">
              <div className="analysis-modal-field">
                <span className="analysis-modal-label">
                  {t('analysis.selectedFindings', { count: String(selectedFindings.size) })}
                </span>
              </div>

              <div className="analysis-modal-field">
                <span className="analysis-modal-label">{t('analysis.ticketGroupBy')}</span>
                <select
                  className="analysis-modal-select"
                  value={ticketGroupBy}
                  onChange={(e) => setTicketGroupBy(e.target.value as TicketGroupBy)}
                >
                  <option value="individual">{t('analysis.ticketGroupIndividual')}</option>
                  <option value="file">{t('analysis.ticketGroupFile')}</option>
                  <option value="rule">{t('analysis.ticketGroupRule')}</option>
                  <option value="severity">{t('analysis.ticketGroupSeverity')}</option>
                </select>
              </div>

              <div className="analysis-modal-field">
                <span className="analysis-modal-label">{t('analysis.ticketPriority')}</span>
                <select
                  className="analysis-modal-select"
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">{t('kanban.low')}</option>
                  <option value="medium">{t('kanban.medium')}</option>
                  <option value="high">{t('kanban.high')}</option>
                </select>
              </div>

              <div className="analysis-modal-preview">
                {t('analysis.ticketPreview', { count: String(ticketPreviewCount) })}
              </div>
            </div>
            <div className="analysis-modal-actions">
              <button className="analysis-modal-cancel" onClick={() => setShowTicketModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="analysis-modal-submit"
                disabled={selectedFindings.size === 0}
                onClick={handleCreateTickets}
              >
                {t('analysis.createButton', { count: String(ticketPreviewCount) })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toastMessage && (
        <div className="analysis-toast">{toastMessage}</div>
      )}
    </div>
  )
}

/** Find which project owns a given finding by searching through all reports */
function findProjectForFinding(
  finding: AnalysisFinding,
  reportsByProject: Map<string, AnalysisReport[]>,
  workspaceProjects: Project[],
): Project | null {
  for (const [projectId, reports] of reportsByProject) {
    for (const r of reports) {
      if (r.findings.some((f) => f.id === finding.id)) {
        return workspaceProjects.find((p) => p.id === projectId) ?? null
      }
    }
  }
  return null
}
