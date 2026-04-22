import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'
import { FixedSizeList } from 'react-window'
import type { TrackerRow as TrackerRowData, StatusEntry } from '../../preload/types'
import { TrackerRow, TrackerRowItemData } from './TrackerRow'
import { StatusSelect } from './StatusSelect'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

const ROW_HEIGHT = 32
const HEADER_HEIGHT = 36

interface Props {
  refreshKey: number
  onOpenReport: (reportPath: string) => void
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: TrackerRowData[]; statuses: StatusEntry[] }

export function TrackerPanel({ refreshKey, onOpenReport }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [listHeight, setListHeight] = useState(400)
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchData = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [rows, statuses] = await Promise.all([
        window.api.readTracker(),
        window.api.readStatuses(),
      ])
      setState({ kind: 'ready', rows, statuses })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshKey])

  // Measure container height for FixedSizeList (Pitfall 2: numeric height required)
  useLayoutEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const update = () => setListHeight(Math.max(0, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [state.kind])

  const itemData = useMemo<TrackerRowItemData>(() => ({
    rows: state.kind === 'ready' ? state.rows : [],
    onOpenReport,
  }), [state, onOpenReport])

  if (state.kind === 'loading') {
    return <EmptyState heading="Loading tracker..." />
  }
  if (state.kind === 'error') {
    return (
      <ErrorState
        heading="Could not load tracker"
        body={state.message}
        onRetry={() => void fetchData()}
      />
    )
  }
  if (state.rows.length === 0) {
    return (
      <EmptyState
        heading="No applications yet"
        body="Applications from data/applications.md will appear here. Make sure the file exists and has entries."
      />
    )
  }

  return (
    <div className="flex flex-col h-full" role="grid" aria-rowcount={state.rows.length}>
      {/* Sticky header — rendered OUTSIDE FixedSizeList per Pattern 6 */}
      <div
        role="row"
        style={{ height: HEADER_HEIGHT }}
        className="flex items-center gap-2 px-2 bg-ctp-surface border-b border-ctp-overlay text-label text-ctp-subtext uppercase tracking-wider shrink-0"
      >
        <div role="columnheader" className="w-12 text-right">#</div>
        <div role="columnheader" className="w-[88px]">Date</div>
        <div role="columnheader" className="w-40">Company</div>
        <div role="columnheader" className="w-[200px]">Role</div>
        <div role="columnheader" className="w-[72px] text-center">Score</div>
        <div role="columnheader" className="w-[120px]">Status</div>
        <div role="columnheader" className="w-12 text-center">PDF</div>
        <div role="columnheader" className="w-[72px] text-center">Report</div>
        <div role="columnheader" className="flex-1">Notes</div>
      </div>

      {/* Status-plumbing proof per ELEC-03: disabled StatusSelect mounted once */}
      <div className="flex items-center gap-2 px-2 py-1 bg-ctp-surface/50 border-b border-ctp-overlay text-label text-ctp-subtext shrink-0">
        <span>Status dropdown (Phase 2 enables editing):</span>
        <StatusSelect statuses={state.statuses} currentStatus={state.statuses[0]?.id ?? 'evaluated'} />
      </div>

      {/* Virtualized list — needs numeric height */}
      <div ref={listContainerRef} className="flex-1 min-h-0">
        <FixedSizeList
          height={listHeight}
          width="100%"
          itemCount={state.rows.length}
          itemSize={ROW_HEIGHT}
          itemData={itemData}
          overscanCount={5}
        >
          {TrackerRow}
        </FixedSizeList>
      </div>
    </div>
  )
}
