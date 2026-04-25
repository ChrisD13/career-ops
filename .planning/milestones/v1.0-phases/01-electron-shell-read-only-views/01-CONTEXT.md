# Phase 1: Electron Shell + Read-Only Views - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure Electron desktop app rendering the same tracker (740+ rows), evaluation reports, and pipeline inbox that the Go TUI already shows — reading from the existing file-backed state with zero write operations. Goal is proving the file bridge before Phase 2 introduces any write path.

In scope: secure Electron baseline, virtualized tracker view, markdown report viewer, pipeline inbox view, status dropdown UI (no persistence), file-change banner, report split pane.
Out of scope: any write to applications.md, reports, or pipeline.md; streaming evaluation; Anthropic API integration; VC discovery.

</domain>

<decisions>
## Implementation Decisions

### Tracker display
- **D-01:** Show all 9 columns by default: `#` | `Date` | `Company` | `Role` | `Score` | `Status` | `PDF` | `Report` | `Notes`. Matches the source file 1:1 — no hidden state.
- **D-02:** Row density is Claude's discretion. Pick what looks good in Tailwind + react-window.
- **D-03:** No sorting or filtering in Phase 1. Read-only snapshot — user can use Cmd+F. Sorting/filtering deferred to Phase 2+.

### File refresh model
- **D-04:** When any tracked file changes while the app is open, show a "files changed — click to refresh" banner at the top. User clicks to apply the update. Avoids mid-scroll disruption.
- **D-05:** Watch scope: `data/applications.md`, `data/pipeline.md`, and all `reports/*.md`. chokidar v5 handles the WSL `fs.watch` flakiness.

### Report navigation
- **D-06:** Clicking a Report link from the tracker opens the report in a **right split pane**. Tracker stays on the left, report renders on the right. Both panes scroll independently.
- **D-07:** There is also a **standalone Reports panel** (separate nav item) that lists all `reports/*.md` files for browsing without the tracker. Both paths exist: tracker → split pane AND reports panel → report view.
- **D-08:** Reports render as **formatted markdown** (react-markdown or equivalent). Bold, headers, tables, and code blocks render visually — matching the A–G report structure.

### Status dropdown
- **D-09:** Claude's discretion on the Phase 1 UX for the status dropdown (ELEC-03). Requirement says "selection UI exists; persistence hardens in Phase 2." Options: render it disabled with a tooltip, or active but silently non-persisting, or omit persistence feedback entirely.

### Claude's Discretion
- Row height / density in the react-window virtualized list
- Status dropdown Phase 1 behavior (disabled, active-no-persist, or tooltip)
- Top-level navigation structure (tab bar vs. sidebar — user did not specify)
- Split pane sizing defaults (e.g., 40/60 or 50/50 tracker/report ratio)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — Full requirement list for Phase 1 (ELEC-01 through ELEC-05) with acceptance criteria
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 numbered items that must be TRUE)

### Architecture and stack decisions
- `.planning/research/SUMMARY.md` — Recommended stack table, top pitfalls, concurrency contract, IPC security rules, build order rationale
- `.planning/codebase/STACK.md` — Existing Node + Go + Playwright stack baseline
- `.planning/codebase/STRUCTURE.md` — Where existing code lives; where to add Electron code

### Data files the Electron app reads
- `data/applications.md` — Tracker source of truth (740+ rows, 9 columns)
- `data/pipeline.md` — Pipeline inbox the app must display
- `templates/states.yml` — Canonical status values for the dropdown (ELEC-03)
- `reports/*.md` — Evaluation reports to render as markdown

### Security baseline (ELEC-01 — non-negotiable)
- `.planning/research/SUMMARY.md` §Key Architecture Decisions — IPC contract, contextBridge rules, Zod validation in preload + main

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard/internal/data/career.go`: Go parser for `applications.md` — reference for column parsing logic when writing the Electron/Node equivalent
- `dashboard/internal/ui/screens/pipeline.go`: Go pipeline list screen — reference for what the pipeline view should show
- `templates/states.yml`: Canonical status values — load this file at runtime for the dropdown options (same pattern as `lib/statuses.mjs`)
- `lib/statuses.mjs`: Node-side status loading pattern — Electron main process can reuse this logic

### Established Patterns
- All data reads in Node use `fs.promises` (async) — Electron main process must follow the same pattern; no sync I/O
- Kebab-case `.mjs` scripts at project root — new Electron-specific Node helpers follow the same convention
- `liveness-core.mjs` shows the pattern for a shared module reused across multiple scripts — any Electron IPC helpers that need sharing follow this model

### Integration Points
- `data/applications.md` — Electron reads (never writes in Phase 1); chokidar watches this file
- `data/pipeline.md` — Electron reads; chokidar watches this file
- `reports/` — Electron reads individual report files on demand; chokidar watches the directory
- `templates/states.yml` — Electron reads once at startup (or re-reads on change) for dropdown options
- `package.json` — New Electron entry script and build commands added here

</code_context>

<specifics>
## Specific Ideas

No specific UI references from discussion — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- Sorting and filtering the tracker — deferred to Phase 2+
- Navigation layout decision (tab bar vs. sidebar) — left to Claude's discretion during planning
- Inline report editing — v3+ (from REQUIREMENTS.md v2 Deferred)
- Electron auto-update (`electron-updater`) — v2.1 (from REQUIREMENTS.md v2 Deferred)

</deferred>

---

*Phase: 01-electron-shell-read-only-views*
*Context gathered: 2026-04-22*
