---
phase: 01-electron-shell-read-only-views
plan: "04"
subsystem: renderer-tracker
tags:
  - electron
  - renderer
  - tracker
  - react-window
  - virtualization
  - split-pane
dependency_graph:
  requires:
    - "01-03"  # AppShell, Sidebar, FileChangeBanner, EmptyState, ErrorState, ScoreBadge, StatusBadge
    - "01-02"  # preload bridge with window.api.readTracker, readStatuses, readReport
  provides:
    - "TrackerPanel with FixedSizeList virtualization"
    - "SplitPaneLayout 45/55 split"
    - "StatusSelect disabled dropdown (ELEC-03)"
  affects:
    - "01-05"  # Plan 05 wires ReportViewer into the SplitPaneLayout right pane
tech_stack:
  added:
    - "react-window FixedSizeList (already installed, first use)"
    - "ResizeObserver for numeric FixedSizeList height (Pitfall 2 mitigation)"
  patterns:
    - "Sticky header outside FixedSizeList (Pattern 6 from RESEARCH)"
    - "itemData bundle pattern for react-window callbacks"
    - "Discriminated union LoadState (loading | error | ready)"
key_files:
  created:
    - electron/src/renderer/components/TrackerRow.tsx
    - electron/src/renderer/components/StatusSelect.tsx
    - electron/src/renderer/components/TrackerPanel.tsx
    - electron/src/renderer/components/SplitPaneLayout.tsx
  modified:
    - electron/src/renderer/App.tsx
decisions:
  - "StatusSelect mounted once above the list (not per-row) for Phase 1 ELEC-03 plumbing proof — Phase 2 moves it inline"
  - "openReportPath state lives in App.tsx, not TrackerPanel — SplitPaneLayout wraps the panel from outside"
  - "ResizeObserver initial fallback 400px prevents zero-height render before layout stabilizes"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 01 Plan 04: Tracker Panel + Split-Pane Layout Summary

**One-liner:** Virtualized tracker panel (react-window FixedSizeList) with 9-column sticky header, ResizeObserver height measurement, disabled StatusSelect (ELEC-03), and 45/55 SplitPaneLayout toggled by "Open report" row clicks.

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `electron/src/renderer/components/TrackerRow.tsx` | Created | react-window row component with 9 `role="gridcell"` cells, ScoreBadge/StatusBadge, Open report button |
| `electron/src/renderer/components/StatusSelect.tsx` | Created | Disabled native `<select>` with Phase 2 tooltip, cursor-not-allowed, opacity-60 |
| `electron/src/renderer/components/TrackerPanel.tsx` | Created | Full panel: sticky header, FixedSizeList, ResizeObserver, loading/error/empty states, StatusSelect mount |
| `electron/src/renderer/components/SplitPaneLayout.tsx` | Created | 45/55 CSS split with close button (aria-label="Close report pane"), independent scroll panes |
| `electron/src/renderer/App.tsx` | Modified | Added openReportPath state, handleOpenReport/handleCloseReport, TrackerPanel + SplitPaneLayout wiring |

## Column Widths — UI-SPEC Compliance

| Column  | UI-SPEC Width | Tailwind Class Used  | Match |
|---------|---------------|----------------------|-------|
| #       | 48px          | `w-12` (48px)        | Yes   |
| Date    | 88px          | `w-[88px]`           | Yes   |
| Company | 160px         | `w-40` (160px)       | Yes   |
| Role    | 200px         | `w-[200px]`          | Yes   |
| Score   | 72px          | `w-[72px]`           | Yes   |
| Status  | 120px         | `w-[120px]`          | Yes   |
| PDF     | 48px          | `w-12` (48px)        | Yes   |
| Report  | 72px          | `w-[72px]`           | Yes   |
| Notes   | flex          | `flex-1`             | Yes   |

Row height: `itemSize={ROW_HEIGHT}` where `ROW_HEIGHT = 32`. Header: `style={{ height: HEADER_HEIGHT }}` where `HEADER_HEIGHT = 36`. Both match UI-SPEC.

## ResizeObserver Height Measurement (Pitfall 2 Mitigation)

react-window's `FixedSizeList` requires a numeric `height` prop — passing `"100%"` renders 0 rows. TrackerPanel addresses this with:

1. A `listContainerRef` div wrapping FixedSizeList with `flex-1 min-h-0` (fills remaining space after sticky header)
2. A `useLayoutEffect` that runs a `ResizeObserver` on `listContainerRef.current`
3. Every resize event calls `setListHeight(Math.max(0, el.clientHeight))` — integer pixels
4. Initial fallback: `useState(400)` prevents zero-height render before layout stabilizes
5. `useLayoutEffect` re-runs when `state.kind` changes (loading → ready transition triggers re-measure)

This correctly passes `height={listHeight}` (number) to FixedSizeList, never the string `"100%"`.

## StatusSelect Mount Location (ELEC-03 Rationale)

Per the plan interface spec (D-09 / UI-SPEC decision):

> For Phase 1 read-only, the Status column shows ONLY the StatusBadge pill (no inline select). The StatusSelect component is exported and used in a separate compact form below the tracker header.

StatusSelect is mounted **once** in the sticky area strip above the virtualized list, seeded with the first canonical status. This satisfies ELEC-03 ("status selection UI exists and is populated from `window.api.readStatuses()`") as a plumbing proof without adding 740 `<select>` elements to the DOM. Phase 2 will move StatusSelect inline per-row.

## Split-Pane Open/Close Flow

State ownership: `openReportPath: string | null` lives in **App.tsx**.

1. User clicks "Open report" button in a TrackerRow → `data.onOpenReport(row.reportPath)` fires
2. `onOpenReport` propagates through `TrackerPanel`'s `itemData` → up to `handleOpenReport` in App.tsx
3. `handleOpenReport(path)` calls `setOpenReportPath(path)` → non-null triggers `SplitPaneLayout` branch
4. `SplitPaneLayout` renders: left=`<TrackerPanel>` (45%), right=Plan 05 placeholder (55%)
5. Right pane header shows `basename(openReportPath)` as title
6. User clicks × → `onClose={handleCloseReport}` → `setOpenReportPath(null)` → full-width TrackerPanel

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 98f2668 | `feat(01-04): TrackerRow + StatusSelect presentational components` |
| 2 | 73b707f | `feat(01-04): TrackerPanel virtualized list + SplitPaneLayout` |
| 3 | c1a04e6 | `feat(01-04): wire TrackerPanel + SplitPaneLayout into App.tsx` |

## Known Stubs

| Stub | File | Lines | Reason |
|------|------|-------|--------|
| Reports panel EmptyState | `App.tsx` | 62 | Intentional — Plan 05 replaces with real ReportViewer |
| Pipeline panel EmptyState | `App.tsx` | 65 | Intentional — Plan 05 replaces with pipeline inbox |
| Split-pane right side EmptyState | `App.tsx` | 43 | Intentional — Plan 05 wires `<ReportViewer path={openReportPath}>` |

These stubs do not prevent this plan's goals from being achieved. The tracker panel, virtualization, ELEC-02, ELEC-03, and D-06 (split-pane) are all functional.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's threat model covers. All threats in the STRIDE register (T-04-01 through T-04-05) are mitigated:

- T-04-01: Path traversal — readReport Zod validation in Plan 02 is the gate; renderer only receives pre-parsed `reportPath` from the tracker parser
- T-04-02: 740-row DoS — FixedSizeList renders ~40 DOM rows max (viewport + overscan)
- T-04-03: StatusSelect spoofing — native `disabled` attribute, tooltip, opacity-60, cursor-not-allowed
- T-04-04: Error message path disclosure — acceptable in local-only app; surfaces debug info
- T-04-05: FixedSizeList height=0 — ResizeObserver + 400px fallback prevent zero-height render

## Self-Check: PASSED

All 5 files confirmed on disk. All 3 task commits confirmed in git log:
- 98f2668: TrackerRow + StatusSelect
- 73b707f: TrackerPanel + SplitPaneLayout
- c1a04e6: App.tsx wiring
