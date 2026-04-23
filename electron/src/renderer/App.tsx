import { useMemo, useState, useCallback, useEffect } from 'react'
import { Sidebar, type PanelId } from './components/Sidebar'
import { FileChangeBanner } from './components/FileChangeBanner'
import { TrackerPanel } from './components/TrackerPanel'
import { SplitPaneLayout } from './components/SplitPaneLayout'
import { ReportViewer } from './components/ReportViewer'
import { ReportsPanel } from './components/ReportsPanel'
import { PipelinePanel } from './components/PipelinePanel'
import { EvaluatePanel } from './components/EvaluatePanel'
import { CvPanel } from './components/CvPanel'
import { DiscoverPanel } from './components/DiscoverPanel'
import { SettingsSlideOver } from './components/SettingsSlideOver'
import { OperationsLogDrawer } from './components/OperationsLogDrawer'
import { useApiKeyState } from './hooks/useApiKeyState'
import { useOperationsLog } from './hooks/useOperationsLog'

function basename(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx >= 0 ? p.slice(idx + 1) : p
}

export function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('tracker')
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filesChanged, setFilesChanged] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [openReportPath, setOpenReportPath] = useState<string | null>(null)

  const apiKey = useApiKeyState()
  const ops = useOperationsLog()

  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => setFilesChanged(true))
    return unsub
  }, [])

  const handleRefresh = useCallback(() => {
    setFilesChanged(false)
    setRefreshKey(k => k + 1)
  }, [])

  const scanActive = useMemo(
    () => ops.ops.some((o) => o.kind === 'scan' && o.endedAt === null),
    [ops.ops],
  )
  const batchActive = useMemo(
    () => ops.ops.some((o) => o.kind === 'batch' && o.endedAt === null),
    [ops.ops],
  )
  const scrapeActive = useMemo(
    () => ops.ops.some((o) => o.kind === 'scrape' && o.endedAt === null),
    [ops.ops],
  )

  const handleOpenReport = useCallback((path: string) => {
    setOpenReportPath(path)
  }, [])

  const handleCloseReport = useCallback(() => {
    setOpenReportPath(null)
  }, [])

  const handleRunScan = useCallback(async () => {
    await window.api.runScan()
  }, [])

  const handleRunBatch = useCallback(async () => {
    const result = await window.api.runBatch()
    if (result.error === 'no-api-key') {
      setSettingsOpen(true)
    }
  }, [])

  const handleRunScrape = useCallback(async () => {
    const result = await window.api.runVcScrape()
    if (result.error) {
      // benign — scrape already in progress, or backend busy. Log via console; UI's
      // OperationsLogDrawer will surface stdout/stderr on the active run anyway.
      console.warn('[discover] runVcScrape:', result.error)
    }
  }, [])

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false)
    void apiKey.refresh()
  }, [apiKey])

  const renderPanel = () => {
    switch (activePanel) {
      case 'tracker':
        return openReportPath ? (
          <SplitPaneLayout
            left={<TrackerPanel refreshKey={refreshKey} onOpenReport={handleOpenReport} />}
            right={<ReportViewer path={openReportPath} refreshKey={refreshKey} />}
            rightTitle={basename(openReportPath)}
            onClose={handleCloseReport}
          />
        ) : (
          <TrackerPanel refreshKey={refreshKey} onOpenReport={handleOpenReport} />
        )
      case 'pipeline':
        return (
          <PipelinePanel
            refreshKey={refreshKey}
            onRunScan={handleRunScan}
            onRunBatch={handleRunBatch}
            scanActive={scanActive}
            batchActive={batchActive}
            hasApiKey={apiKey.hasKey}
          />
        )
      case 'reports':
        return openReportPath ? (
          <SplitPaneLayout
            left={<ReportsPanel refreshKey={refreshKey} />}
            right={<ReportViewer path={openReportPath} refreshKey={refreshKey} />}
            rightTitle={basename(openReportPath)}
            onClose={handleCloseReport}
          />
        ) : (
          <ReportsPanel refreshKey={refreshKey} />
        )
      case 'evaluate':
        return (
          <EvaluatePanel
            hasKey={apiKey.hasKey}
            backendWarning={apiKey.backendWarning}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )
      case 'cv':
        return <CvPanel />
      case 'discover':
        return (
          <DiscoverPanel
            refreshKey={refreshKey}
            scrapeActive={scrapeActive}
            onRunScrape={handleRunScrape}
          />
        )
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-ctp-base text-ctp-text">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activePanel={activePanel}
          onSelect={setActivePanel}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex-1 flex flex-col min-w-0">
          <FileChangeBanner visible={filesChanged} onRefresh={handleRefresh} />
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderPanel()}
          </div>
        </main>
      </div>
      <OperationsLogDrawer
        ops={ops.ops}
        lines={ops.lines}
        hasActive={ops.hasActive}
        lastCleanExitAt={ops.lastCleanExitAt}
        onClear={ops.clear}
      />
      <SettingsSlideOver
        open={settingsOpen}
        onClose={handleSettingsClose}
      />
    </div>
  )
}
