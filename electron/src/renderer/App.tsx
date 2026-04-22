import { useEffect, useState, useCallback } from 'react'
import { Sidebar, PanelId } from './components/Sidebar'
import { FileChangeBanner } from './components/FileChangeBanner'
import { EmptyState } from './components/EmptyState'

export function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('tracker')
  const [collapsed, setCollapsed] = useState(false)
  const [filesChanged, setFilesChanged] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => setFilesChanged(true))
    return unsub
  }, [])

  const handleRefresh = useCallback(() => {
    setFilesChanged(false)
    setRefreshKey(k => k + 1)
  }, [])

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
          {activePanel === 'tracker' && (
            <EmptyState
              heading="No applications yet"
              body={`Applications from data/applications.md will appear here. refreshKey=${refreshKey}`}
            />
          )}
          {activePanel === 'reports' && (
            <EmptyState
              heading="Select a report to read it"
              body="Choose any evaluation report from the list on the left."
            />
          )}
          {activePanel === 'pipeline' && (
            <EmptyState
              heading="Pipeline inbox is empty"
              body="Add job URLs to data/pipeline.md to see them here."
            />
          )}
        </div>
      </main>
    </div>
  )
}
