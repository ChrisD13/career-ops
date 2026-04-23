import { ListChildComponentProps } from 'react-window'
import { Check } from 'lucide-react'
import type { TrackerRow as TrackerRowData } from '../../preload/types'
import { ScoreBadge } from './ScoreBadge'
import { StatusBadge } from './StatusBadge'
import { StatusSelect, type StatusOption } from './StatusSelect'

export interface TrackerRowItemData {
  rows: TrackerRowData[]
  statusOptions: StatusOption[]
  activeEditRow: number | null
  onOpenReport: (reportPath: string) => void
  onStartEdit: (num: number) => void
  onSave: (num: number, newStatus: string) => Promise<void>
  onCancelEdit: () => void
}

// Pixel widths from UI-SPEC. Notes is flex via flex-1.
const CELL = {
  num: 'w-12 text-right font-mono',              // 48px
  date: 'w-[88px]',
  company: 'w-40',                               // 160px
  role: 'w-[200px]',
  score: 'w-[72px] flex justify-center',
  status: 'w-[120px]',
  pdf: 'w-12 flex justify-center',               // 48px
  report: 'w-[72px] flex justify-center',
  notes: 'flex-1',
} as const

export function TrackerRow({ index, style, data }: ListChildComponentProps<TrackerRowItemData>) {
  const row = data.rows[index]
  if (!row) return null

  const isEditing = data.activeEditRow === row.num

  const handleOpenReport = () => {
    if (row.reportPath) data.onOpenReport(row.reportPath)
  }

  return (
    <div
      style={style}
      role="row"
      className="flex items-center gap-2 px-2 text-body text-ctp-text hover:bg-ctp-overlay border-b border-ctp-overlay/30"
    >
      <div role="gridcell" className={`${CELL.num} text-ctp-subtext truncate`}>{row.num}</div>
      <div role="gridcell" className={`${CELL.date} truncate`}>{row.date}</div>
      <div role="gridcell" className={`${CELL.company} truncate`} title={row.company}>{row.company}</div>
      <div role="gridcell" className={`${CELL.role} truncate`} title={row.role}>{row.role}</div>
      <div role="gridcell" className={CELL.score}>
        <ScoreBadge score={row.score} raw={row.scoreRaw} />
      </div>
      <div role="gridcell" className={CELL.status}>
        {isEditing ? (
          <StatusSelect
            currentStatus={row.status}
            options={data.statusOptions}
            onSave={(newStatus) => data.onSave(row.num, newStatus)}
            onCancel={data.onCancelEdit}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="tracker-row__status-btn bg-transparent border border-dashed border-transparent px-1 py-0.5 rounded cursor-pointer hover:border-ctp-overlay hover:bg-ctp-surface focus:outline-none focus:ring-2 focus:ring-ctp-mauve focus:ring-offset-0"
            onClick={() => data.onStartEdit(row.num)}
            title="Click to edit status"
            aria-label={`Change status (currently ${row.status})`}
          >
            <StatusBadge status={row.status} />
          </button>
        )}
      </div>
      <div role="gridcell" className={CELL.pdf}>
        {row.hasPDF
          ? <Check size={14} aria-label="PDF available" className="text-ctp-green" />
          : <span className="text-ctp-subtext" aria-label="No PDF">—</span>}
      </div>
      <div role="gridcell" className={CELL.report}>
        {row.reportPath
          ? (
            <button
              type="button"
              onClick={handleOpenReport}
              className="text-ctp-blue underline-offset-2 hover:underline text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue rounded"
            >
              Open report
            </button>
          )
          : <span className="text-ctp-subtext">—</span>}
      </div>
      <div role="gridcell" className={`${CELL.notes} truncate text-ctp-subtext`} title={row.notes}>{row.notes}</div>
    </div>
  )
}
