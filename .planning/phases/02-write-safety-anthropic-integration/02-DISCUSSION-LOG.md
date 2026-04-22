# Phase 2: Write Safety + Anthropic Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 02-write-safety-anthropic-integration
**Areas discussed:** All (user delegated all decisions to Claude)

---

## Evaluate Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| New "Evaluate" sidebar panel | Dedicated full-viewport panel, pre-fills URL from Pipeline, streaming in ReportViewer-style pane | ✓ |
| Inline in Pipeline panel | URL input embedded in Pipeline view | |
| Modal overlay | Floating dialog over current panel | |

**User's choice:** "Use your best judgement on all of it"
**Notes:** Claude selected a dedicated 4th sidebar panel. Reasoning: modal overlay hides source context; pipeline-inline crowds the stream; dedicated panel is consistent with the existing sidebar pattern and gives evaluation the full viewport.

---

## Status Write UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row click-to-dropdown, auto-save | Click status cell → dropdown activates for that row only → saves on selection | ✓ |
| Global edit mode | Button enables editing on all rows simultaneously | |
| External form | Status edit in a sidebar drawer or modal | |

**User's choice:** Delegated to Claude.
**Notes:** Per-row inline activation matches modern data-grid UX. Write path uses proper-lockfile + write-file-atomic (not TSV-addition pattern — that is for new rows only). FileChangeBanner suppressed for GUI-initiated writes via `pendingGuiWrite` flag.

---

## API Key & First-Run Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Settings slide-over via gear icon, dismissible banner | Non-blocking; gear in sidebar footer; one-time nudge banner | ✓ |
| Blocking setup wizard | Prevents app use until key is configured | |
| Disabled button with tooltip only | No banner, only tooltip on the evaluate button | |

**User's choice:** Delegated to Claude.
**Notes:** Non-blocking approach preferred for a developer-facing tool. Key stored via Electron `safeStorage`. Renderer only receives `{ hasKey: boolean }` — actual key never crosses IPC to renderer.

---

## Operations Console

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible log drawer (VS Code-style) | Bottom drawer with tabs per process, auto-open on start, auto-collapse on clean exit | ✓ |
| Modal with progress | Blocking dialog per operation | |
| Status bar only | Minimal indicator, no output visible | |
| Silent + toast | No output during run, toast on completion | |

**User's choice:** Delegated to Claude.
**Notes:** VS Code-style log drawer fits a developer-facing tool. Shows real stdout/stderr (useful for diagnosing scan failures). Auto-collapse on clean exit avoids clutter; stays open on error. Sidebar footer shows operation spinner/checkmark.

---

## Claude's Discretion

All four areas delegated to Claude by user request. Decisions are fully captured in CONTEXT.md Implementation Decisions section (D-01 through D-18).

## Deferred Ideas

- Sorting/filtering tracker (Phase 1 carry-forward)
- Inline report editing (v3+)
- Electron auto-update (v2.1)
- Undo for status edits
- Streaming progress percentage (not available from API)
