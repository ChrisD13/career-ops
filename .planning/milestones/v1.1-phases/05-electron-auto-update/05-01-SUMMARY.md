---
phase: 05-electron-auto-update
plan: "01"
subsystem: electron/preload
tags: [electron-updater, ipc-bridge, typescript, preload, github-releases]
dependency_graph:
  requires: []
  provides:
    - electron-updater runtime dep in package.json
    - GitHub publish config (provider:github, releaseType:release) in package.json#build
    - UpdaterStatus interface in preload/types.ts
    - ElectronAPI.onUpdaterStatus / updaterInstall / updaterDismiss declarations
    - preload/index.ts IPC bridge for all three updater channels
  affects:
    - electron/src/preload/types.ts (new interface + ElectronAPI extension)
    - electron/src/preload/index.ts (import + api object methods)
    - electron/package.json (dependency + build publish block)
tech_stack:
  added:
    - electron-updater@^6.8.3 (runtime dep)
  patterns:
    - subscribe<T> helper used for event channel (onUpdaterStatus)
    - ipcRenderer.invoke for command channels (updaterInstall, updaterDismiss)
    - TypeScript discriminated union for UpdaterStatus.phase
key_files:
  created: []
  modified:
    - electron/package.json
    - electron/src/preload/types.ts
    - electron/src/preload/index.ts
decisions:
  - key: extend package.json#build not create electron-builder.yml
    rationale: repo already has package.json#build with appId/linux/files; two config sources cause merge conflicts with unpredictable precedence; minimal-change path is to extend in place
  - key: drop updater:check IPC channel from preload bridge
    rationale: check fires automatically via setTimeout on main-process startup; no manual re-check trigger is needed; consistent with RESEARCH.md Q4 finding
  - key: include updater:dismiss channel in preload bridge
    rationale: required for "Later" button to persist dismissed version to disk; omitting it would make dismiss silently no-op
metrics:
  duration_minutes: 3
  completed_date: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 5 Plan 01: IPC Contracts — electron-updater Install + Preload Bridge Summary

**One-liner:** electron-updater@^6.8.3 wired to GitHub Releases publish config, UpdaterStatus discriminated-union type defined, and three-method IPC bridge (onUpdaterStatus / updaterInstall / updaterDismiss) exposed in the preload layer — giving Plans 02 and 03 stable contracts to build against in parallel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install electron-updater and add GitHub publish config | 2c7ee67 | electron/package.json |
| 2 | Add UpdaterStatus interface and ElectronAPI extension to types.ts | fa8f1f6 | electron/src/preload/types.ts |
| 3 | Expose updater IPC bridge in preload/index.ts | 60af6e2 | electron/src/preload/index.ts |

## Verification

All five overall verification checks passed:

1. `npm run typecheck` — exits 0, zero errors
2. `grep '"electron-updater"' electron/package.json` — PASS
3. `grep '"releaseType": "release"' electron/package.json` — PASS
4. `grep "onUpdaterStatus" electron/src/preload/index.ts` — PASS
5. `grep "export interface UpdaterStatus" electron/src/preload/types.ts` — PASS

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Documented Deviations (from RESEARCH.md, pre-approved in plan)

**1. package.json#build extended in place (not electron-builder.yml)**
- **Deviation type:** Pre-approved in plan action text
- **Reason:** repo already has package.json#build with appId/linux/files; creating electron-builder.yml alongside it introduces config-source ambiguity with unpredictable merge precedence
- **Impact:** Zero — electron-builder reads both sources; extending the existing source is the minimal-change path

**2. updater:check channel dropped from preload bridge**
- **Deviation type:** Pre-approved in plan action text (RESEARCH.md Q4)
- **Reason:** auto-update check fires via setTimeout on main-process startup; no manual re-check trigger is needed in the UI
- **Impact:** Zero — Plans 02 and 03 do not depend on a check trigger from the renderer

**3. updater:dismiss channel added (not in original CONTEXT.md IPC set)**
- **Deviation type:** Pre-approved in plan action text (RESEARCH.md Q4)
- **Reason:** required for "Later" to persist dismissed version; omitting it makes dismiss silently no-op
- **Impact:** Positive — enables correct "Later" behaviour in Plan 03

## Known Stubs

None — this plan defines interface contracts only. No data flows to the UI; stub tracking not applicable until Plan 03 wires the renderer.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what the plan's threat model covers.

| Flag | File | Description |
|------|------|-------------|
| (none) | — | All new surface covered by T-05-01 and T-05-02 in plan threat model |

## User Setup Required

Before running `npm run dist`, the user must:
1. Replace `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME` in `electron/package.json#build.publish` with the actual GitHub username/org and repo name
2. Set `GH_TOKEN` environment variable (GitHub PAT with `repo` scope) at build/publish time — NOT embedded in the app
3. Publish a first public (non-draft) GitHub Release at v0.1.0 with AppImage artifact and `latest-linux.yml` metadata file

## Self-Check: PASSED
