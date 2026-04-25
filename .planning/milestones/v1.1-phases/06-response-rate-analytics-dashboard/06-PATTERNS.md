# Phase 6: Response-Rate Analytics Dashboard — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 4 new/modified files (+ 1 optional colocated helper)
**Analogs found:** 4 / 4 (exact or near-exact)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/renderer/components/AnalyticsPanel.tsx` (NEW) | panel / component | request-response + event-driven refresh | `electron/src/renderer/components/DiscoverPanel.tsx` | exact (same shape: `refreshKey` prop, `LoadState` union, `onFilesChanged` subscription, EmptyState/ErrorState rendering, pure client-side derivation) |
| `electron/src/renderer/components/computeAnalytics.ts` (NEW — colocated pure helper, optional) | utility / transform | batch (in-memory aggregation) | `electron/src/main/parsers/applications.ts` (pure transform shape) + inline `isMatched` helper at `DiscoverPanel.tsx:23-25` | role-match (pure `TInput[] → TOutput` function pattern) |
| `electron/src/renderer/App.tsx` (MODIFY) | routing / orchestrator | request-response | (self) existing `renderPanel` switch at `App.tsx:130-192` | exact (add one `case` arm) |
| `electron/src/renderer/components/Sidebar.tsx` (MODIFY) | navigation / config | config | (self) existing `ITEMS` array + `PanelId` union at `Sidebar.tsx:5-22` | exact (add one entry + one union member) |
| `electron/src/preload/types.ts` (MODIFY) | type contract / config | config | (self) existing `TrackerRow`, `VcCompany` interface blocks | exact (add three interfaces alongside existing phase-grouped blocks) |

**Key observation:** This phase is almost entirely *mirror an existing panel*. The pattern assignments are unusually concrete because the analog file (`DiscoverPanel.tsx`) implements all four of the load-state kinds, refresh-key prop, file-change subscription, and empty/error rendering — the only net-new behavior is the `isRefresh` flag divergence documented in UI-SPEC.

---

## Pattern Assignments

### `AnalyticsPanel.tsx` (new panel, event-driven refresh)

**Primary analog:** `electron/src/renderer/components/DiscoverPanel.tsx`
**Secondary analog (for `isRefresh` divergence):** research-only — no existing panel uses `isRefresh`; this is a locked UI-SPEC divergence. See Pattern divergence section below.

**Imports pattern** (mirror `DiscoverPanel.tsx:1-10`):
```typescript
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AnalyticsData, TrackerRow } from '../../preload/types'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { computeAnalytics } from './computeAnalytics' // or inline — see research recommendation
```

**Props + LoadState union** (`DiscoverPanel.tsx:12-21` — copy the discriminated-union shape exactly):
```typescript
interface Props {
  refreshKey: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; analytics: AnalyticsData; totalRows: number }
```

**Core fetch pattern** (`DiscoverPanel.tsx:27-50` is the canonical shape; the ONLY divergence is adding the `isRefresh` flag — see Pattern Divergence below):
```typescript
// EXACT analog from DiscoverPanel.tsx:32-43
const fetchData = useCallback(async () => {
  setState({ kind: 'loading' })
  try {
    const [rows, health] = await Promise.all([
      window.api.readVcCompanies(),
      window.api.readVcHealth(),
    ])
    setState({ kind: 'ready', rows, firms: health.firms })
  } catch (err) {
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}, [])

useEffect(() => { void fetchData() }, [fetchData, refreshKey])

useEffect(() => {
  const unsub = window.api.onFilesChanged(() => { void fetchData() })
  return () => unsub()
}, [fetchData])
```

**Loading / error / ready early-returns** (`DiscoverPanel.tsx:81-82` — copy the shape, replace copy strings per UI-SPEC Copywriting Contract):
```typescript
if (state.kind === 'loading') return <EmptyState heading="Loading VC companies…" />
if (state.kind === 'error') return <ErrorState heading="Could not load VC data" body={state.message} onRetry={() => void fetchData()} />
```
Swap strings for AnalyticsPanel to: `"Loading analytics..."`, `"Could not load analytics"`, `"Failed to read data/applications.md. Check the file exists and try again."` (locked by UI-SPEC Copywriting Contract lines 215-219).

**Empty-state trigger** (mirror `DiscoverPanel.tsx:111-117` — render EmptyState when derived data has no rows):
```typescript
if (state.totalRows === 0) {
  return <EmptyState
    heading="No evaluated applications yet"
    body="Score an offer to see analytics here. Your response rates and funnel will appear once you have data."
  />
}
```
Decision locked by research Open Question #2: trigger on `totalRows === 0`, not on "no scored rows." Rows with all-null scores still render the panel with `n=0` buckets (per UI-SPEC "Always render all 4 bucket rows regardless of n=0").

**Memoization pattern** (mirror `DiscoverPanel.tsx:75-79` — wrap derived computations in `useMemo`):
```typescript
// DiscoverPanel.tsx:75-79 analog — apply same pattern if computeAnalytics is inlined:
const matchedCount = useMemo(() => rows.filter(isMatched).length, [rows])
const filtered = useMemo(
  () => filter === 'matched' ? rows.filter(isMatched) : rows,
  [filter, rows],
)
```
For AnalyticsPanel: if computeAnalytics is not kept as a separate module, wrap the call site in `useMemo(() => computeAnalytics(rows), [rows])`. Because we compute analytics inside `fetchData` and store the result in state, an additional `useMemo` is NOT needed — the state already caches the derived data across renders until the next file change.

---

### Pattern Divergence: `isRefresh` flag (locked by UI-SPEC, not in any existing panel)

**Why divergent:** Every existing panel (`TrackerPanel.tsx:42-44`, `DiscoverPanel.tsx:32-34`, `CvPanel.tsx:25-33`) resets to loading state on every fetch, causing a visible flash. UI-SPEC mandates AnalyticsPanel suppress this flash on file-change refreshes.

**Implementation** (from UI-SPEC.md:144-164 and RESEARCH.md:188-204):
```typescript
const fetchData = useCallback(async (isRefresh = false) => {
  if (!isRefresh) setState({ kind: 'loading' })   // loading only on initial mount/refreshKey change
  try {
    const rows = await window.api.readTracker()
    const analytics = computeAnalytics(rows)
    setState({ kind: 'ready', analytics, totalRows: rows.length })
  } catch (err) {
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}, [])

useEffect(() => { void fetchData(false) }, [fetchData, refreshKey])  // initial mount + manual refresh button
useEffect(() => {
  const unsub = window.api.onFilesChanged(() => { void fetchData(true) })  // file change — no flash
  return () => unsub()
}, [fetchData])
```

**Single source that needs to be written from the UI-SPEC, not copied from any existing panel.** The plan must flag this divergence explicitly.

---

### Bar-chart + funnel-table rendering (no existing analog)

UI-SPEC locks the exact JSX. No direct analog in the codebase — TrackerPanel, DiscoverPanel, and CvPanel all render tables, not bar charts. The existing `StatusBadge.tsx:27-36` and `ScoreBadge.tsx:6-20` provide the color-class-selection pattern used inside bars:

**Color-class selection pattern** (from `ScoreBadge.tsx:7-13`, adapt to bucket index):
```typescript
// ScoreBadge picks color by score threshold; AnalyticsPanel picks color by bucket index
let classes = 'bg-ctp-overlay text-ctp-subtext'
let display = raw || '—'
if (score !== null) {
  if (score >= 4.0) classes = 'bg-ctp-green text-ctp-base'
  else if (score >= 2.5) classes = 'bg-ctp-yellow text-ctp-base'
  else classes = 'bg-ctp-red text-ctp-base'
  display = score.toFixed(1)
}
```
AnalyticsPanel color-per-bucket mapping locked by UI-SPEC (Score Bucket Color Mapping table, lines 93-102):
- 4.5–5.0 → `bg-ctp-green text-ctp-base`
- 4.0–4.4 → `bg-ctp-teal text-ctp-base`
- 3.0–3.9 → `bg-ctp-yellow text-ctp-base`
- <3.0 → `bg-ctp-red text-ctp-base`
- empty bucket (n=0) → `bg-ctp-overlay text-ctp-subtext`

**Bar JSX** (locked by UI-SPEC lines 483-494; no codebase analog):
```tsx
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

**Panel-header pattern** (mirror `TrackerPanel.tsx:138-152` — the sticky header uses `bg-ctp-surface` + `border-b border-ctp-overlay` + `text-label uppercase tracking-wider`):
```tsx
// TrackerPanel.tsx:138-152 (existing)
<div
  role="row"
  style={{ height: HEADER_HEIGHT }}
  className="flex items-center gap-2 px-2 bg-ctp-surface border-b border-ctp-overlay text-label text-ctp-subtext uppercase tracking-wider shrink-0"
>
  <div role="columnheader" className="w-12 text-right">#</div>
  ...
</div>
```
AnalyticsPanel section labels (`"Score → Response Rate"`, `"Application Funnel"`) must use the same `text-label uppercase tracking-wider` treatment per UI-SPEC Typography section.

---

### `computeAnalytics.ts` (utility, pure aggregation)

**Primary analog:** `electron/src/main/parsers/applications.ts` (pure async transform — same shape, different sync vs async)
**Secondary analog:** inline `isMatched` helper at `DiscoverPanel.tsx:23-25` (colocated pure helper pattern)

**Inline helper pattern** (`DiscoverPanel.tsx:23-25` — colocated pure function at top of file):
```typescript
// DiscoverPanel.tsx:23-25 — colocated pure helper
function isMatched(r: VcCompany): boolean {
  return Boolean(r.role_matches) || Boolean(r.funding_signal)
}
```

**Parser-as-pure-transform pattern** (`applications.ts:9-60` — input type → output type with no side effects beyond `fs.readFile`):
```typescript
// applications.ts:9-60 shape (async version; computeAnalytics is sync)
export async function parseApplications(filePath: string): Promise<TrackerRow[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const rows: TrackerRow[] = []
  // ... iterate, filter, map, return
  return rows
}
```

**Status normalization pattern** (must mirror `StatusBadge.tsx:28` exactly):
```typescript
// StatusBadge.tsx:28 — single source of truth for status normalization
const id = (status ?? '').trim().toLowerCase()
```
Apply inside `computeAnalytics`:
```typescript
function normStatus(row: TrackerRow): string {
  return (row.status ?? '').trim().toLowerCase()
}
```
**Do NOT redefine this normalization.** The `?? ''` guard from StatusBadge handles the (unlikely) null-status case the parser could theoretically produce.

**Full `computeAnalytics` contract** (from RESEARCH.md Code Examples, lines 342-396) — use this verbatim with these required elements:
1. Buckets: filter first on `r.score !== null` (Pitfall 3 guard)
2. Forward-progress sets as `const REACHED_X = new Set([...])` (canonical lowercase IDs from `templates/states.yml`)
3. Division guard: `appliedCount === 0 ? 0 : Math.round((n / appliedCount) * 100)` (Pitfall 4 guard)
4. Applied row's `pctOfApplied` hardcoded to `100` (locked by UI-SPEC Copywriting Contract line 221)
5. Bucket boundaries: `[4.5, 5.0]` inclusive both, `[4.0, 4.5)`, `[3.0, 4.0)`, `(-∞, 3.0)` (Assumption A4)

---

### `App.tsx` (modify — add routing case)

**Analog:** (self) existing `renderPanel` switch at `App.tsx:130-192`.

**Routing pattern** (`App.tsx:182-190` — `CvPanel` and `DiscoverPanel` are the closest shape because they also take `refreshKey` but not `onOpenReport`):
```typescript
// App.tsx:183-190 — exact pattern to mirror
case 'discover':
  return (
    <DiscoverPanel
      refreshKey={refreshKey}
      scrapeActive={scrapeActive}
      onRunScrape={handleRunScrape}
    />
  )
```

**New case to add** (minimal — AnalyticsPanel takes only `refreshKey`):
```typescript
case 'analytics':
  return <AnalyticsPanel refreshKey={refreshKey} />
```

**Import addition** (follow alphabetical grouping from `App.tsx:5-14`):
```typescript
import { AnalyticsPanel } from './components/AnalyticsPanel'
```
Insert alphabetically — between `// (none before A)` first import, so at the top of the component-imports block (current order: TrackerPanel, SplitPaneLayout, ReportViewer, ReportsPanel, PipelinePanel, EvaluatePanel, CvPanel, DiscoverPanel). The codebase does NOT enforce strict alphabetical ordering (DiscoverPanel comes after CvPanel which comes after EvaluatePanel etc), so insert near other panel imports — placement is not load-bearing.

---

### `Sidebar.tsx` (modify — add nav item + union member)

**Analog:** (self) existing `PanelId` union and `ITEMS` array at `Sidebar.tsx:5-22`.

**Union pattern** (`Sidebar.tsx:5` — add `'analytics'`):
```typescript
// BEFORE
export type PanelId = 'tracker' | 'pipeline' | 'reports' | 'evaluate' | 'cv' | 'discover'
// AFTER
export type PanelId = 'tracker' | 'pipeline' | 'reports' | 'evaluate' | 'cv' | 'discover' | 'analytics'
```

**ITEMS array pattern** (`Sidebar.tsx:15-22` — add one entry; UI-SPEC line 196 locks position "insert after `'discover'`"):
```typescript
// Sidebar.tsx:15-22 (existing)
const ITEMS: Array<{ id: PanelId; label: string; icon: typeof Table }> = [
  { id: 'tracker', label: 'Tracker', icon: Table },
  { id: 'pipeline', label: 'Pipeline', icon: Inbox },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'evaluate', label: 'Evaluate', icon: Zap },
  { id: 'cv', label: 'CV', icon: User },
  { id: 'discover', label: 'Discover', icon: Compass },
]
```

**Add:**
```typescript
{ id: 'analytics', label: 'Analytics', icon: BarChart },
```
at position 7 (after `discover`).

**Import addition** (`Sidebar.tsx:1` — extend the lucide-react destructure):
```typescript
// BEFORE
import { Table, FileText, Inbox, Zap, User, Compass, ChevronLeft, ChevronRight } from 'lucide-react'
// AFTER
import { Table, FileText, Inbox, Zap, User, Compass, BarChart, ChevronLeft, ChevronRight } from 'lucide-react'
```

**NavItem rendering is unchanged** — `Sidebar.tsx:34-44` already maps any ITEMS entry to a NavItem automatically, so active-state highlighting (`NavItem.tsx:12-14`) works for free.

---

### `preload/types.ts` (modify — add three interfaces)

**Analog:** (self) existing phase-grouped interface blocks, e.g. Phase 5 block at `types.ts:136-141`:

```typescript
// types.ts:136-141 — Phase 5 auto-update
export interface UpdaterStatus {
  phase: 'downloading' | 'downloaded'
  version?: string
  releaseNotes?: string | null
}
```

**Pattern:** add a `// Phase 6 — Analytics` comment separator + three interfaces. Placement recommendation: after the Phase 5 block (before `ElectronAPI` at `types.ts:143`), preserving chronological phase grouping:

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

**Note:** `ElectronAPI` is NOT modified. Per CONTEXT decision "no new IPC handle needed," there is no new method on `window.api`. The three new types are consumed only by the renderer (AnalyticsPanel + computeAnalytics helper).

---

## Shared Patterns

### File-change auto-refresh subscription

**Source:** `DiscoverPanel.tsx:47-50` (canonical form); preload bridge at `preload/index.ts:22` (`'files-changed'` IPC channel → `onFilesChanged` API).
**Apply to:** Any panel that reads file-backed state. In Phase 6: `AnalyticsPanel.tsx`.

```typescript
// DiscoverPanel.tsx:47-50 — canonical subscription shape
useEffect(() => {
  const unsub = window.api.onFilesChanged(() => { void fetchData() })
  return () => unsub()
}, [fetchData])
```

**Naming drift warning (from RESEARCH Pitfall 6):** CONTEXT.md says "file-changed event" — the actual API is plural: `onFilesChanged` and IPC channel `'files-changed'`. Plans and code must use the plural form.

### Loading / error / empty state triad

**Source:** `DiscoverPanel.tsx:81-117`, `TrackerPanel.tsx:114-133`, `CvPanel.tsx:72-73`.
**Apply to:** All panel components in the renderer.

```typescript
// DiscoverPanel.tsx:81-82 — the exact pattern
if (state.kind === 'loading') return <EmptyState heading="Loading VC companies…" />
if (state.kind === 'error') return <ErrorState heading="Could not load VC data" body={state.message} onRetry={() => void fetchData()} />
```
All three components (`EmptyState.tsx`, `ErrorState.tsx`, `LoadState` union) are already in the codebase. Do not create new loading/error UI.

### `LoadState` discriminated union

**Source:** `TrackerPanel.tsx:30-33`, `DiscoverPanel.tsx:18-21`.
**Apply to:** Any panel with async data fetching.

```typescript
// DiscoverPanel.tsx:18-21
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: VcCompany[]; firms: VcFirmHealth[] }
```
Replace the `'ready'` branch payload with phase-specific fields. For AnalyticsPanel: `{ kind: 'ready'; analytics: AnalyticsData; totalRows: number }`.

### `refreshKey` prop convention

**Source:** All existing panels accept `refreshKey: number` — `TrackerPanel.tsx:26`, `DiscoverPanel.tsx:13`, `ReportsPanel` (implicit, see App.tsx:165), `PipelinePanel` (App.tsx:146), `ReportViewer` (App.tsx:136). `App.tsx:28` owns the state and `App.tsx:39-42` increments it when user clicks the manual `FileChangeBanner` "Refresh" button.
**Apply to:** `AnalyticsPanel.tsx` MUST accept this prop (RESEARCH Pitfall 5). Include it in the `fetchData` `useEffect` dependency array.

```typescript
// Idiomatic pattern — DiscoverPanel.tsx:45
useEffect(() => { void fetchData() }, [fetchData, refreshKey])
```

### Status normalization

**Source:** `StatusBadge.tsx:28` — `const id = (status ?? '').trim().toLowerCase()`.
**Apply to:** `computeAnalytics.ts` — use identical normalization for all status comparisons. Canonical IDs from `templates/states.yml` are lowercase.

### Tailwind design tokens (Catppuccin Mocha)

**Source:** `electron/tailwind.config.js:7-19` — all `ctp-*` tokens verified.
**Apply to:** `AnalyticsPanel.tsx` styling. Do NOT introduce new color names; UI-SPEC color mapping table (`06-UI-SPEC.md:93-102`) maps every AnalyticsPanel surface to an already-declared token.

Verified tokens in use: `ctp-base`, `ctp-surface`, `ctp-overlay`, `ctp-text`, `ctp-subtext`, `ctp-blue`, `ctp-green`, `ctp-yellow`, `ctp-red`, `ctp-peach`, `ctp-mauve`, `ctp-sky`, `ctp-teal`.

---

## No Analog Found

| File / Behavior | Role | Reason |
|-----------------|------|--------|
| `isRefresh` flag (suppress loading flash on file-change refresh) | panel state management | No existing panel implements this — every analog (`TrackerPanel`, `DiscoverPanel`, `CvPanel`) unconditionally resets to `loading` on every fetch. Locked by UI-SPEC divergence note, not by codebase precedent. Must be written from RESEARCH Code Example (lines 188-204) + UI-SPEC Component Inventory (lines 144-164). |
| CSS-only horizontal bar chart | visualization | No bar-chart code exists in the codebase. UI-SPEC locks the exact JSX (lines 483-494). Must be written from UI-SPEC, not copied from an analog. |
| Funnel horizontal table (Stage / Count / % of Applied) | visualization | No funnel-shaped component exists. Panel-header pattern from `TrackerPanel.tsx:138-152` provides the `text-label uppercase tracking-wider` treatment but the data-row shape is new per UI-SPEC. |
| Cumulative "reached stage" semantics | aggregation | No existing code computes funnel semantics. Locked by RESEARCH Pitfall 1 + Code Examples (`computeAnalytics` full listing at RESEARCH.md:342-396). |

For each "no analog" item above, the planner must reference **RESEARCH.md Code Examples** (lines 336-497) and **UI-SPEC Component Inventory** (lines 106-200) as the primary sources — not a codebase file.

---

## Metadata

**Analog search scope:**
- `electron/src/renderer/components/` (all 43 components)
- `electron/src/renderer/hooks/` (3 hooks)
- `electron/src/preload/` (types + index)
- `electron/src/main/parsers/applications.ts` (pure transform analog)

**Files scanned:** 12 concrete reads (TrackerPanel, Sidebar, App, NavItem, EmptyState, ErrorState, DiscoverPanel, CvPanel, StatusBadge, ScoreBadge, applications parser, preload index/types) + `ls` on three directories + `grep` on tailwind tokens.

**Pattern extraction date:** 2026-04-24

**Key insight for planner:** Phase 6 is nearly a copy-paste of DiscoverPanel with three targeted swaps: (1) data source → `readTracker` instead of `readVcCompanies`/`readVcHealth`; (2) render body → bar rows + funnel table instead of company table; (3) fetchData signature → add `isRefresh` flag. The five-file edit surface is small; all shared patterns (LoadState union, refreshKey prop, onFilesChanged subscription, EmptyState/ErrorState) are already in the codebase and identified above with line numbers.
