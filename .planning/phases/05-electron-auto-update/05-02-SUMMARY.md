---
phase: 05-electron-auto-update
plan: "02"
subsystem: electron/main-process
tags: [electron-updater, auto-update, ipc, lifecycle]
dependency_graph:
  requires: [05-01]
  provides: [updater-service, updater-ipc-handlers, updater-lifecycle]
  affects: [electron/src/main/services/updater.ts, electron/src/main/ipc-handlers.ts, electron/src/main/index.ts]
tech_stack:
  added: [electron-updater]
  patterns: [fail-silent-error-handler, writeFileAtomic-dismiss-persistence, isDestroyed-guard-before-send, isPackaged-dev-guard]
key_files:
  created:
    - electron/src/main/services/updater.ts
  modified:
    - electron/src/main/ipc-handlers.ts
    - electron/src/main/index.ts
decisions:
  - autoInstallOnAppQuit=false prevents update from installing on normal window close
  - autoDownload=true starts download immediately on update-available; UI only shown after update-downloaded
  - fail-silent error handler: network errors swallowed with console.warn only
  - dismissed-update.json persisted to app.getPath('userData') via writeFileAtomic
  - setTimeout 5s delay prevents update check from blocking startup UX
metrics:
  duration: "~15 minutes"
  completed: "2026-04-24T13:41:04Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
---

# Phase 05 Plan 02: Main-Process Updater Service Summary

**One-liner:** electron-updater service wired to GitHub Releases with autoInstallOnAppQuit=false, dismiss persistence via writeFileAtomic, and 5-second startup delay.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create services/updater.ts | e1bc6a0 | electron/src/main/services/updater.ts |
| 2 | Add updater IPC handlers to ipc-handlers.ts | 6a5ff21 | electron/src/main/ipc-handlers.ts |
| 3 | Wire initUpdater lifecycle call in index.ts | 8b4fb72 | electron/src/main/index.ts |

## What Was Built

### services/updater.ts
New service implementing the auto-update backend:

- `initUpdater(win)`: dev-mode guard (`!app.isPackaged`), sets `autoDownload=true` and `autoInstallOnAppQuit=false`, registers all autoUpdater event handlers, calls `checkForUpdates()`
- `setDismissedVersion(version)`: writes `{ version }` to `userData/dismissed-update.json` using writeFileAtomic
- `installUpdate()`: calls `autoUpdater.quitAndInstall(false, true)` with hardcoded safe args
- Event handlers: `update-downloaded` checks dismissed version before pushing `updater:status` to renderer; `error` handler is fail-silent (log only)
- `isDestroyed()` guard before every `webContents.send` call

### ipc-handlers.ts additions
- Import: `installUpdate, setDismissedVersion` from `./services/updater`
- `VersionSchema = z.string().regex(/^\d+\.\d+\.\d+/)` — input validation for dismiss payload
- `updater:install` handler: no payload, calls `installUpdate()` with hardcoded args
- `updater:dismiss` handler: validates version string with VersionSchema before calling `setDismissedVersion`

### index.ts additions
- Import `initUpdater` from `./services/updater`
- `setTimeout(() => { initUpdater(mainWindow) }, 5000)` after `await initScheduler(...)` and before `mainWindow.on('closed', ...)`
- Placed outside `app.on('activate')` block — respects same idempotent-unsafe constraint as `registerIpcHandlers`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All threat mitigations from plan's threat model are implemented:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-05-03 | VersionSchema regex validates dismiss input before disk write | Implemented |
| T-05-04 | updater:install takes no payload; quitAndInstall args hardcoded | Implemented |
| T-05-05 | HTTPS + SHA512 enforced by electron-updater GitHub provider | Accepted (no custom mitigation needed) |
| T-05-06 | dismissFilePath hardcoded to userData — no user-controlled input | Accepted |
| T-05-07 | error event handler is fail-silent — no banner, log only | Implemented |

## Known Stubs

None. This plan creates the main-process backend only. The renderer-side UpdateBanner component (Plan 03) will consume the `updater:status` IPC push and call `updater:install` / `updater:dismiss`.

## Self-Check: PASSED

- [x] `electron/src/main/services/updater.ts` — FOUND
- [x] `electron/src/main/ipc-handlers.ts` — modified, FOUND
- [x] `electron/src/main/index.ts` — modified, FOUND
- [x] Commit `e1bc6a0` — FOUND (Task 1)
- [x] Commit `6a5ff21` — FOUND (Task 2)
- [x] Commit `8b4fb72` — FOUND (Task 3)
- [x] `npm run typecheck` — exits 0, zero errors
