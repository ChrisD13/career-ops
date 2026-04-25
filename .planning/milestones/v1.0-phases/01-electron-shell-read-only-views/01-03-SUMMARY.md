---
phase: 01-electron-shell-read-only-views
plan: 03
subsystem: ui
tags: [electron, renderer, react, catppuccin, tailwind, sidebar, ipc, lucide-react]

requires:
  - phase: 01-02
    provides: contextBridge window.api with onFilesChanged push event, TrackerRow/PipelineEntry/StatusEntry types in preload/types.ts

provides:
  - React root bootstrap at electron/src/renderer/main.tsx (ReactDOM.createRoot + StrictMode)
  - AppShell (App.tsx) owning activePanel, collapsed, filesChanged, refreshKey state
  - Sidebar.tsx with PanelId union type ('tracker' | 'reports' | 'pipeline') and expand/collapse
  - NavItem.tsx — 40px button with 3px left-border active indicator and collapsed icon-only mode
  - FileChangeBanner.tsx — 40px yellow banner wired to window.api.onFilesChanged push events
  - ScoreBadge.tsx — Catppuccin color pill with >=4.0/>=2.5/<2.5/null thresholds
  - StatusBadge.tsx — 8-entry whitelist color pill with case-insensitive lookup and fallback
  - EmptyState.tsx — centered heading+body placeholder for all 3 panels
  - ErrorState.tsx — centered error with optional retry button and AlertCircle icon
  - Human-verified: all 12 visual/functional steps APPROVED

affects:
  - 01-04 (tracker panel — imports ScoreBadge, StatusBadge, EmptyState, ErrorState; receives refreshKey from App.tsx)
  - 01-05 (reports + pipeline panels — same shared components; receives refreshKey from App.tsx)

tech-stack:
  added: [lucide-react (Table, FileText, Inbox, ChevronLeft, ChevronRight, RefreshCw, AlertCircle)]
  patterns:
    - AppShell owns all cross-cutting state (activePanel, collapsed, filesChanged, refreshKey); panels are pure consumers
    - PanelId union type exported from Sidebar.tsx — single source of truth for panel routing
    - refreshKey integer incremented on banner click — panels useEffect([refreshKey]) to re-fetch without prop drilling
    - FileChangeBanner subscribes to IPC push in useEffect with returned unsubscribe as cleanup (T-03-01 mitigation)
    - StatusBadge whitelist pattern: normalize .toLowerCase() → lookup in fixed Record → fallback to overlay (T-03-02 mitigation)
    - ScoreBadge threshold bucketing: >=4.0 green / >=2.5 yellow / else red / null overlay — matches UI-SPEC exactly

key-files:
  created:
    - electron/src/renderer/main.tsx
    - electron/src/renderer/App.tsx
    - electron/src/renderer/components/Sidebar.tsx
    - electron/src/renderer/components/NavItem.tsx
    - electron/src/renderer/components/FileChangeBanner.tsx
    - electron/src/renderer/components/ScoreBadge.tsx
    - electron/src/renderer/components/StatusBadge.tsx
    - electron/src/renderer/components/EmptyState.tsx
    - electron/src/renderer/components/ErrorState.tsx
  modified: []

key-decisions:
  - "refreshKey lives in App.tsx (not individual panels) — Plans 04-05 pass it as useEffect dependency to bust data caches without an additional context or store"
  - "PanelId exported from Sidebar.tsx — co-location with the component that owns the valid values; App.tsx imports the type from there"
  - "StatusBadge does not import StatusEntry — receives raw string from tracker row and normalizes internally; avoids coupling presentational component to IPC type"
  - "FileChangeBanner is a <button> element with role=status — doubles as live region and clickable dismiss target with a single focusable element"
  - "ScoreBadge uses UI-SPEC thresholds (>=4.0 / >=2.5) not pipeline.go thresholds (4.2/3.8/3.0) — UI-SPEC is authoritative for Electron"

patterns-established:
  - "Shared badge components (ScoreBadge, StatusBadge) are pure presentational — no IPC calls, no state, props only"
  - "All interactive elements use focus-visible:ring-2 focus-visible:ring-ctp-blue for keyboard accessibility"
  - "Sidebar collapse: dynamic width via style={{ width }} (48 | 200) — Tailwind cannot generate arbitrary pixel values at runtime"
  - "EmptyState/ErrorState center via flex-col items-center justify-center h-full — panels must fill parent height"

requirements-completed: [ELEC-01]

duration: 25min
completed: 2026-04-22
---

# Phase 1 Plan 03: Renderer Shell Summary

**React root + AppShell with Catppuccin sidebar, file-change banner wired to chokidar IPC push, and 6 shared presentational components (ScoreBadge, StatusBadge, EmptyState, ErrorState, NavItem, FileChangeBanner) — human-verified APPROVED across all 12 steps**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-22T17:00:00Z
- **Completed:** 2026-04-22T17:25:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 9 created, 0 modified

## Accomplishments

- All 9 renderer files created with zero TypeScript errors; `npm run build` exits clean
- refreshKey propagation pattern established — App.tsx increments on banner click; Plans 04-05 add it to useEffect dependency arrays to re-fetch data
- Human verification passed all 12 steps: sidebar nav switching, collapse/expand, chokidar file-touch banner, DevTools console clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared presentational components** — `8647af5` (feat)
2. **Task 2: AppShell + main.tsx + Sidebar** — `55ac598` (feat)
3. **Task 3: Human verification checkpoint** — APPROVED (no commit; checkpoint only)

## Files Created/Modified

- `electron/src/renderer/main.tsx` — React root bootstrap; ReactDOM.createRoot at #root; StrictMode; imports globals.css
- `electron/src/renderer/App.tsx` — AppShell: owns activePanel, collapsed, filesChanged, refreshKey state; subscribes to window.api.onFilesChanged; renders Sidebar + FileChangeBanner + panel EmptyState placeholders
- `electron/src/renderer/components/Sidebar.tsx` — Exports PanelId union type ('tracker' | 'reports' | 'pipeline'); 200px/48px dynamic width via inline style; three NavItems + collapse toggle
- `electron/src/renderer/components/NavItem.tsx` — 40px button with border-l-[3px] active indicator; aria-current="page" when active; title tooltip when collapsed; icon-only in collapsed mode
- `electron/src/renderer/components/FileChangeBanner.tsx` — Returns null when not visible; 40px bg-ctp-yellow/15 button with role="status" aria-live="polite"; RefreshCw icon; exact text "Files changed — click to refresh"
- `electron/src/renderer/components/ScoreBadge.tsx` — Thresholds: >=4.0 bg-ctp-green / >=2.5 bg-ctp-yellow / else bg-ctp-red / null bg-ctp-overlay; .toFixed(1) display; raw string fallback
- `electron/src/renderer/components/StatusBadge.tsx` — STATUS_COLOR record with 8 canonical ids; .trim().toLowerCase() normalization; bg-ctp-overlay fallback for unknown ids; STATUS_LABEL for display strings
- `electron/src/renderer/components/EmptyState.tsx` — Centered flex-col; h2 text-heading + optional p text-body; reusable placeholder for all 3 panels
- `electron/src/renderer/components/ErrorState.tsx` — AlertCircle icon (aria-hidden); h2 + optional body; conditional "Try again" button with focus-visible ring; onRetry prop pattern

## How refreshKey Propagates to Plans 04-05

App.tsx owns `const [refreshKey, setRefreshKey] = useState(0)`. The `handleRefresh` callback (called when the banner is clicked) does two things atomically: clears the banner (`setFilesChanged(false)`) and increments the key (`setRefreshKey(k => k + 1)`).

Plans 04-05 will receive `refreshKey` as a prop on their panel components. Each panel's data-fetch `useEffect` will list `refreshKey` in its dependency array:

```typescript
useEffect(() => {
  window.api.readTracker().then(setRows)
}, [refreshKey])
```

This means every time the user clicks the banner, all mounted panels automatically re-fetch — no event bus, no context, no store. The prop threading is already wired in App.tsx (the placeholder EmptyState body includes `refreshKey=${refreshKey}` to prove the value reaches the render tree).

## How PanelId Routes Between Panels

`PanelId` is a TypeScript union type exported from `Sidebar.tsx`:

```typescript
export type PanelId = 'tracker' | 'reports' | 'pipeline'
```

App.tsx imports it and uses it as the type for `activePanel` state. Panel routing is a simple conditional render:

```typescript
{activePanel === 'tracker' && <TrackerPanel refreshKey={refreshKey} />}
{activePanel === 'reports' && <ReportsPanel refreshKey={refreshKey} />}
{activePanel === 'pipeline' && <PipelinePanel refreshKey={refreshKey} />}
```

Because only one branch renders at a time, unmounted panels do not subscribe to IPC or accumulate stale data. Plans 04-05 replace the EmptyState placeholders with real panel components in these exact positions.

## Human Verification Result

**Status: APPROVED** — user confirmed all 12 steps passed.

Verification covered:
1. App launches via `cd electron && npm run dev`
2. Electron window opens
3. Sidebar visible with Catppuccin dark colors, "JobEngine" title, three nav items (Tracker/Reports/Pipeline with correct icons)
4. Tracker nav item initially active with blue left-border + blue text
5. Clicking Reports moves active indicator; content shows Reports placeholder
6. Clicking Pipeline moves active indicator; content shows Pipeline placeholder
7. Collapse toggle narrows sidebar to ~48px (icons only, title hidden)
8. Expand toggle restores 200px sidebar
9. `touch data/applications.md` triggers yellow banner within ~1 second reading "Files changed — click to refresh"
10. Clicking banner dismisses it
11. DevTools console shows no red errors; `[main] project root: /home/desachri/JobEngine` in terminal
12. Window closes cleanly

## Decisions Made

- refreshKey lives in App.tsx (not panels) — Plans 04-05 pass it as `useEffect` dependency to bust data caches without an additional context or store
- PanelId exported from Sidebar.tsx — co-location with the component that owns the valid values; App.tsx imports the type from there
- StatusBadge does not import StatusEntry — receives raw string from tracker row and normalizes internally; avoids coupling presentational component to IPC type
- FileChangeBanner is a `<button>` element with `role="status"` — doubles as live region and clickable dismiss target in one focusable element
- ScoreBadge uses UI-SPEC thresholds (>=4.0 / >=2.5) not pipeline.go thresholds (4.2/3.8/3.0) — UI-SPEC is authoritative for Electron

## Deviations from Plan

None — plan executed exactly as written. All 9 files matched plan specifications exactly. TypeScript reported zero errors. Human verification passed without any fixes needed.

## Issues Encountered

None. Build succeeded clean; all 12 verification steps passed on first attempt.

## User Setup Required

None — no external service configuration required.

## Known Stubs

The three panel content areas in App.tsx render EmptyState placeholders. This is intentional — they are replaced by real panel components in Plans 04 (tracker panel) and 05 (reports + pipeline panels). The placeholder body text includes `refreshKey=${refreshKey}` as proof the prop reaches the render tree; this text will be removed when real panels land.

## Threat Flags

No new security surfaces beyond the plan's threat model. All four STRIDE threats (T-03-01 through T-03-04) are mitigated as specified:
- T-03-01: useEffect cleanup returns window.api.onFilesChanged unsubscribe — no dangling ipcRenderer listeners on unmount
- T-03-02: StatusBadge whitelist pattern — unknown status ids fall back to neutral overlay, never render raw HTML
- T-03-03: console.log project root path is dev-only terminal output, no telemetry
- T-03-04: FileChangeBanner only flips on files-changed event, not on watcher-error event — no false banner on crash

## Next Phase Readiness

- Plan 04 (tracker panel) can import ScoreBadge, StatusBadge, EmptyState, ErrorState from their respective paths and slot into the `activePanel === 'tracker'` branch in App.tsx
- Plan 05 (reports + pipeline panels) has the same import paths available
- refreshKey is already threaded from App.tsx — panels only need to add it to their useEffect dependency array
- All accessibility foundations are in place (focus-visible rings, aria-label, aria-current, aria-live, aria-hidden on decorative icons)
- No blockers for Plans 04-05

## Self-Check: PASSED

- [x] electron/src/renderer/main.tsx exists
- [x] electron/src/renderer/App.tsx exists
- [x] electron/src/renderer/components/Sidebar.tsx exists
- [x] electron/src/renderer/components/NavItem.tsx exists
- [x] electron/src/renderer/components/FileChangeBanner.tsx exists
- [x] electron/src/renderer/components/ScoreBadge.tsx exists
- [x] electron/src/renderer/components/StatusBadge.tsx exists
- [x] electron/src/renderer/components/EmptyState.tsx exists
- [x] electron/src/renderer/components/ErrorState.tsx exists
- [x] Commits 8647af5 and 55ac598 verified in git log
- [x] Human verification checkpoint: APPROVED — all 12 steps passed

---
*Phase: 01-electron-shell-read-only-views*
*Completed: 2026-04-22*
