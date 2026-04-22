import { useEffect, useState, useCallback } from 'react'
import { Sidebar, PanelId } from './components/Sidebar'
import { FileChangeBanner } from './components/FileChangeBanner'
import { EmptyState } from './components/EmptyState'
import { TrackerPanel } from './components/TrackerPanel'
import { SplitPaneLayout } from './components/SplitPaneLayout'

function basename(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx >= 0 ? p.slice(idx + 1) : p
}

export function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('tracker')
  const [collapsed, setCollapsed] = useState(false)
  const [filesChanged, setFilesChanged] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [openReportPath, setOpenReportPath] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => setFilesChanged(true))
    return unsub
  }, [])

  const handleRefresh = useCallback(() => {
    setFilesChanged(false)
    setRefreshKey(k => k + 1)
  }, [])

  const handleOpenReport = useCallback((path: string) => {
    setOpenReportPath(path)
  }, [])

  const handleCloseReport = useCallback(() => {
    setOpenReportPath(null)
  }, [])

  const trackerView = openReportPath
    ? (
      <SplitPaneLayout
        left={<TrackerPanel refreshKey={refreshKey} onOpenReport={handleOpenReport} />}
        right={<EmptyState heading="Report viewer coming in Plan 05" body={`Will render: ${openReportPath}`} />}
        rightTitle={basename(openReportPath)}
        onClose={handleCloseReport}
      />
    )
    : <TrackerPanel refreshKey={refreshKey} onOpenReport={handleOpenReport} />

  return (
    <div className="flex h-full w-full bg-ctp-base text-ctp-text">
      <Sidebar
        activePanel={activePanel}
        onSelect={setActivePanel}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <FileChangeBanner visible={filesChanged} onRefresh={handleRefresh} />
        <div className="flex-1 min-h-0 overflow-hidden">
          {activePanel === 'tracker' && trackerView}
          {activePanel === 'reports' && (
            <EmptyState heading="Reports panel coming in Plan 05" body="This placeholder will be replaced with the reports browse list in Plan 05." />
          )}
          {activePanel === 'pipeline' && (
            <EmptyState heading="Pipeline panel coming in Plan 05" body="This placeholder will be replaced with the pipeline inbox in Plan 05." />
          )}
        </div>
      </main>
    </div>
  )
}
