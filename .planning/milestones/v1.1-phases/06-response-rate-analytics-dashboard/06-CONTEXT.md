# Phase 6: Response-Rate Analytics Dashboard - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A new Analytics panel in the Electron app that shows score-to-outcome correlation (response rates grouped by score bucket) and funnel stats (applied → responded → interview → offer counts). The panel derives its data from the existing TrackerRow data, auto-refreshes when applications.md changes via the existing file-changed event, and integrates into the Sidebar nav as a first-class panel.

</domain>

<decisions>
## Implementation Decisions

### Chart Implementation
- Visualization: CSS-only Tailwind bar charts — no new library dependency
- Score buckets: 4 buckets — 4.5–5.0, 4.0–4.4, 3.0–3.9, <3.0 (aligns with ROADMAP example)
- Bar content: response rate % + sample count (n=X) per bucket — most informative for targeting
- Funnel display: horizontal table format — stage → count → % of applied (matches existing table patterns)

### Data Architecture
- Compute in renderer from existing `readTracker` data — no new IPC handle needed
- Auto-refresh: reuse existing `file-changed` event; re-fetch via `readTracker` on event
- No minimum threshold — show empty state immediately when no data available
- Funnel stages: Applied → Responded → Interview → Offer (4 canonical forward-progress stages only; Rejected/Discarded excluded from funnel)

### Panel Integration & Layout
- New top-level Sidebar nav item "Analytics" with BarChart icon from lucide-react
- Section order: score correlation chart first, funnel table below
- Empty state: "No evaluated applications yet — score an offer to see analytics"
- Scroll behavior: vertically scrollable within panel content area (same as TrackerPanel)

### Claude's Discretion
- Exact Tailwind class choices for bars (height, colors, spacing) — follow existing ScoreBadge/StatusBadge color palette
- TypeScript types for aggregated analytics data shape
- Whether to show a "last updated" timestamp in the panel

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseApplications()` in `electron/src/main/parsers/applications.ts` — already returns `TrackerRow[]` with `score: number | null` and `status: string`
- `readTracker` IPC handle — already registered, returns `TrackerRow[]`
- `file-changed` event — chokidar already watches `data/applications.md` and pushes this event to the renderer
- Lucide-react already available — can import `BarChart` or `BarChart2` icon without new deps
- `ScoreBadge.tsx`, `StatusBadge.tsx` — color palette reference for bucket coloring

### Established Patterns
- Panel structure: `*Panel.tsx` component in `components/`, registered as a nav item in `Sidebar.tsx`, rendered in `App.tsx`
- File-change auto-refresh: `TrackerPanel.tsx` uses `window.api.onFileChanged` + `readTracker` refetch pattern
- Empty state: `EmptyState.tsx` component exists with icon + message pattern
- Hooks: stateful data hooks live in `hooks/` (see `useApiKeyState.ts`, `useEvaluationStream.ts`)

### Integration Points
- `electron/src/renderer/App.tsx` — add `<AnalyticsPanel />` render and activePanel routing
- `electron/src/renderer/components/Sidebar.tsx` — add "Analytics" nav item
- `electron/src/preload/types.ts` — add `AnalyticsData` type (score buckets + funnel)
- No main-process changes needed (reuse existing readTracker + file-changed)

</code_context>

<specifics>
## Specific Ideas

- Score buckets should match the ROADMAP example exactly: 4.5–5.0, 4.0–4.4, 3.0–3.9, <3.0
- "Response rate" definition: applications in bucket where status is Responded/Interview/Offer / total in bucket
- Funnel counts: absolute numbers only (not cumulative) — e.g., Interview = applications that reached Interview, not "X% of Applied that also Responded"
- Empty bucket: still show the bucket row with "0%" and "n=0" so the scale is consistent

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
