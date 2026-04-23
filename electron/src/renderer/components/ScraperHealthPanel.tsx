import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { HealthStatusDot } from './HealthStatusDot'
import type { VcFirmHealth } from '../../preload/types'

interface Props { firms: VcFirmHealth[] }

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function ScraperHealthPanel({ firms }: Props) {
  const [expanded, setExpanded] = useState(false)   // D-10: collapsed by default
  const summary = (() => {
    const ok = firms.filter(f => f.status === 'OK').length
    const stale = firms.filter(f => f.status === 'Stale').length
    const err = firms.filter(f => f.status === 'Error').length
    return `${ok} OK · ${stale} Stale · ${err} Error`
  })()
  return (
    <div className="border border-ctp-overlay rounded">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-3 py-2 text-body hover:bg-ctp-overlay/30"
        data-testid="health-panel-toggle"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Scraper Health</span>
          <span className="text-ctp-subtext text-label">({summary})</span>
        </span>
      </button>
      {expanded && (
        <div className="border-t border-ctp-overlay" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {firms.length === 0 ? (
            <div className="px-3 py-2 text-ctp-subtext text-label">No scrape runs yet.</div>
          ) : (
            <table className="w-full text-label">
              <thead>
                <tr className="text-ctp-subtext uppercase text-label">
                  <th className="text-left px-3 py-1">Firm</th>
                  <th className="text-left px-3 py-1">Status</th>
                  <th className="text-left px-3 py-1">Last Run</th>
                  <th className="text-right px-3 py-1">Companies</th>
                  <th className="text-right px-3 py-1">Baseline</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.name} className="border-t border-ctp-overlay/30">
                    <td className="px-3 py-1">{f.name}</td>
                    <td className="px-3 py-1">
                      <span className="inline-flex items-center gap-2">
                        <HealthStatusDot status={f.status} reason={f.reason} />
                        <span>{f.status}</span>
                        {f.status === 'Error' && f.reason && (
                          <span className="text-ctp-subtext text-label" data-testid="health-reason-text">
                            — {f.reason}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-ctp-subtext">{formatDate(f.last_run)}</td>
                    <td className="px-3 py-1 text-right font-mono">{f.company_count}</td>
                    <td className="px-3 py-1 text-right font-mono text-ctp-subtext">{f.baseline_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
