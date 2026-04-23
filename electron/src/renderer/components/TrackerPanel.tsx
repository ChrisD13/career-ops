import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'
import { FixedSizeList } from 'react-window'
import type { TrackerRow as TrackerRowData } from '../../preload/types'
import { TrackerRow, TrackerRowItemData } from './TrackerRow'
import { StatusUpdateToast } from './StatusUpdateToast'
import type { StatusOption } from './StatusSelect'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

const ROW_HEIGHT = 32
const HEADER_HEIGHT = 36

// Map StatusEntry (Phase 1 shape: { id, label }) to StatusOption for StatusSelect.
// StatusEntry has no category field — assign defaults based on known status vocabulary.
const ACTIVE_STATUSES = new Set(['evaluated', 'applied', 'responded', 'interview'])
const OUTCOME_STATUSES = new Set(['offer', 'rejected', 'discarded', 'skip'])

function statusCategory(id: string): StatusOption['category'] {
  const normalized = id.trim().toLowerCase()
  if (ACTIVE_STATUSES.has(normalized)) return 'Active'
  if (OUTCOME_STATUSES.has(normalized)) return 'Outcome'
  return 'Completed'
}

interface Props {
  refreshKey: number
  onOpenReport: (reportPath: string) => void
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: TrackerRowData[]; statusOptions: StatusOption[] }

export function TrackerPanel({ refreshKey, onOpenReport }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [listHeight, setListHeight] = useState(400)
  const [activeEditRow, setActiveEditRow] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; at: number } | null>(null)
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  const fetchData = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [rows, statuses] = await Promise.all([
        window.api.readTracker(),
        window.api.readStatuses(),
      ])
      const statusOptions: StatusOption[] = statuses.map((s) => ({
        label: s.label,
        value: s.id,
        category: statusCategory(s.id),
      }))
      setState({ kind: 'ready', rows, statusOptions })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData, refreshKey])

  // Subscribe to file changes — chokidar watcher triggers reload after successful writes
  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => {
      void fetchData()
    })
    return () => unsub()
  }, [fetchData])

  // Measure container height for FixedSizeList (numeric height required)
  useLayoutEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const update = () => setListHeight(Math.max(0, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [state.kind])

  const handleStartEdit = useCallback((num: number) => {
    setActiveEditRow(num)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setActiveEditRow(null)
  }, [])

  const handleSave = useCallback(async (num: number, newStatus: string) => {
    const result = await window.api.updateStatus(num, newStatus)
    if (result.success) {
      setActiveEditRow(null)
      setToast({ message: `Status updated to ${newStatus}`, at: Date.now() })
      // rows will re-populate via onFilesChanged → fetchData()
    } else {
      const msg = result.message ?? result.error ?? 'Could not save status change. Try again.'
      setToast({ message: msg, at: Date.now() })
      // Keep activeEditRow open so the user can retry
    }
  }, [])

  const itemData = useMemo<TrackerRowItemData>(() => ({
    rows: state.kind === 'ready' ? state.rows : [],
    statusOptions: state.kind === 'ready' ? state.statusOptions : [],
    activeEditRow,
    onOpenReport,
    onStartEdit: handleStartEdit,
    onSave: handleSave,
    onCancelEdit: handleCancelEdit,
  }), [state, activeEditRow, onOpenReport, handleStartEdit, handleSave, handleCancelEdit])

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
    <div className="flex flex-col h-full relative" role="grid" aria-rowcount={state.rows.length}>
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

      {/* Toast — rendered at panel root so it's always visible regardless of scroll */}
      <StatusUpdateToast
        message={toast?.message ?? ''}
        at={toast?.at ?? null}
        onDismiss={() => setToast(null)}
      />
    </div>
  )
}
