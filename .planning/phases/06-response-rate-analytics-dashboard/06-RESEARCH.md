# Phase 6: Response-Rate Analytics Dashboard — Research

**Researched:** 2026-04-24
**Domain:** React + TypeScript + Electron renderer, Tailwind CSS, pure client-side data aggregation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chart Implementation:**
- Visualization: CSS-only Tailwind bar charts — no new library dependency
- Score buckets: 4 buckets — 4.5–5.0, 4.0–4.4, 3.0–3.9, <3.0 (aligns with ROADMAP example)
- Bar content: response rate % + sample count (n=X) per bucket
- Funnel display: horizontal table format — stage → count → % of applied

**Data Architecture:**
- Compute in renderer from existing `readTracker` data — no new IPC handle needed
- Auto-refresh: reuse existing `file-changed` event; re-fetch via `readTracker` on event
- No minimum threshold — show empty state immediately when no data available
- Funnel stages: Applied → Responded → Interview → Offer (4 canonical forward-progress stages only; Rejected/Discarded excluded from funnel)

**Panel Integration & Layout:**
- New top-level Sidebar nav item "Analytics" with BarChart icon from lucide-react
- Section order: score correlation chart first, funnel table below
- Empty state: "No evaluated applications yet — score an offer to see analytics"
- Scroll behavior: vertically scrollable within panel content area (same as TrackerPanel)

### Claude's Discretion

- Exact Tailwind class choices for bars (height, colors, spacing) — follow existing ScoreBadge/StatusBadge color palette (now locked by UI-SPEC.md — see Color Mapping table)
- TypeScript types for aggregated analytics data shape (now locked by UI-SPEC.md — see `ScoreBucket`, `FunnelStage`, `AnalyticsData`)
- Whether to show a "last updated" timestamp in the panel

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANAL-01 | User can view a panel showing score-to-outcome correlation (score buckets vs response rate) | Pure-function `computeAnalytics(rows)` in renderer buckets by `score` and counts status ∈ {responded, interview, offer} per bucket; rendered as 4 Tailwind-div bar rows in `AnalyticsPanel` |
| ANAL-02 | Funnel visualization shows counts at each stage: applied → responded → interview → offer | Same `computeAnalytics` returns `FunnelStage[]` where each stage counts rows whose *current* status is that stage OR any forward stage (cumulative "reached" semantics); rendered as 4-row horizontal table |
| ANAL-03 | Panel refreshes automatically when `applications.md` changes on disk | `window.api.onFilesChanged()` subscription (existing chokidar → IPC bridge) triggers `readTracker()` re-fetch + recompute. `isRefresh` flag suppresses loading flash on non-initial refreshes |
</phase_requirements>

---

## Summary

Phase 6 adds a read-only Analytics panel to the Electron app that derives two visualizations — score-bucketed response rates and a forward-progress funnel — from the existing `TrackerRow[]` data stream. The computation is purely client-side: no new IPC handle, no new main-process code, no new npm dependencies. The panel subscribes to the existing `files-changed` event to auto-refresh when `data/applications.md` changes on disk.

The real work is threefold: (1) a **pure aggregation function** that correctly interprets status semantics (forward-progress is cumulative — "Interview count" includes rows whose current status is Interview OR Offer); (2) a **panel component** that mirrors the existing TrackerPanel pattern but adds an `isRefresh` flag to avoid loading-state flash on file-change refreshes; (3) **sidebar + routing integration** to register the new `'analytics'` PanelId. The UI-SPEC already locks the color palette, typography, and component structure — this research supplies the computation semantics, type contract details, and integration wiring the UI-SPEC doesn't cover.

Several non-obvious correctness details must be spelled out for the planner: status comparison must be case-insensitive (the parser preserves case; `StatusBadge` lowercases at render), null/unparseable scores must be excluded from all buckets (not defaulted to `<3.0`), and funnel denominators break when Applied=0 (division-by-zero guard needed).

**Primary recommendation:** Implement a new `AnalyticsPanel.tsx` component and a colocated pure `computeAnalytics(rows)` helper; add `'analytics'` to `PanelId`, insert the nav item after `'discover'` in `Sidebar.tsx`, and render `<AnalyticsPanel refreshKey={refreshKey} />` from `App.tsx`. Zero main-process changes, zero new dependencies.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse applications.md | Main process | — | Existing `parseApplications()` already handles this; no change needed |
| `readTracker` IPC handler | Main process | — | Already registered in `ipc-handlers.ts`; reused as-is |
| File watcher + `files-changed` push | Main process | — | Existing chokidar watcher in `watcher.ts` pushes to renderer; reused as-is |
| Aggregate TrackerRow[] → AnalyticsData | Renderer (pure function) | — | Per CONTEXT lock: compute in renderer. No main-process work required. Pure function is easy to unit-test and trivially recomputes on every refresh |
| Render bar chart + funnel table | Renderer | — | Panel is pure UI; React + Tailwind only |
| Subscribe to file changes | Renderer | — | `window.api.onFilesChanged()` subscription (existing bridge) |
| Panel routing | Renderer (App.tsx) | — | Existing `activePanel` switch pattern |
| Sidebar nav registration | Renderer (Sidebar.tsx) | — | Add to `ITEMS` array and `PanelId` union |
| TypeScript contract | Preload | Renderer + Main | `preload/types.ts` is the established single source of truth for shared types per STATE.md |

---

## Standard Stack

### Core (already installed — zero new deps needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | UI rendering | [VERIFIED: package.json] — already the renderer framework |
| TypeScript | 5.8.3 | Type safety | [VERIFIED: package.json] — project convention |
| Tailwind CSS | 3.4.19 | CSS-only bar chart styling | [VERIFIED: package.json] — CONTEXT locks CSS-only approach |
| lucide-react | 0.511.0 | `BarChart` icon | [VERIFIED: package.json] — CONTEXT locks this icon source |

### Alternatives Considered and Rejected

| Instead of | Could Use | Why rejected |
|------------|-----------|-------------|
| Tailwind div-bars | `recharts`, `chart.js`, `victory`, `nivo` | [LOCKED BY CONTEXT] "No new library dependency" — CSS-only is mandated. Also: chart libs are heavy (50–150kB gzipped) for a 4-bar static chart that never animates and never handles zoom/tooltip complexity. Pure Tailwind fits the data shape exactly. |
| New main-process IPC handle (e.g. `readAnalytics`) | Compute in main, push aggregated data | [LOCKED BY CONTEXT] "Compute in renderer from existing readTracker data — no new IPC handle needed". Also: computation is trivially cheap (O(n) over maybe hundreds of rows), so moving it across the process boundary buys nothing. |

**Installation:** None required. Zero new dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
    data/applications.md (on disk)
              │
              │ (1) chokidar detects change
              ▼
    ┌──────────────────────────────┐
    │ main/watcher.ts              │
    │   push 'files-changed' event │
    └──────────────┬───────────────┘
                   │ (2) IPC push via webContents.send
                   ▼
    ┌──────────────────────────────┐
    │ renderer: AnalyticsPanel     │
    │   window.api.onFilesChanged()│
    │     └─► fetchData(isRefresh) │
    └──────────────┬───────────────┘
                   │ (3) IPC invoke
                   ▼
    ┌──────────────────────────────┐
    │ main: readTracker handler    │
    │   parseApplications(path)    │
    │     returns TrackerRow[]     │
    └──────────────┬───────────────┘
                   │ (4) rows returned
                   ▼
    ┌──────────────────────────────┐
    │ renderer: computeAnalytics() │
    │   pure function:             │
    │     TrackerRow[] →           │
    │       AnalyticsData          │
    │   { buckets[4], funnel[4] }  │
    └──────────────┬───────────────┘
                   │ (5) setState
                   ▼
    ┌──────────────────────────────┐
    │ React render:                │
    │   ScoreCorrelationSection    │
    │     BucketRow × 4            │
    │   FunnelSection              │
    │     FunnelTable 4 rows       │
    └──────────────────────────────┘
```

Initial mount path: step (3) → (4) → (5), with `isRefresh=false` showing loading state.
Refresh path: step (1) → (2) → (3) → (4) → (5), with `isRefresh=true` suppressing loading flash.

### Recommended Project Structure

No new folders needed. All new files colocate with existing components:

```
electron/src/renderer/components/
├── AnalyticsPanel.tsx          # NEW — the panel
└── (optionally) analytics/
    └── computeAnalytics.ts     # NEW — pure aggregation (or inline in AnalyticsPanel.tsx)

electron/src/renderer/components/Sidebar.tsx    # EDIT — add nav item
electron/src/renderer/App.tsx                    # EDIT — add routing case
electron/src/preload/types.ts                    # EDIT — add 3 types
```

**Recommendation:** Keep `computeAnalytics` as a named export *inside* `AnalyticsPanel.tsx` or a sibling `computeAnalytics.ts` file. Keeping it exported allows an isolated import for future unit tests without pulling React.

### Pattern 1: Panel Component with `isRefresh` Flag (divergence from TrackerPanel)

**What:** Panel subscribes to `onFilesChanged` but uses an internal flag to avoid resetting to loading state on refresh.
**When to use:** Panels where flashing the loading screen on every disk change is jarring. Analytics re-renders frequently (on every status change anywhere in the tracker) — flashing loading would be disruptive.
**Example:**
```typescript
// Source: UI-SPEC.md § Component Inventory
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analytics: AnalyticsData }

const [state, setState] = useState<LoadState>({ kind: 'loading' })

const fetchData = useCallback(async (isRefresh = false) => {
  if (!isRefresh) setState({ kind: 'loading' })
  try {
    const rows = await window.api.readTracker()
    const analytics = computeAnalytics(rows)
    setState({ kind: 'ready', analytics })
  } catch (err) {
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}, [])

useEffect(() => { void fetchData(false) }, [fetchData, refreshKey])
useEffect(() => {
  const unsub = window.api.onFilesChanged(() => { void fetchData(true) })
  return () => unsub()
}, [fetchData])
```

### Pattern 2: Pure Aggregation Function (colocated, no React)

**What:** Isolate the data transform as a pure `(TrackerRow[]) → AnalyticsData` function.
**When to use:** Whenever the renderer aggregates data. Keeps computation testable and recomputation cheap.
**Example:** See Code Examples § `computeAnalytics` below.

### Pattern 3: Panel Registration (three-file change)

**What:** Adding a new panel requires exactly three edits.
**When to use:** Every new top-level panel.
**Example:**
1. `Sidebar.tsx`: add `'analytics'` to `PanelId` union, add `{ id: 'analytics', label: 'Analytics', icon: BarChart }` to `ITEMS` array (insert after `'discover'` per UI-SPEC)
2. `App.tsx`: add `case 'analytics': return <AnalyticsPanel refreshKey={refreshKey} />` inside `renderPanel()` switch
3. `preload/types.ts`: add new shared types (see Code Examples § Types)

### Anti-Patterns to Avoid

- **Recomputing analytics on every render:** Memoize with `useMemo` keyed on `rows` so React re-renders don't trigger the O(n) aggregation. (Small n, but the habit matters.)
- **Reading status with exact-case string match (`row.status === 'Applied'`):** The parser preserves mixed case; `StatusBadge` lowercases at render time. Analytics must do `row.status.trim().toLowerCase() === 'applied'` for every comparison. See Pitfall 2.
- **Defaulting `null` scores into the `<3.0` bucket:** Null means "unparseable / missing" — exclude from buckets entirely. Don't inflate the lowest bucket with noise. See Pitfall 3.
- **Passing a mutable `Date.now()` into `useMemo` deps:** If you add a "last updated" timestamp, put it in state (set alongside `setState({ kind: 'ready', ... })`), don't recompute on render.
- **Skipping the `refreshKey` prop:** Existing panels accept `refreshKey: number` from `App.tsx`. If omitted, the `FileChangeBanner` "Refresh" button won't trigger an analytics refetch. See Pitfall 5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing applications.md | Custom markdown table parser | Existing `parseApplications()` via `readTracker` IPC | Already handles mixed TSV/pipe rows, bold stripping, trailing-date stripping, score regex |
| File-change subscription | Custom IPC wiring | Existing `window.api.onFilesChanged()` | Already bridged via preload; chokidar watcher already running |
| Status normalization | Per-component lowercase logic (copy-pasted) | Inline `.trim().toLowerCase()` comparison against canonical IDs from `templates/states.yml` | Canonical IDs are lowercase: `applied`, `responded`, `interview`, `offer`, `rejected`, `discarded`, `skip`, `evaluated` |
| Empty-state component | New JSX | Existing `<EmptyState heading=... body=... />` | Same visual pattern already used in TrackerPanel, CvPanel, DiscoverPanel |
| Error-state component | New JSX | Existing `<ErrorState heading=... body=... onRetry=... />` | Same |
| Color palette decisions | Pick arbitrary Tailwind colors | Use tokens from UI-SPEC Color Mapping table (`bg-ctp-green`, `bg-ctp-teal`, `bg-ctp-yellow`, `bg-ctp-red`) | Already mapped in tailwind.config.js to Catppuccin Mocha vars; consistent with ScoreBadge |
| Chart library | Add recharts / chart.js | Tailwind div with `width: {pct}%` | 4 static horizontal bars don't need an SVG chart lib |

**Key insight:** This phase is almost entirely *wiring* existing assets (parser, IPC, file-watcher, empty/error components, color tokens, icon library) into a new panel. The only net-new code is `computeAnalytics()` and the `AnalyticsPanel` JSX.

---

## Common Pitfalls

### Pitfall 1: Funnel Semantics — "Reached" vs "Current"

**What goes wrong:** A naive implementation counts only rows whose *current* status equals the stage (e.g. "Interview count = rows where status == 'interview'"). This undercounts because applications that advanced to Offer no longer have status=Interview.

**Why it happens:** The tracker only stores the *current* status per row — there is no status history. But "funnel" visualizations show *reach* (how many ever hit this stage), not *current state*.

**How to avoid:** Use cumulative "forward-progress" semantics:

| Stage | Counts rows whose current status ∈ |
|-------|-----------------------------------|
| Applied | `{applied, responded, interview, offer}` |
| Responded | `{responded, interview, offer}` |
| Interview | `{interview, offer}` |
| Offer | `{offer}` |

Evaluated, Rejected, Discarded, Skip are **not** in any stage's set (per CONTEXT: "forward-progress stages only"). An application in status=Evaluated has not yet Applied, so it must not count toward Applied.

**Warning signs:** If Offer count is 3 but Interview count is 1, something's wrong — Interview must be ≥ Offer count always (monotonic non-increasing down the funnel).

### Pitfall 2: Case-Sensitive Status Comparison

**What goes wrong:** Code like `row.status === 'Applied'` matches some rows and silently misses others depending on capitalization.

**Why it happens:** `parseApplications()` strips `**` and trailing dates but otherwise preserves case (see `electron/src/main/parsers/applications.ts:36-37`). Different writers may produce `Applied`, `applied`, `APPLIED`. The canonical IDs in `templates/states.yml` are all lowercase.

**How to avoid:** Normalize once at comparison time. Either pre-normalize all rows inside `computeAnalytics` (`const s = row.status.trim().toLowerCase()`) or use a helper `statusIs(row, id)`. `StatusBadge.tsx` already uses this pattern — mirror it.

**Warning signs:** Funnel counts that change when applications.md is manually edited for capitalization.

### Pitfall 3: Null Scores Falling Into `<3.0` Bucket

**What goes wrong:** Rows with unparseable score (e.g. `—`, blank, non-numeric) have `score: null`. Naive bucketing code like `if (score < 3.0) bucket4++` treats `null < 3.0` as `false` in JS (coerces to NaN), which may accidentally work OR accidentally classify nulls as `<3.0` depending on the exact comparison order.

**Why it happens:** TrackerRow.score is explicitly `number | null`. The parser returns null for missing/malformed scores.

**How to avoid:** Filter first: `const scored = rows.filter(r => r.score !== null)`. Only bucket scored rows. Null-score rows do not appear in any bucket. Document this rule in the code comment.

**Warning signs:** Bucket counts don't sum to the number of rows displayed in the tracker. (This is expected — sum = count of rows with valid scores.)

### Pitfall 4: Division by Zero in Funnel % of Applied

**What goes wrong:** When Applied count is 0, every non-Applied row's `pctOfApplied` becomes `NaN` (`0/0`) or `Infinity` (`x/0`).

**Why it happens:** New users open the panel with an empty tracker; or all rows are in Evaluated status (never applied). Applied=0 is a real, reachable state.

**How to avoid:** Guard the division:
```typescript
const applied = appliedCount // may be 0
const pctOfApplied = applied === 0 ? 0 : Math.round((stageCount / applied) * 100)
// Applied row itself: always 100% (locked by UI-SPEC Copywriting Contract)
```

**Decision (document in plan):** When Applied=0, show `0%` for Responded / Interview / Offer rows, and `100%` for the Applied row itself (this matches UI-SPEC's "Funnel '% of Applied' for Applied row: 100% (always — Applied is the denominator)"). Alternative would be "—" but CONTEXT/UI-SPEC prefer numeric display; the entire panel shows the EmptyState anyway when there are zero rows, so the zero-Applied case with non-zero rows is rare (only happens if all rows are Evaluated/Rejected/Discarded).

**Warning signs:** `NaN%` or `Infinity%` strings in the rendered output.

### Pitfall 5: Missing `refreshKey` Prop — Manual Refresh Button Silently Broken

**What goes wrong:** `App.tsx` owns a `refreshKey: number` state that increments when the user clicks the `FileChangeBanner` "Refresh" button. Every existing panel takes this as a prop and re-fetches on change (`useEffect(..., [refreshKey])`). If `AnalyticsPanel` omits this prop, the manual refresh button does nothing for analytics.

**Why it happens:** UI-SPEC doesn't mention `refreshKey` — the pattern is a codebase convention, not documented in the contract.

**How to avoid:** Accept `refreshKey: number` as a prop. Include it in the `fetchData` `useEffect` dependency array. `App.tsx` passes `refreshKey={refreshKey}` on the render case.

**Warning signs:** User clicks "Refresh" banner button and TrackerPanel updates but AnalyticsPanel doesn't.

### Pitfall 6: CONTEXT Says "file-changed" But Actual API Is `files-changed` / `onFilesChanged`

**What goes wrong:** A planner reading CONTEXT.md literally might instruct the executor to subscribe to a `file-changed` event or call `onFileChanged` (singular) — neither exists.

**Why it happens:** CONTEXT.md § Decisions says "reuse existing `file-changed` event" — naming drift from the actual IPC channel `files-changed` (plural) and preload API `onFilesChanged` (plural).

**How to avoid:** Verified in code:
- IPC channel: `files-changed` ([VERIFIED: `electron/src/preload/index.ts:22`])
- Preload API: `window.api.onFilesChanged(cb)` returns unsubscribe fn ([VERIFIED: `preload/types.ts:150`])
- Used by: `TrackerPanel`, `CvPanel`, `DiscoverPanel`, `App.tsx` ([VERIFIED: grep])

Plans must reference the plural forms `files-changed` / `onFilesChanged`, not the singular.

### Pitfall 7: Using `file-changed` String in CONTEXT.md Verbatim in a JSX Comment

**What goes wrong:** If an executor copies CONTEXT.md wording into a code comment, the comment becomes misleading ("subscribes to file-changed event" — wrong name).

**How to avoid:** Comments should cite the actual API name. Or omit the comment — code is self-documenting.

---

## Code Examples

Verified patterns from the existing codebase:

### `computeAnalytics` — pure aggregation function

```typescript
// Colocated with AnalyticsPanel.tsx (or sibling file)
// Source pattern: UI-SPEC.md § Component Inventory + semantics from CONTEXT.md

import type { TrackerRow, AnalyticsData, ScoreBucket, FunnelStage } from '../../preload/types'

const BUCKETS = [
  { label: '4.5–5.0', min: 4.5, max: 5.0, inclusiveMax: true },
  { label: '4.0–4.4', min: 4.0, max: 4.5, inclusiveMax: false }, // [4.0, 4.5)
  { label: '3.0–3.9', min: 3.0, max: 4.0, inclusiveMax: false }, // [3.0, 4.0)
  { label: '<3.0',    min: -Infinity, max: 3.0, inclusiveMax: false },
] as const

// Forward-progress status sets (cumulative — "reached stage X")
// Canonical IDs from templates/states.yml (lowercase)
const REACHED_RESPONDED = new Set(['responded', 'interview', 'offer'])
const REACHED_INTERVIEW = new Set(['interview', 'offer'])
const REACHED_OFFER     = new Set(['offer'])
const REACHED_APPLIED   = new Set(['applied', 'responded', 'interview', 'offer'])

function normStatus(row: TrackerRow): string {
  return row.status.trim().toLowerCase()
}

export function computeAnalytics(rows: TrackerRow[]): AnalyticsData {
  // ----- Buckets: exclude null scores entirely -----
  const buckets: ScoreBucket[] = BUCKETS.map(({ label, min, max, inclusiveMax }) => {
    const inBucket = rows.filter(r => {
      if (r.score === null) return false
      if (r.score < min) return false
      return inclusiveMax ? r.score <= max : r.score < max
    })
    const responded = inBucket.filter(r => REACHED_RESPONDED.has(normStatus(r))).length
    const responseRate = inBucket.length === 0 ? 0 : Math.round((responded / inBucket.length) * 100)
    return { label, responseRate, count: inBucket.length }
  })

  // ----- Funnel: cumulative forward-progress semantics -----
  const appliedCount   = rows.filter(r => REACHED_APPLIED.has(normStatus(r))).length
  const respondedCount = rows.filter(r => REACHED_RESPONDED.has(normStatus(r))).length
  const interviewCount = rows.filter(r => REACHED_INTERVIEW.has(normStatus(r))).length
  const offerCount     = rows.filter(r => REACHED_OFFER.has(normStatus(r))).length

  const pct = (n: number) => appliedCount === 0 ? 0 : Math.round((n / appliedCount) * 100)

  const funnel: FunnelStage[] = [
    { stage: 'Applied',   count: appliedCount,   pctOfApplied: 100 },  // always 100 per UI-SPEC
    { stage: 'Responded', count: respondedCount, pctOfApplied: pct(respondedCount) },
    { stage: 'Interview', count: interviewCount, pctOfApplied: pct(interviewCount) },
    { stage: 'Offer',     count: offerCount,     pctOfApplied: pct(offerCount) },
  ]

  return { buckets, funnel }
}
```

### Types (add to `electron/src/preload/types.ts`)

```typescript
// Phase 6 — Analytics
export interface ScoreBucket {
  label: string        // "4.5–5.0" | "4.0–4.4" | "3.0–3.9" | "<3.0"
  responseRate: number // 0–100 (percentage, rounded)
  count: number        // total applications in bucket with non-null score
}

export interface FunnelStage {
  stage: 'Applied' | 'Responded' | 'Interview' | 'Offer'
  count: number
  pctOfApplied: number // 0–100 (percentage, rounded); Applied itself = 100
}

export interface AnalyticsData {
  buckets: ScoreBucket[]  // always length 4
  funnel: FunnelStage[]   // always length 4
}
```

### Panel component skeleton

```typescript
// electron/src/renderer/components/AnalyticsPanel.tsx
import { useCallback, useEffect, useState, useMemo } from 'react'
import type { AnalyticsData } from '../../preload/types'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { computeAnalytics } from './computeAnalytics'  // or inline if preferred

interface Props {
  refreshKey: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analytics: AnalyticsData; totalRows: number }

export function AnalyticsPanel({ refreshKey }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

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

  useEffect(() => { void fetchData(false) }, [fetchData, refreshKey])

  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => { void fetchData(true) })
    return () => unsub()
  }, [fetchData])

  if (state.kind === 'loading') return <EmptyState heading="Loading analytics..." />
  if (state.kind === 'error') {
    return <ErrorState
      heading="Could not load analytics"
      body="Failed to read data/applications.md. Check the file exists and try again."
      onRetry={() => void fetchData(false)}
    />
  }
  if (state.totalRows === 0) {
    return <EmptyState
      heading="No evaluated applications yet"
      body="Score an offer to see analytics here. Your response rates and funnel will appear once you have data."
    />
  }

  // ... render sections per UI-SPEC Component Inventory
}
```

### Bar rendering pattern (CSS-only)

```tsx
// Per UI-SPEC Component Inventory, BucketRow structure:
<div className="flex items-center gap-2 py-1" role="row">
  <div className="w-20 text-body text-ctp-subtext">{label}</div>
  <div className="flex-1 h-5 rounded bg-ctp-overlay relative overflow-hidden">
    <div
      className={`h-5 rounded ${colorClass}`}
      style={{ width: `${responseRate}%` }}
      aria-hidden="true"
    />
  </div>
  <div className="w-10 text-body text-right text-ctp-text">{responseRate}%</div>
  <div className="w-12 text-body text-ctp-subtext">n={count}</div>
</div>
```

`colorClass` chosen from UI-SPEC Color Mapping (`bg-ctp-green` | `bg-ctp-teal` | `bg-ctp-yellow` | `bg-ctp-red`). Empty bucket (n=0) uses `bg-ctp-overlay`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart libraries for every visualization | CSS-only bars for simple static charts | ongoing | ~100kB bundle savings per chart-heavy page; simpler mental model |
| Status history tables | Current-status-only + cumulative "reached" semantics in readers | this phase | No schema change needed; readers encode the forward-progress semantics |

**Deprecated/outdated:**
- None. All patterns in this phase are additive and use current React 18 + TypeScript 5.8 + Tailwind 3.4 idioms.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Funnel "reached" semantics (Applied counts rows in {applied, responded, interview, offer}, etc.) match user intent for "Interview = applications that reached Interview" | Pitfall 1 + computeAnalytics example | Medium — if user wants *current-state-only* counts, Interview shows 1 (not 2), Offer appears to dominate Interview visually. Surfacing this explicitly in plan summary should make the mismatch easy to catch in /gsd-verify-work. |
| A2 | When Applied=0 with non-zero rows in other states, show `0%` for non-Applied funnel rows (not `—`) | Pitfall 4 | Low — user sees `0%` instead of `—` in an edge case that rarely occurs (would require all rows to be Evaluated/Rejected/Discarded — EmptyState covers the pure-zero case). |
| A3 | Rounding convention is `Math.round` (nearest integer, half-up) for both response rate % and pctOfApplied | computeAnalytics example | Low — 73.5 shows as 74; not a correctness issue unless user wants decimals (CONTEXT doesn't). |
| A4 | Bucket boundaries are [4.5, 5.0] (inclusive both ends) for top bucket, [4.0, 4.5) for second, [3.0, 4.0) for third, (-∞, 3.0) for bottom | computeAnalytics example | Low — CONTEXT says "4.5–5.0 | 4.0–4.4 | 3.0–3.9 | <3.0". A score of exactly 4.5 goes to the top bucket; 4.0 goes to the second; 3.0 goes to the third. This is the intuitive reading but planners should verify the boundary convention in the plan before coding. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
(It is not empty — A1 especially should be surfaced to the user in the plan summary, even though it's defensible from CONTEXT wording "Interview = applications that reached Interview, not 'X% of Applied that also Responded'".)

---

## Open Questions

1. **Should the "% of Applied" column show `—` or `0%` when Applied=0?**
   - What we know: UI-SPEC says Applied itself is always `100%`. CONTEXT is silent on the denominator-zero edge case.
   - What's unclear: Design preference for `—` vs `0%` for downstream rows.
   - Recommendation: Default to `0%` (per A2 above). If user reacts negatively, change to `—`. The EmptyState hides the pure-zero case anyway.

2. **Should `totalRows === 0` trigger the EmptyState, or should "no scored rows" also trigger it?**
   - What we know: CONTEXT says "show empty state immediately when no data available". UI-SPEC empty-state copy is "No evaluated applications yet".
   - What's unclear: If the tracker has 5 rows all with null scores, should the panel show the empty state or show a funnel with 4 buckets all reading n=0?
   - Recommendation: Trigger EmptyState on `totalRows === 0`. If rows exist but all have null scores, render the panel — bucket section will show all 4 buckets with n=0 (per UI-SPEC "Always render all 4 bucket rows regardless of n=0") and funnel will show whatever status-based counts the rows produce. This handles the "user has Applied rows but no evaluation report" case.

3. **"Last updated" timestamp?** [Discretionary per CONTEXT]
   - What we know: Claude's discretion.
   - Recommendation: Skip it for Phase 6 — the panel auto-refreshes on file change, so the data is always fresh. Adding a timestamp creates a second source of truth about freshness. Defer unless user asks for it.

---

## Project Constraints (from CLAUDE.md)

- **Data Contract (System vs User layer):** `data/applications.md` is USER layer (never auto-updated). This phase only reads it via existing `readTracker` — no writes.
- **TSV-addition pattern is mandatory for tracker writes:** Not applicable — this phase is read-only.
- **Shared types live in `preload/types.ts`:** New analytics types MUST be added there (per STATE.md Accumulated Decisions).
- **No SQLite / no database:** File-backed state only — enforced by design of this phase (no new storage introduced).
- **Stack conventions:** Node.js (mjs), TypeScript for electron/, Tailwind CSS, React — all preserved.
- **Ethical use:** Not applicable — this is a read-only analytics view, no applications submitted.

---

## Environment Availability

SKIPPED — this phase is a code-only change to the Electron renderer. No external tools, services, runtimes, CLIs, or binaries beyond the already-installed dev dependencies (node, electron-vite, tsc) are required. Everything needed was verified present in `electron/package.json`.

---

## Runtime State Inventory

Not applicable — Phase 6 is a greenfield feature (new panel, new types, new component). No rename, refactor, or migration. No existing runtime state to reconcile.

---

## Security Domain

`security_enforcement` not explicitly declared — defaulting to enabled per agent guidance.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Panel is read-only; no auth surface |
| V3 Session Management | no | No sessions — desktop app, local file access |
| V4 Access Control | no | No multi-user — single-user local desktop |
| V5 Input Validation | minimal | Input is `TrackerRow[]` already parsed by `parseApplications()`; `score` is already `number \| null`, `status` is already trimmed string. No user-entered text reaches this panel. |
| V6 Cryptography | no | No secrets, keys, or crypto in this phase |

### Known Threat Patterns for React + Electron Renderer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rendered row content | Tampering | All row content rendered as React text nodes (not `dangerouslySetInnerHTML`); React auto-escapes. Status strings pass through StatusBadge with controlled color lookup — no raw HTML. |
| Division-by-zero DoS | Denial of Service (theoretical) | Guard division by Applied count (Pitfall 4) |
| Malformed applications.md crashing parser | Denial of Service | Existing `parseApplications()` defensively skips non-`\|`-prefixed lines, `fields.length < 8` rows, and bad score regex — returns `score: null` rather than throwing. Phase 6 must not add new assumptions about row shape. |
| Chart bar width injection (style inline `width: ${pct}%`) | Tampering | `pct` is always `number` (validated in `computeAnalytics` — `Math.round(0..100)`); not a string. React `style` prop is safe with numeric values. |

No new secrets, no new network calls, no new IPC surfaces added in Phase 6.

---

## Sources

### Primary (HIGH confidence)

- **[VERIFIED: codebase]** `electron/src/main/parsers/applications.ts` — confirmed `parseApplications` returns `TrackerRow[]` with `score: number|null` and `status: string`
- **[VERIFIED: codebase]** `electron/src/preload/types.ts:150` — `onFilesChanged: (callback: () => void) => () => void`
- **[VERIFIED: codebase]** `electron/src/preload/index.ts:22` — `subscribe<void>('files-changed', ...)`
- **[VERIFIED: codebase]** `electron/src/renderer/components/TrackerPanel.tsx` — `refreshKey` prop + `onFilesChanged` subscription pattern
- **[VERIFIED: codebase]** `electron/src/renderer/components/Sidebar.tsx` — `PanelId` union, `ITEMS` array, `NavItem` integration pattern
- **[VERIFIED: codebase]** `electron/src/renderer/App.tsx` — `activePanel` switch, `refreshKey` management, `FileChangeBanner` integration
- **[VERIFIED: codebase]** `electron/src/renderer/components/StatusBadge.tsx` — case-insensitive status lookup pattern; color palette reference
- **[VERIFIED: codebase]** `electron/src/renderer/components/ScoreBadge.tsx` — score-to-color mapping reference (≥4.0 → green, ≥2.5 → yellow, else red)
- **[VERIFIED: codebase]** `electron/tailwind.config.js` — Catppuccin Mocha tokens + typography scale confirmed
- **[VERIFIED: codebase]** `electron/package.json` — lucide-react 0.511.0, Tailwind 3.4.19, React 18.3.1 all confirmed; no test framework present
- **[VERIFIED: codebase]** `templates/states.yml` — canonical lowercase status IDs: `evaluated`, `applied`, `responded`, `interview`, `offer`, `rejected`, `discarded`, `skip`
- **[CITED: .planning/phases/06-response-rate-analytics-dashboard/06-CONTEXT.md]** — locked decisions
- **[CITED: .planning/phases/06-response-rate-analytics-dashboard/06-UI-SPEC.md]** — component inventory, color mapping, copywriting contract, TypeScript type shapes

### Secondary (MEDIUM confidence)

- **[CITED: .planning/REQUIREMENTS.md]** — ANAL-01, ANAL-02, ANAL-03 requirement text
- **[CITED: .planning/STATE.md]** — shared-types convention: "Shared types live in preload/types.ts — single source of truth"

### Tertiary (LOW confidence)

- None — this phase is almost entirely constrained by in-repo evidence. No unverified web claims relied upon.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency verified in package.json
- Architecture: HIGH — pattern replicated from TrackerPanel/DiscoverPanel with one documented divergence (isRefresh flag)
- Pitfalls: HIGH — derived from reading actual parser, StatusBadge, and canonical states.yml; funnel semantics called out by advisor review
- Types contract: HIGH — locked by UI-SPEC
- Assumptions (A1–A4): MEDIUM — documented for explicit surfacing to user during planning

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — codebase patterns are stable; no fast-moving external deps)

**Test framework status:** None in `electron/` (no vitest / jest config, no `*.test.ts` files). `nyquist_validation: false` in `.planning/config.json` — Validation Architecture section intentionally omitted per agent guidance. If tests are desired later, Vitest + @testing-library/react is the standard pairing for Vite-based Electron projects — `computeAnalytics` is a pure function and trivially testable in isolation.
