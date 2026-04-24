// electron/src/renderer/components/AnalyticsPanel.tsx
//
// Phase 6 Analytics panel. Satisfies:
//   ANAL-01 — Score bucket → response rate bar chart
//   ANAL-02 — Applied → Responded → Interview → Offer funnel table
//   ANAL-03 — Auto-refresh on 'files-changed' IPC event (plural, not the singular form)
//
// DIVERGENCE from TrackerPanel/DiscoverPanel: fetchData accepts isRefresh flag;
// when true (file-change driven), we do NOT reset to loading state — this avoids
// a jarring flash every time data/applications.md is written.

import { useCallback, useEffect, useState } from 'react'
import type { AnalyticsData } from '../../preload/types'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { computeAnalytics } from './computeAnalytics'

interface Props {
  refreshKey: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analytics: AnalyticsData; totalRows: number }

// Score bucket index → Tailwind color class. n=0 buckets fall back to bg-ctp-overlay.
// Locked by UI-SPEC Color Mapping (lines 93-102). Do not re-decide.
const BUCKET_COLORS = ['bg-ctp-green', 'bg-ctp-teal', 'bg-ctp-yellow', 'bg-ctp-red'] as const

export function AnalyticsPanel({ refreshKey }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  // isRefresh=false → show loading state. isRefresh=true → quiet in-place update.
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setState({ kind: 'loading' })
    try {
      const rows = await window.api.readTracker()
      const analytics = computeAnalytics(rows)
      setState({ kind: 'ready', analytics, totalRows: rows.length })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  // Initial mount + manual refresh button (refreshKey increment) — show loading.
  useEffect(() => { void fetchData(false) }, [fetchData, refreshKey])

  // File-change subscription — suppress loading flash. Channel is 'files-changed' (plural).
  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => { void fetchData(true) })
    return () => unsub()
  }, [fetchData])

  if (state.kind === 'loading') {
    return <EmptyState heading="Loading analytics..." />
  }
  if (state.kind === 'error') {
    return (
      <ErrorState
        heading="Could not load analytics"
        body="Failed to read data/applications.md. Check the file exists and try again."
        onRetry={() => void fetchData(false)}
      />
    )
  }
  if (state.totalRows === 0) {
    return (
      <EmptyState
        heading="No evaluated applications yet"
        body="Score an offer to see analytics here. Your response rates and funnel will appear once you have data."
      />
    )
  }

  const { analytics } = state

  return (
    <div className="flex flex-col h-full bg-ctp-base">
      {/* Panel header (matches TrackerPanel header treatment) */}
      <div className="bg-ctp-surface border-b border-ctp-overlay px-4 py-3 shrink-0">
        <div className="text-heading text-ctp-text">Analytics</div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-4 py-4 flex flex-col gap-6">
        {/* Section 1 — Score → Response Rate */}
        <section>
          <div className="text-label uppercase tracking-wider text-ctp-subtext mb-2">
            Score → Response Rate
          </div>
          <div role="table" aria-label="Score to response rate">
            {analytics.buckets.map((bucket, idx) => {
              const colorClass =
                bucket.count === 0 ? 'bg-ctp-overlay' : BUCKET_COLORS[idx]
              return (
                <div
                  key={bucket.label}
                  className="flex items-center gap-2 py-1"
                  role="row"
                >
                  <div className="w-20 text-body text-ctp-subtext">
                    {bucket.label}
                  </div>
                  <div className="flex-1 h-5 rounded bg-ctp-overlay relative overflow-hidden">
                    <div
                      className={`h-5 rounded ${colorClass}`}
                      style={{ width: `${bucket.responseRate}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="w-10 text-body text-right text-ctp-text">
                    {bucket.responseRate}%
                  </div>
                  <div className="w-12 text-body text-ctp-subtext">
                    n={bucket.count}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Section 2 — Application Funnel */}
        <section>
          <div className="text-label uppercase tracking-wider text-ctp-subtext mb-2">
            Application Funnel
          </div>
          <div role="table" aria-label="Application funnel">
            {/* Funnel header row */}
            <div
              role="row"
              className="flex items-center gap-2 py-1 border-b border-ctp-overlay text-label uppercase tracking-wider text-ctp-subtext"
            >
              <div role="columnheader" className="flex-1">Stage</div>
              <div role="columnheader" className="w-20 text-right">Count</div>
              <div role="columnheader" className="w-24 text-right">% of Applied</div>
            </div>
            {/* Funnel data rows */}
            {analytics.funnel.map((stage) => (
              <div
                key={stage.stage}
                role="row"
                className="flex items-center gap-2 py-1 text-body text-ctp-text"
              >
                <div role="cell" className="flex-1">{stage.stage}</div>
                <div role="cell" className="w-20 text-right">{stage.count}</div>
                <div role="cell" className="w-24 text-right">{stage.pctOfApplied}%</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
