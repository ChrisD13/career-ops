# Phase 2: Write Safety + Anthropic Integration - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can evaluate job URLs directly inside the Electron app with streaming Claude output, see cache-hit indicators that prove token savings on repeat runs, and trust that every GUI write to the tracker is race-safe against the concurrent batch path. Also: CV viewer with one-click PDF regeneration, portal scan + batch evaluation triggered from the GUI, and API key management via OS secure storage.

In scope: Evaluate panel (URL→streaming A-G report), prompt caching + token cost display, cancel/error/retry UX, API key config via safeStorage, mtime-based context re-read skipping, concurrent-write safety (proper-lockfile + write-file-atomic) for status edits, CV viewer + PDF regen, GUI-triggered scan.mjs + batch runs, operations log drawer.

Out of scope: VC discovery, report editing, auto-update, multi-language mode in GUI.

</domain>

<decisions>
## Implementation Decisions

### Evaluate panel (API-01, API-02, API-03)
- **D-01:** Add a 4th sidebar panel "Evaluate" — dedicated full-viewport entry point for URL→streaming evaluation. URL field pre-fills when user navigates from a Pipeline entry. Streaming output renders in a ReportViewer-style pane (same react-markdown + GFM pipeline used in Phase 1); markdown formats live as tokens arrive.
- **D-02:** Cancel button is always visible while a stream is in-flight; cancelling mid-stream shows whatever was generated so far (partial report visible). On cancel the stream is aborted via AbortController and the IPC notifies the renderer.
- **D-03:** Error handling: 429 / 500 / auth failures render inline below the URL field (not a modal), with a Retry button that re-submits the same URL without user re-pasting. Auth errors link to the Settings slide-over. 429 errors show the retry-after delay if present in the response header.
- **D-04:** Streaming is delivered via Electron IPC events: main process opens the Anthropic streaming call, emits `evaluation:token` events as chunks arrive, and emits `evaluation:done` or `evaluation:error` when the stream ends. Renderer accumulates tokens into a string and updates state. This avoids websocket or HTTP overhead inside the app.

### Token cost & cache display (API-02)
- **D-05:** After the stream completes, a compact stats row appears below the report: `Input: X tokens | Cache hit: Y tokens (Z%) | Cost: ~$0.00N | Model: claude-sonnet-4-6`. Cache hit tokens come from `usage.cache_read_input_tokens` in the final stream event. If cache hit is 0 on first run, the row shows `Cache: warming (first run)`. On second run within an hour, `cache_read_input_tokens > 0` proves caching is working.
- **D-06:** A small spinner in the sidebar Evaluate item while a stream is in-flight (same pattern as operations console below).

### API key & first-run experience (API-04)
- **D-07:** Gear icon in the sidebar footer opens a Settings slide-over panel. Settings contains: API key field (password type, reveal toggle), a Verify button (makes a minimal `/models` list call to confirm key validity), and model selector (defaults to `claude-sonnet-4-6`).
- **D-08:** On first open with no key stored: a one-time dismissible banner at the top ("Add your Anthropic API key in Settings to evaluate offers — gear icon bottom-left"). The Evaluate panel's URL field is disabled with a tooltip: "Configure API key in Settings first."
- **D-09:** Key is stored via `safeStorage.encryptString` / `decryptString` (Electron built-in, uses OS keychain on macOS/Windows, libsecret on Linux). Never logged, never exposed to renderer. Renderer only receives a boolean `{ hasKey: true/false }` from `checkApiKey` IPC call. Actual key is only used in the main process for Anthropic SDK calls.

### mtime-based context re-read (API-05)
- **D-10:** `lib/mtime-cache.mjs` sidecar lives at `data/.mtime-cache.json` (matches REQUIREMENTS.md). Tracks `{ filePath: lastMtimeMs }` for the 5 context files: `cv.md`, `modes/_profile.md`, `modes/_shared.md`, `modes/oferta.md`, `config/profile.yml`. Before each evaluation, main process stats each file: if mtime unchanged, reuse cached content; if changed, re-read and update the mtime entry. The sidecar is written atomically (write-file-atomic) after each evaluation.
- **D-11:** The prompt cache hierarchy (stable → volatile): `_shared.md` → `oferta.md` → `cv.md` + `article-digest.md` (if exists) → `config/profile.yml` + `_profile.md` → JD in user turn. `cache_control: { type: "ephemeral" }` is applied at the boundary between the stable prefix and the volatile suffix per REQUIREMENTS.md API-02. TTL is not configurable in v2 (default 5-min Anthropic cache TTL for the standard tier; `"1h"` TTL requires extended cache which may need Beta header — Claude's discretion on whether to use extended cache or standard).

### Status write path — ELEC-08 completion
- **D-12:** StatusSelect moves from a single above-list stub (Phase 1) to a per-row inline control. Idle rows show the status badge (read-only appearance). Clicking a status cell activates the dropdown for that row only; other rows remain read-only.
- **D-13:** Auto-saves on selection — no separate save button. Write path: `updateStatus` IPC → main process → `proper-lockfile` lock on `data/applications.md` → read file → regex-replace the status field on the matching row → `write-file-atomic` to `data/applications.md` → release lock → IPC reply with success → renderer updates row optimistically (already reflected from user selection). Lock timeout: 5 seconds; on timeout, surface inline error "File locked by another process — try again."
- **D-14:** Status updates bypass the TSV-addition pattern — that pattern is for new rows only. Targeted line replacement is safe (same approach as `dashboard/internal/data/career.go:UpdateApplicationStatus`). Only new tracker entries (from batch evaluation results) go through `batch/tracker-additions/` → `merge-tracker.mjs`.
- **D-15:** After a successful write, the chokidar watcher will emit `files-changed`. Since the user triggered the write themselves, the FileChangeBanner is suppressed for writes originating from the GUI (main process tracks a `pendingGuiWrite` flag; watcher skips banner emission if flag is set, clears it after the debounce window).

### CV viewer & PDF regeneration (ELEC-06)
- **D-16:** New "CV" panel in the sidebar (5th item) renders `cv.md` using the same react-markdown pipeline as ReportViewer. A "Regenerate PDF" button in the panel header invokes `generate-pdf.mjs` via child_process in main, which streams stdout/stderr to the operations log drawer. On success, a "PDF saved to output/" toast appears.

### GUI-triggered scan + batch (ELEC-07)
- **D-17:** "Scan portals" button in the Pipeline panel header. "Run batch evaluation" button in a dedicated batch section of the Pipeline panel or in the Evaluate panel (Claude's discretion). Both launch their respective scripts via child_process in main, with stdout/stderr routed to the operations log drawer.

### Operations console (ELEC-07, ELEC-06)
- **D-18:** Collapsible log drawer at the bottom of the app shell (VS Code-style). Auto-opens when any long-running operation starts, streams stdout/stderr in a monospace scrolling view. Auto-collapses 5 seconds after clean exit (code 0). Stays open on non-zero exit and shows a red error badge. If multiple operations run concurrently, tabs appear in the drawer header (e.g., "Scan | Batch | PDF"). A small spinner/checkmark in the sidebar footer (next to the gear icon) indicates the most recent operation state.

### Claude's Discretion
- Whether to use Anthropic's extended cache (`"1h"` TTL via Beta header) or standard 5-min cache for the prompt prefix — either satisfies API-02's requirement that `cache_read_input_tokens > 0` is visible on a repeat run within an hour.
- Exact CSS for the log drawer (height, resize handle, font size).
- Whether "Run batch evaluation" button lives in Pipeline panel or Evaluate panel — pick whichever feels less cluttered after building the Evaluate panel.
- Model selector options in Settings (include only claude-sonnet-4-6 and claude-haiku-4-5 as sensible defaults for this use case).
- Split between 4 or 5 sidebar items — CV panel could be merged into a "Tools" panel alongside scan/batch triggers if 5 items feels crowded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — Full Phase 2 requirement list (ELEC-06 through API-05) with acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria (6 numbered items that must be TRUE)

### Prior phase context
- `.planning/phases/01-electron-shell-read-only-views/01-CONTEXT.md` — Phase 1 decisions: tracker layout, split pane, Catppuccin theme, IPC security rules, StatusSelect stub behavior

### Architecture and stack
- `.planning/codebase/ARCHITECTURE.md` — System layers; file-backed state as system of record; write concurrency patterns (proper-lockfile, write-file-atomic, TSV-addition)
- `.planning/codebase/STACK.md` — Existing stack baseline
- `.planning/codebase/CONVENTIONS.md` — Naming patterns; ESM module style; async fs.promises

### Existing Electron code (Phase 1 output — read before extending)
- `electron/src/preload/types.ts` — `ElectronAPI` interface; must extend with new IPC channels
- `electron/src/preload/index.ts` — contextBridge surface; new channels follow same one-function-per-operation pattern
- `electron/src/main/ipc-handlers.ts` — Existing IPC handlers; new write + streaming handlers go here
- `electron/src/main/watcher.ts` — chokidar watcher; `pendingGuiWrite` flag logic goes here
- `electron/src/renderer/App.tsx` — Panel routing; new Evaluate + CV panels added alongside tracker/reports/pipeline
- `electron/src/renderer/components/StatusSelect.tsx` — Phase 1 stub; Phase 2 activates it per-row

### Write safety contract
- `dashboard/internal/data/career.go:UpdateApplicationStatus` — Reference implementation for targeted status line replacement in applications.md (Golang, but the regex-replace pattern is the model to follow in Node)
- `data/applications.md` — File being written; lock must be acquired before read-modify-write
- `batch/tracker-additions/` — TSV-addition landing zone for NEW rows only (not status updates)
- `merge-tracker.mjs` — Merge script invoked after batch evaluation adds new TSV rows

### Anthropic SDK integration
- `modes/_shared.md` — Shared prompt context (first in cache hierarchy, most stable)
- `modes/oferta.md` — Evaluation mode prompt (second in cache hierarchy)
- `cv.md` — User CV (third in cache hierarchy)
- `modes/_profile.md` — User profile overrides (fourth in cache hierarchy, most volatile of the stable prefix)
- `config/profile.yml` — Profile YAML (alongside _profile.md in the volatile prefix)

### Data files
- `data/.mtime-cache.json` — mtime sidecar written by `lib/mtime-cache.mjs` (created in Phase 2)
- `data/pipeline.md` — Source for URL pre-fill in Evaluate panel
- `templates/states.yml` — Canonical status vocabulary for StatusSelect

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `electron/src/renderer/components/ReportViewer.tsx` — react-markdown + GFM pipeline; Evaluate panel streaming output reuses this component (or a streaming variant of it)
- `electron/src/renderer/components/SplitPaneLayout.tsx` — Split pane wrapper; usable if Evaluate panel needs side-by-side URL input + streaming output
- `electron/src/renderer/components/StatusBadge.tsx` — Read-only status display; replaces StatusSelect in idle rows
- `electron/src/renderer/components/FileChangeBanner.tsx` — Banner pattern; reuse for first-run API key nudge
- `electron/src/renderer/components/EmptyState.tsx` + `ErrorState.tsx` — Reuse for Evaluate panel states (no URL entered, stream error)
- `lib/statuses.mjs` — Status loading pattern in Node; the Electron parser equivalent is `electron/src/main/parsers/statuses.ts`
- `liveness-core.mjs` — Shared module pattern; `lib/mtime-cache.mjs` follows the same export pattern

### Established Patterns
- All IPC handlers use `ipcMain.handle` + `ipcRenderer.invoke` (request-response); streaming uses `ipcMain` + `webContents.send` (push events) — same distinction used by chokidar watcher today
- Zod validation on all IPC input paths (`ReportPathSchema` in ipc-handlers.ts is the model)
- `fs.promises` (async) throughout main process — no sync I/O
- contextBridge exposes one function per operation; streaming channels follow the same `on{Event}` pattern as `onFilesChanged`
- New context files (cv.md, profile.yml) are read via `fs.promises.readFile` with `utf-8` encoding, same as existing report reads

### Integration Points
- `electron/src/preload/types.ts` — Add new IPC channel types for: `evaluateUrl`, `cancelEvaluation`, `checkApiKey`, `saveApiKey`, `updateStatus`, `runScan`, `runBatch`, `regeneratePDF`, `onEvaluationToken`, `onEvaluationDone`, `onEvaluationError`, `onOperationOutput`, `onOperationDone`
- `electron/src/main/index.ts` — Register new IPC handlers alongside existing ones; initialize mtime-cache on startup
- `electron/src/renderer/App.tsx` — Add Evaluate and CV panel routes; add log drawer state at App level
- `electron/src/renderer/components/Sidebar.tsx` — Add Evaluate and CV nav items; add footer with gear icon + operation status indicator

</code_context>

<specifics>
## Specific Ideas

- The operations log drawer is explicitly VS Code-style: collapsible from the bottom, monospace font, tab-per-process, auto-collapse on clean exit, stays open on error. This is the mental model the planner should use.
- StatusSelect click-to-activate is per-row (not a global "edit mode"). Only the clicked row's cell transforms from a StatusBadge into a StatusSelect; all other rows remain read-only. This avoids accidental edits while scrolling.
- The 5-second auto-collapse for the log drawer applies to clean exits only. If any process in any tab exited non-zero, the drawer stays open until the user manually closes it.
- `pendingGuiWrite` flag in the watcher suppresses the FileChangeBanner for writes the GUI itself initiated — avoids the jarring "files changed" banner appearing immediately after the user saved a status.

</specifics>

<deferred>
## Deferred Ideas

- Sorting and filtering the tracker — deferred from Phase 1, still out of scope for Phase 2
- Inline report editing — v3+
- Electron auto-update (`electron-updater`) — v2.1
- Multi-language mode support in GUI — out of scope per REQUIREMENTS.md
- Model selector beyond sonnet/haiku — v3+
- Undo for status edits — not needed (git history is the undo mechanism)
- Streaming progress percentage / estimated completion — not available from Anthropic API; omit

</deferred>

---

*Phase: 02-write-safety-anthropic-integration*
*Context gathered: 2026-04-22*
