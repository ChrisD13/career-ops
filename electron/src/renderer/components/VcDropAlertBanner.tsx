import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { VcFirmHealth } from '../../preload/types'

interface Props { firms: VcFirmHealth[] }

function worstDrop(firms: VcFirmHealth[]): { firm: string; dropPct: number } | null {
  let worst: { firm: string; dropPct: number } | null = null
  for (const f of firms) {
    if (f.baseline_count <= 0) continue
    const drop = (f.baseline_count - f.company_count) / f.baseline_count
    if (drop >= 0.2 && (!worst || drop > worst.dropPct)) {
      worst = { firm: f.name, dropPct: drop }
    }
  }
  return worst
}

export function VcDropAlertBanner({ firms }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const worst = worstDrop(firms)
  if (dismissed || !worst) return null
  const severe = worst.dropPct > 0.4
  const colorClasses = severe
    ? 'bg-ctp-red/15 text-ctp-red hover:bg-ctp-red/25'
    : 'bg-ctp-yellow/15 text-ctp-yellow hover:bg-ctp-yellow/25'
  const pct = Math.round(worst.dropPct * 100)
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between h-10 w-full px-3 ${colorClasses}`}
      data-testid="vc-drop-alert-banner"
      data-severity={severe ? 'severe' : 'warning'}
    >
      <div className="flex items-center gap-2 text-body">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>{worst.firm}: company count dropped {pct}% from baseline — check scraper health</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert"
        className="rounded hover:bg-ctp-overlay/40 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
