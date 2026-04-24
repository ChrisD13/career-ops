// electron/src/renderer/components/computeAnalytics.ts
//
// Pure aggregation function for the Phase 6 Analytics panel.
// Consumed by AnalyticsPanel.tsx (Plan 06-02). Zero React, zero IPC, zero side effects.
//
// Correctness invariants (DO NOT weaken — every one maps to a RESEARCH pitfall):
//   P1: Cumulative "reached stage" funnel semantics (not current-status-only)
//   P2: Case-insensitive status comparison via (status ?? '').trim().toLowerCase()
//   P3: Null-score rows are excluded from ALL buckets (not defaulted into <3.0)
//   P4: Division-by-zero guard on Applied denominator; Applied's own pctOfApplied hardcoded 100
//
// Canonical lowercase status IDs per templates/states.yml:
//   evaluated, applied, responded, interview, offer, rejected, discarded, skip

import type {
  TrackerRow,
  AnalyticsData,
  ScoreBucket,
  FunnelStage,
} from '../../preload/types'

// Bucket boundaries — [4.5, 5.0] both inclusive; other intervals half-open on top.
// See RESEARCH Assumption A4. Order matters for display (top → bottom).
const BUCKETS = [
  { label: '4.5–5.0', min: 4.5, max: 5.0, inclusiveMax: true  },
  { label: '4.0–4.4', min: 4.0, max: 4.5, inclusiveMax: false }, // [4.0, 4.5)
  { label: '3.0–3.9', min: 3.0, max: 4.0, inclusiveMax: false }, // [3.0, 4.0)
  { label: '<3.0',    min: -Infinity, max: 3.0, inclusiveMax: false },
] as const

// Cumulative forward-progress status sets. Lowercase canonical IDs only.
const REACHED_APPLIED   = new Set(['applied', 'responded', 'interview', 'offer'])
const REACHED_RESPONDED = new Set(['responded', 'interview', 'offer'])
const REACHED_INTERVIEW = new Set(['interview', 'offer'])
const REACHED_OFFER     = new Set(['offer'])

// Normalize exactly as StatusBadge.tsx:28 does. Do NOT redefine this elsewhere.
function normStatus(row: TrackerRow): string {
  return (row.status ?? '').trim().toLowerCase()
}

export function computeAnalytics(rows: TrackerRow[]): AnalyticsData {
  // ---- Score buckets (exclude null scores — P3) ----
  const buckets: ScoreBucket[] = BUCKETS.map(({ label, min, max, inclusiveMax }) => {
    const inBucket = rows.filter((r) => {
      if (r.score === null) return false
      if (r.score < min) return false
      return inclusiveMax ? r.score <= max : r.score < max
    })
    const respondedInBucket = inBucket.filter((r) =>
      REACHED_RESPONDED.has(normStatus(r)),
    ).length
    const responseRate =
      inBucket.length === 0
        ? 0
        : Math.round((respondedInBucket / inBucket.length) * 100)
    return { label, responseRate, count: inBucket.length }
  })

  // ---- Funnel (cumulative reached semantics — P1) ----
  const appliedCount   = rows.filter((r) => REACHED_APPLIED.has(normStatus(r))).length
  const respondedCount = rows.filter((r) => REACHED_RESPONDED.has(normStatus(r))).length
  const interviewCount = rows.filter((r) => REACHED_INTERVIEW.has(normStatus(r))).length
  const offerCount     = rows.filter((r) => REACHED_OFFER.has(normStatus(r))).length

  // Division-by-zero guard (P4). Applied's own pctOfApplied is the denominator —
  // hardcoded to 100 per UI-SPEC Copywriting Contract.
  const pct = (n: number): number =>
    appliedCount === 0 ? 0 : Math.round((n / appliedCount) * 100)

  const funnel: FunnelStage[] = [
    { stage: 'Applied',   count: appliedCount,   pctOfApplied: 100 },
    { stage: 'Responded', count: respondedCount, pctOfApplied: pct(respondedCount) },
    { stage: 'Interview', count: interviewCount, pctOfApplied: pct(interviewCount) },
    { stage: 'Offer',     count: offerCount,     pctOfApplied: pct(offerCount) },
  ]

  return { buckets, funnel }
}
