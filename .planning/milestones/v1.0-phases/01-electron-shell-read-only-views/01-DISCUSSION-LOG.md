# Phase 1: Electron Shell + Read-Only Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 01-electron-shell-read-only-views
**Areas discussed:** Tracker column set, File refresh model, Report navigation

---

## Area Selection

| Option | Selected |
|--------|----------|
| Navigation layout | |
| Tracker column set | ✓ |
| File refresh model | ✓ |
| Report navigation | ✓ |

---

## Tracker column set

| Option | Description | Selected |
|--------|-------------|----------|
| All 9 columns | Show everything from applications.md. Matches source 1:1. | ✓ |
| Core 6: Company, Role, Score, Status, Date, Report | Hide #, PDF emoji, Notes. More scannable. | |
| Minimal 4: Company, Role, Score, Status | Essentials only, rest on expand. | |

**User's choice:** All 9 columns

---

| Option | Description | Selected |
|--------|-------------|----------|
| Compact (~32px rows) | More rows visible, similar to Linear. | |
| Comfortable (~48px rows) | More breathing room per row. | |
| Claude's discretion | Claude decides row height. | ✓ |

**User's choice:** Claude's discretion

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — read-only snapshot | No sort/filter in Phase 1. Cmd+F for search. | ✓ |
| Sort only (click column header) | Client-side sort, simple with react-window. | |
| Filter by status only | Single status dropdown filter. | |

**User's choice:** No sorting/filtering in Phase 1

---

## File refresh model

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-refresh silently | chokidar detects change, view re-renders automatically. | |
| Show a 'Refresh' banner, user clicks to apply | Banner appears at top; user controls when view updates. | ✓ |
| Manual refresh button only | No file watching; user presses a button. | |

**User's choice:** 'Files changed' banner — user clicks to apply

---

| Option | Description | Selected |
|--------|-------------|----------|
| All data files | applications.md, pipeline.md, and reports/*.md trigger banner. | ✓ |
| Tracker only | Only applications.md triggers banner. | |
| Claude's discretion | Claude decides which files to watch. | |

**User's choice:** All data files

---

## Report navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Open report inline, same panel | Replaces tracker with report viewer; back button returns. | |
| Open report in a right split pane | Tracker stays left, report renders right. | ✓ |
| Open report in a modal/drawer | Report as full-screen overlay or side drawer. | |

**User's choice:** Right split pane

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both paths | Tracker split pane + standalone reports panel. | ✓ |
| No — reports only via tracker | Tracker is the only entry point to reports. | |
| Claude's discretion | Claude decides whether to add standalone reports panel. | |

**User's choice:** Both paths (tracker split pane AND standalone reports panel)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Formatted markdown (react-markdown) | Bold, headers, tables, code blocks render visually. | ✓ |
| Plain text / monospace | Raw markdown source in monospace font. | |
| Claude's discretion | Claude decides the rendering approach. | |

**User's choice:** Formatted markdown (react-markdown or similar)

---

## Claude's Discretion

- Row height / density in the react-window virtualized list
- Status dropdown Phase 1 behavior (disabled, active-no-persist, or tooltip)
- Top-level navigation structure (tab bar vs. sidebar)
- Split pane sizing defaults

## Deferred Ideas

- Sorting and filtering the tracker (Phase 2+)
- Navigation layout (left to planner)
- Inline report editing (v3+)
- Electron auto-update (v2.1)
