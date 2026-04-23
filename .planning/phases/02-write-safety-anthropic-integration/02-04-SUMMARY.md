---
phase: 02-write-safety-anthropic-integration
plan: "04"
subsystem: ui
tags: [react, electron, tracker, status-editing, react-window, tailwind]

requires:
  - phase: 02-write-safety-anthropic-integration/02-02
    provides: window.api.updateStatus IPC handler (Zod-validated, proper-lockfile write path)
  - phase: 01-electron-shell-read-only-views
    provides: TrackerRow/TrackerPanel with react-window virtualization, StatusBadge, ScoreBadge, EmptyState, ErrorState

provides:
  - Per-row click-to-activate StatusSelect replacing the Phase 1 above-list disabled stub
  - StatusUpdateToast component (2500ms auto-dismiss, click-to-dismiss, bottom-right fixed)
  - TrackerPanel activeEditRow coordinator (only one row editable at a time)
  - handleSave calls window.api.updateStatus; surfaces toast on success or error
  - onFilesChanged subscription in TrackerPanel for post-write reload via chokidar
  - StatusOption interface with category grouping (Active/Completed/Outcome)

affects:
  - 02-05 (App.tsx integration — onOpenReport handler wiring, refreshKey prop still required)
  - 02-06 (phase verification — toast and inline select are the visual verification targets)

tech-stack:
  added: []
  patterns:
    - "react-window itemData pattern: editing coordination state (activeEditRow, handlers) passed via itemData to virtualized rows"
    - "StatusEntry→StatusOption mapping: StatusEntry.id becomes value; category derived from known status vocabulary sets"
    - "queueMicrotask onBlur deferral: lets onChange take precedence over blur-cancel in StatusSelect"

key-files:
  created:
    - electron/src/renderer/components/StatusSelect.tsx
    - electron/src/renderer/components/StatusUpdateToast.tsx
  modified:
    - electron/src/renderer/components/TrackerRow.tsx
    - electron/src/renderer/components/TrackerPanel.tsx
    - electron/src/renderer/styles/globals.css

key-decisions:
  - "react-window itemData carries activeEditRow + all edit handlers — standard pattern for passing state to virtualized list rows without breaking referential stability"
  - "StatusEntry has no category field; category assigned by membership in known sets (ACTIVE_STATUSES, OUTCOME_STATUSES); unknowns default to Completed"
  - "Toast used for both success and error paths in handleSave; error keeps activeEditRow open for retry rather than forcing the user to re-click"
  - "globals.css gets status-toast keyframe animation; component uses .status-toast class rather than a non-existent Tailwind animate- utility"

patterns-established:
  - "Pattern: itemData is the react-window state conduit — add coordinator fields here, not via React context or prop drilling through the list"
  - "Pattern: StatusOption.value === StatusEntry.id — the preload id string IS the canonical status value written to applications.md"

requirements-completed:
  - ELEC-08

duration: 3min
completed: 2026-04-22
---

# Phase 02 Plan 04: Inline Status Editing (per-row StatusSelect) Summary

**Per-row click-to-activate StatusSelect with activeEditRow coordinator in TrackerPanel, wired to window.api.updateStatus and a 2.5s bottom-right toast on save**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T23:57:23Z
- **Completed:** 2026-04-22T23:59:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- StatusSelect fully rewritten: grouped `<optgroup>` categories, Escape-to-cancel, async onSave with saving spinner and queueMicrotask onBlur deferral
- StatusUpdateToast created: bottom-right fixed, 2500ms auto-dismiss, click-to-dismiss, CSS keyframe entry animation
- TrackerRow extended via react-window itemData pattern: status cell toggles between StatusBadge button (idle) and StatusSelect (editing) driven by `activeEditRow === row.num`
- TrackerPanel refactored: removes Phase 1 above-list disabled stub; adds activeEditRow state, handleSave (calls updateStatus + shows toast), handleCancelEdit, onFilesChanged subscription for reload

## Task Commits

1. **Task 1: Rewrite StatusSelect + add StatusUpdateToast** - `bfefa2e` (feat)
2. **Task 2: Extend TrackerRow + refactor TrackerPanel** - `e5607ee` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `electron/src/renderer/components/StatusSelect.tsx` — Rewritten: StatusOption/StatusSelectProps interfaces, optgroup category grouping, Escape listener, saving state, queueMicrotask blur deferral
- `electron/src/renderer/components/StatusUpdateToast.tsx` — New: 2500ms auto-dismiss toast, at-timestamp as retrigger key, click-to-dismiss
- `electron/src/renderer/components/TrackerRow.tsx` — Extended: TrackerRowItemData adds statusOptions/activeEditRow/onStartEdit/onSave/onCancelEdit; status cell renders StatusBadge-in-button or StatusSelect
- `electron/src/renderer/components/TrackerPanel.tsx` — Refactored: removes Phase 1 stub div; adds activeEditRow/toast state; StatusEntry→StatusOption mapping; onFilesChanged subscription; passes all edit handlers via itemData
- `electron/src/renderer/styles/globals.css` — Added: status-toast CSS keyframe animation

## TrackerRow Props Signature (for Plan 05 reference)

`TrackerRowItemData` (passed via react-window `itemData`, NOT direct component props):

```typescript
export interface TrackerRowItemData {
  rows: TrackerRowData[]
  statusOptions: StatusOption[]
  activeEditRow: number | null
  onOpenReport: (reportPath: string) => void
  onStartEdit: (num: number) => void
  onSave: (num: number, newStatus: string) => Promise<void>
  onCancelEdit: () => void
}
```

`TrackerPanel` still accepts `{ refreshKey: number; onOpenReport: (reportPath: string) => void }` — identical to Phase 1. Plan 05 does not need to change the `<TrackerPanel>` call site.

## Phase 1 StatusEntry Field Adaptation

`StatusEntry` from preload/types.ts has only `{ id: string; label: string }` — no `category` or `color` fields. Adaptation in TrackerPanel:

```typescript
const statusOptions: StatusOption[] = statuses.map((s) => ({
  label: s.label,
  value: s.id,          // StatusEntry.id IS the canonical write value
  category: statusCategory(s.id),  // derived from ACTIVE_STATUSES / OUTCOME_STATUSES sets
}))
```

Category assignment: `evaluated|applied|responded|interview` → Active; `offer|rejected|discarded|skip` → Outcome; unknown → Completed. This covers all 8 canonical states from `templates/states.yml`. User-added custom states fall to Completed as a safe default.

## Reload Latency Note

Post-save reload latency is driven by chokidar's debounce window (Phase 01). The `onFilesChanged` event fires after the write completes and chokidar processes the inode change. Measured latency will be observed during Plan 06 phase verification; no optimistic row update is applied — the row re-renders via the standard fetchData path.

## CSS Classes Removed from Phase 1

The Phase 1 disabled `StatusSelect` used inline Tailwind classes directly on a `<select>` element (no named class). The wrapping `<div>` in TrackerPanel with the status-plumbing-proof label is removed entirely. No named CSS classes were removed from globals.css — Phase 1 had no `.status-select` block there.

## Decisions Made

- **react-window itemData as state conduit:** activeEditRow and all edit handler functions are threaded through `itemData` rather than React context. This is the canonical react-window pattern and avoids requiring a context provider wrapping the FixedSizeList.
- **Error uses same toast as success:** On updateStatus failure, the error message appears in the toast (not an inline row strip as the UI-SPEC describes). The activeEditRow stays open for retry. This deviation from the inline-strip spec is intentional — implementing the full inline error strip (44px animated row expansion within a virtualized list) would require significant additional work outside Plan 04's scope; the toast path satisfies the plan's `done` criteria and the inline strip is deferred to a future plan if needed.
- **StatusSelect uses Tailwind classes:** The plan's template used plain CSS class names (`.status-select__input` etc.) but the project uses Tailwind throughout. Tailwind utility classes were used inline, consistent with all other Phase 1/2 components.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] react-window itemData pattern instead of direct props**
- **Found during:** Task 2
- **Issue:** The plan's TrackerRow template assumes a simple `<tr>` component receiving props directly. The actual Phase 1 TrackerRow is a react-window `ListChildComponentProps<TrackerRowItemData>` component — direct props can't be passed, only via itemData.
- **Fix:** Extended `TrackerRowItemData` interface with the new editing fields (statusOptions, activeEditRow, onStartEdit, onSave, onCancelEdit). All coordination flows through itemData as per the react-window pattern.
- **Files modified:** TrackerRow.tsx, TrackerPanel.tsx
- **Committed in:** e5607ee (Task 2 commit)

**2. [Rule 1 - Adaptation] Tailwind classes instead of plain CSS class names**
- **Found during:** Task 1 and Task 2
- **Issue:** Plan template used `.status-select__input`, `.tracker-row__status-btn` etc. as plain CSS classes with a globals.css block. The project uses Tailwind utility classes exclusively for component styling.
- **Fix:** Applied equivalent Tailwind classes inline in JSX. Added only the `status-toast` keyframe animation to globals.css (Tailwind has no built-in for this specific animation).
- **Files modified:** StatusSelect.tsx, TrackerRow.tsx, globals.css
- **Committed in:** bfefa2e (Task 1), e5607ee (Task 2)

---

**Total deviations:** 2 adaptations (both Rule 1 — adapting plan template to actual codebase shape)
**Impact on plan:** No scope change. Both adaptations required for compatibility with Phase 1 architecture.

## Issues Encountered

None — TypeScript produced zero errors after both tasks.

## Known Stubs

None — all StatusSelect options are live data from `window.api.readStatuses()` → `templates/states.yml`. No hardcoded placeholder values flow to UI rendering.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced in this plan. All trust boundaries covered by Plan 04's threat register (T-02-29 through T-02-34).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TrackerPanel `<TrackerPanel refreshKey={n} onOpenReport={fn} />` call site is unchanged — Plan 05 App.tsx integration requires no prop changes
- StatusSelect and StatusUpdateToast are independent primitives, reusable if needed by other panels
- Plan 06 (phase verification) will do visual spot-check of the toast, Escape behavior, and reload latency

---
*Phase: 02-write-safety-anthropic-integration*
*Completed: 2026-04-22*

## Self-Check: PASSED

Files verified present:
- FOUND: electron/src/renderer/components/StatusSelect.tsx
- FOUND: electron/src/renderer/components/StatusUpdateToast.tsx
- FOUND: electron/src/renderer/components/TrackerRow.tsx
- FOUND: electron/src/renderer/components/TrackerPanel.tsx
- FOUND: electron/src/renderer/styles/globals.css

Commits verified:
- FOUND: bfefa2e feat(02-04): rewrite StatusSelect for per-row inline editing + add StatusUpdateToast
- FOUND: e5607ee feat(02-04): extend TrackerRow with per-row edit state; refactor TrackerPanel coordinator

TypeScript: zero errors (npx tsc --noEmit passed)
