---
phase: 01-electron-shell-read-only-views
plan: 02
subsystem: electron
tags: [electron, ipc, chokidar, zod, js-yaml, typescript, security, contextBridge]

requires:
  - phase: 01-01
    provides: electron-vite scaffold, tsconfig.node.json, package.json with chokidar/zod/js-yaml deps

provides:
  - Secure BrowserWindow with contextIsolation=true, sandbox=true, nodeIntegration=false (ELEC-01)
  - Content-Security-Policy header via session.defaultSession.webRequest.onHeadersReceived (dev/prod variants)
  - 5 ipcMain.handle channels: readTracker, readPipeline, readReport, readStatuses, listReports
  - 1 push event: files-changed (debounced chokidar → webContents.send)
  - Zod path validation on readReport (blocks path traversal before any fs call)
  - Three async parsers: applications.ts (career.go port), pipeline.ts (checkbox list), statuses.ts (YAML + fallback)
  - Shared type contract in preload/types.ts: TrackerRow, PipelineEntry, StatusEntry, ElectronAPI
  - contextBridge exposing exactly 6 methods on window.api
  - Compiled out/main/index.js (8.2 kB) and out/preload/index.js (0.7 kB)

affects:
  - 01-03 (tracker view — imports TrackerRow from types.ts, calls window.api.readTracker)
  - 01-04 (pipeline view — imports PipelineEntry, calls window.api.readPipeline)
  - 01-05 (report viewer — calls window.api.readReport with validated path)

tech-stack:
  added: [chokidar v5, zod, js-yaml, @electron-toolkit/utils]
  patterns:
    - IPC channel-per-operation (no generic eval/exec channel)
    - Zod parse-before-access for all external path inputs
    - contextBridge as sole renderer↔main boundary
    - chokidar awaitWriteFinish + 300ms debounce for atomic-write coalescing
    - WSL polling fallback via isWSL() environment variable check

key-files:
  created:
    - electron/src/preload/types.ts
    - electron/src/main/parsers/applications.ts
    - electron/src/main/parsers/pipeline.ts
    - electron/src/main/parsers/statuses.ts
    - electron/src/main/watcher.ts
    - electron/src/main/ipc-handlers.ts
    - electron/src/preload/index.ts
    - electron/src/main/index.ts
  modified: []

key-decisions:
  - "Shared types live in preload/types.ts (not duplicated in main or renderer) — single source of truth for TrackerRow, PipelineEntry, StatusEntry, ElectronAPI"
  - "Zod validation runs in main process before fs.readFile in readReport — renderer-supplied paths are untrusted; preload is a pass-through only"
  - "CSP is applied at HTTP-header layer (session.webRequest) not just <meta> — defense in depth against renderer injection"
  - "chokidar awaitWriteFinish(500ms) + 300ms debounce — two-layer protection against atomic-write event storms"
  - "isWSL() check for usePolling — defensive even though project is at native Linux path; guards against future /mnt/ moves"

patterns-established:
  - "IPC channel naming: exact English verb (readTracker, listReports) — discoverable and verifiable via grep count"
  - "Parser import pattern: import { SomeType } from '../../preload/types' — types imported, never redefined in main"
  - "Watcher cleanup pattern: startFileWatcher returns () => void unsubscribe; called on window 'closed'"
  - "Security flag pattern: contextIsolation/sandbox/nodeIntegration trio always set together; grep-verified"

requirements-completed: [ELEC-01, ELEC-02, ELEC-03, ELEC-04, ELEC-05]

duration: 15min
completed: 2026-04-22
---

# Phase 1 Plan 02: Main Process + Preload Bridge Summary

**Secure Electron main process with 5 read-only IPC channels, Zod path validation, chokidar watcher, and narrow contextBridge exposing 6 typed API methods — build output verified clean at 8.2 kB main + 0.7 kB preload**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-22T16:00:00Z
- **Completed:** 2026-04-22T16:11:34Z
- **Tasks:** 4
- **Files modified:** 8 created, 0 modified

## Accomplishments
- All 8 files from plan scaffolded exactly per specification; zero TypeScript errors on both tsconfig.json and tsconfig.node.json
- Full ELEC-01 security baseline: contextIsolation/sandbox/nodeIntegration triple enforced in BrowserWindow; webSecurity: true; no disabled variants present
- Zod schema `/^reports\/[^/]+\.md$/` blocks path traversal, absolute paths, and non-.md files before any fs call
- `npm run build` exits 0; out/main/index.js (8.20 kB) and out/preload/index.js (0.70 kB) produced
- chokidar watcher debounces 'all' events at 300ms with awaitWriteFinish(500ms) and WSL polling fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Main-process parsers + shared types** — `db31e1f` (feat)
2. **Task 2: chokidar watcher with debounce** — `b9882d4` (feat)
3. **Task 3: IPC handlers + preload contextBridge** — `7e7ebf2` (feat)
4. **Task 4: Main entry — security baseline + CSP + wiring** — `77626c6` (feat)

## Files Created/Modified

- `electron/src/preload/types.ts` — TrackerRow, PipelineEntry, StatusEntry, ElectronAPI interfaces; Window.api global augmentation
- `electron/src/main/parsers/applications.ts` — Port of career.go lines 16-102; regex constants for score/report/bold/trailing-date; tab vs pipe field-split; async fs.promises
- `electron/src/main/parsers/pipeline.ts` — Checkbox list parser; `/^-\s+\[( |x)\]\s+(.+)/` regex; splits on `' | '`
- `electron/src/main/parsers/statuses.ts` — js-yaml loader with 8-entry FALLBACK_STATES matching lib/statuses.mjs
- `electron/src/main/watcher.ts` — chokidar v5 watcher; 300ms debounce; awaitWriteFinish(500ms/100ms); isWSL() polling; win.isDestroyed() guard
- `electron/src/main/ipc-handlers.ts` — 5 ipcMain.handle registrations; Zod validation on readReport; newest-first listReports
- `electron/src/preload/index.ts` — contextBridge.exposeInMainWorld('api', ...); 5 ipcRenderer.invoke + onFilesChanged with removeListener unsubscribe
- `electron/src/main/index.ts` — BrowserWindow with full ELEC-01 flags; resolveProjectRoot(); installCspHeader() with dev/prod CSP; app lifecycle wiring

## IPC Contract

| Channel | Direction | Description |
|---------|-----------|-------------|
| readTracker | renderer → main | Parse data/applications.md → TrackerRow[] |
| readPipeline | renderer → main | Parse data/pipeline.md → PipelineEntry[] |
| readReport | renderer → main | Read reports/{file}.md (Zod-validated path) → string |
| readStatuses | renderer → main | Parse templates/states.yml → StatusEntry[] |
| listReports | renderer → main | readdir reports/ filtered to .md, newest first → string[] |
| files-changed | main → renderer | Debounced push when watched files change |

## Zod Path Validation

Schema: `z.string().regex(/^reports\/[^/]+\.md$/)`

Threats blocked:
- `../../.env` — contains `..`
- `/etc/passwd` — absolute path
- `reports/../cv.md` — contains `..` after reports/
- `reports/foo/bar.md` — contains `/` after filename segment
- `reports/foo.txt` — wrong extension
- Windows paths `C:\reports\foo.md` — does not match pattern

The schema runs in the main process (trusted); the preload forwards the raw value unchanged.

## Decisions Made

- Shared types in `preload/types.ts` imported by both main parsers and renderer — no duplication, single contract
- CSP set via session.webRequest (HTTP header layer) in addition to the `<meta>` tag in index.html — defense in depth
- `isWSL()` uses env vars `WSL_DISTRO_NAME` and `WSLENV` (both can indicate WSL context)

## Deviations from Plan

None — plan executed exactly as written. All 8 files matched plan specifications exactly. Pre-scaffolded files were verified against acceptance criteria and committed as-is.

## Issues Encountered

None. TypeScript reported zero errors on both tsconfig.json (renderer+preload) and tsconfig.node.json (main). Build completed cleanly in ~2.5 seconds.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. The renderer shows a placeholder page (from Plan 01-01 scaffold) until Plan 03 wires the React root. This is intentional per plan design — main.tsx stub was already committed in 01-01.

## Threat Flags

No new security surfaces beyond what the plan's threat model covers. All 8 STRIDE threats (T-02-01 through T-02-08) are mitigated as specified.

## Next Phase Readiness

- Plan 03 (tracker view) can import TrackerRow from `electron/src/preload/types.ts` and call `window.api.readTracker()`
- Plan 04 (pipeline view) can import PipelineEntry and call `window.api.readPipeline()`
- Plan 05 (report viewer) can call `window.api.readReport(path)` — Zod validation is transparent to renderer
- The `files-changed` event subscription via `window.api.onFilesChanged(cb)` is ready for any view to use
- No blockers for Plans 03-05

## Self-Check: PASSED

- [x] electron/src/preload/types.ts exists
- [x] electron/src/main/parsers/applications.ts exists
- [x] electron/src/main/parsers/pipeline.ts exists
- [x] electron/src/main/parsers/statuses.ts exists
- [x] electron/src/main/watcher.ts exists
- [x] electron/src/main/ipc-handlers.ts exists
- [x] electron/src/preload/index.ts exists
- [x] electron/src/main/index.ts exists
- [x] Commits db31e1f, b9882d4, 7e7ebf2, 77626c6 verified in git log
- [x] out/main/index.js exists
- [x] out/preload/index.js exists
- [x] npm run build exits 0
- [x] npx tsc --noEmit on both tsconfigs exits 0

---
*Phase: 01-electron-shell-read-only-views*
*Completed: 2026-04-22*
