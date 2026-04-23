import { ListChildComponentProps } from 'react-window'
import { Send, Check, Loader2 } from 'lucide-react'
import type { VcCompany } from '../../preload/types'
import { FundingSignalBadge } from './FundingSignalBadge'
import { RoleMatchBadge } from './RoleMatchBadge'

export interface CompanyRowItemData {
  rows: VcCompany[]
  promotingKeys: Set<string>                                 // `${firm}\t${company}` currently in-flight
  onPromote: (row: VcCompany) => void
}

// Column widths from UI-SPEC §Table Layout
const CELL = {
  company: 'w-[280px]',
  firm: 'w-[140px]',
  funding: 'w-[160px] flex justify-start',
  role: 'w-[140px] flex justify-start',
  actions: 'flex-1 flex justify-end',
} as const

function rowKey(r: VcCompany): string { return `${r.firm}\t${r.company}` }

export function CompanyRow({ index, style, data }: ListChildComponentProps<CompanyRowItemData>) {
  const row = data.rows[index]
  if (!row) return null
  const key = rowKey(row)
  const inFlight = data.promotingKeys.has(key)
  const promoted = row.promoted

  return (
    <div
      style={style}
      role="row"
      className="flex items-center gap-2 px-3 text-body text-ctp-text hover:bg-ctp-overlay border-b border-ctp-overlay/30"
      data-testid="company-row"
    >
      <div role="gridcell" className={`${CELL.company} truncate`} title={row.company}>
        {row.careers_url ? (
          <a
            href={row.careers_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ctp-blue underline-offset-2 hover:underline"
          >
            {row.company}
          </a>
        ) : (
          <span>{row.company}</span>
        )}
      </div>
      <div role="gridcell" className={`${CELL.firm} truncate text-ctp-subtext`}>{row.firm}</div>
      <div role="gridcell" className={CELL.funding}>
        <FundingSignalBadge signal={row.funding_signal} date={row.funding_date} />
      </div>
      <div role="gridcell" className={CELL.role}>
        <RoleMatchBadge matches={row.role_matches} />
      </div>
      <div role="gridcell" className={CELL.actions}>
        {promoted ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-label text-ctp-green" data-testid="promoted-state">
            <Check size={12} aria-hidden="true" />
            <span>Promoted ✓</span>
          </span>
        ) : inFlight ? (
          <button type="button" disabled className="inline-flex items-center gap-1 px-2 py-1 text-label text-ctp-subtext" data-testid="promote-inflight">
            <Loader2 size={12} aria-hidden="true" className="animate-spin" />
            <span>Promoting…</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => data.onPromote(row)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-ctp-overlay text-label text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
            data-testid="promote-btn"
            aria-label={`Promote ${row.company} to pipeline`}
          >
            <Send size={12} aria-hidden="true" />
            <span>Promote</span>
          </button>
        )}
      </div>
    </div>
  )
}
