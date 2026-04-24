import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import type { UpdaterStatus } from '../../preload/types'

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)

  useEffect(() => {
    // onUpdaterStatus returns an unsubscribe function — return it directly for cleanup
    return window.api.onUpdaterStatus(setStatus)
  }, [])

  // Banner renders ONLY when download is complete (phase === 'downloaded').
  // Do NOT show for 'downloading', 'checking', 'error', or 'not-available' states.
  // Showing earlier would enable Install Now before download completes — a no-op click.
  if (!status || status.phase !== 'downloaded') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start justify-between gap-4 py-2 px-4 w-full bg-ctp-green/15 text-ctp-green text-body"
      data-testid="update-banner"
    >
      {/* Left column: icon + version/notes */}
      <div className="flex items-start gap-2">
        <Download size={14} aria-hidden="true" className="mt-1 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Update available: v{status.version}</span>
          {status.releaseNotes ? (
            <span className="text-ctp-green/80 whitespace-pre-line">{status.releaseNotes}</span>
          ) : null}
        </div>
      </div>

      {/* Right column: action buttons */}
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void window.api.updaterInstall()}
          className="px-2 py-1 border border-ctp-green/60 rounded text-body font-semibold hover:bg-ctp-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset"
        >
          Install Now
        </button>
        <button
          type="button"
          onClick={() => {
            void window.api.updaterDismiss(status.version!)
            setStatus(null)
          }}
          className="px-2 py-1 border border-ctp-green/30 rounded text-body text-ctp-green/70 hover:bg-ctp-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset"
        >
          Later
        </button>
      </div>
    </div>
  )
}
