---
phase: 07-desktop-shortcut-auto-creation
plan: 01
subsystem: infra
tags: [electron, linux, xdg, desktop-entry, appimage, write-file-atomic]

# Dependency graph
requires:
  - phase: 05-electron-auto-update
    provides: "initUpdater wiring pattern in index.ts (setTimeout + void fire-and-forget)"
  - phase: 02-write-safety
    provides: "write-file-atomic project standard for atomic file writes"
provides:
  - "ensureDesktopShortcut() service — one-shot .desktop file creation on first packaged AppImage run"
  - "DESK-01 satisfied: ~/.local/share/applications/jobengine.desktop written on first run"
  - "DESK-02 satisfied: existsSync gate prevents any overwrite of existing .desktop file"
affects: [08-cv-upload, packaging, linux-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot fire-and-forget service: void fn() in app.whenReady, no BrowserWindow arg, no setTimeout"
    - "XDG Desktop Entry v1.5: Exec= double-quoted $APPIMAGE path, icon-theme name (not $APPDIR path)"
    - "Idempotency via existsSync gate — not mtime/hash/version sentinel"
    - "Independent existsSync guard for icon copy (separate from .desktop guard)"

key-files:
  created:
    - electron/src/main/services/desktop-shortcut.ts
  modified:
    - electron/src/main/index.ts

key-decisions:
  - "No process.platform === 'linux' guard — $APPIMAGE env var already excludes all non-AppImage runtimes"
  - "DESK-02: use existsSync(target) as the sole idempotency gate — no mtime, hash, or version sentinel"
  - "Exec= line double-quotes $APPIMAGE path per XDG spec §exec-variables (T-07-01 threat mitigation)"
  - "Icon copy is best-effort and independently guarded — .desktop write proceeds even if icon is missing"
  - "Dev-mode guard (isPackaged) is silent — no log, diverges from updater.ts intentionally (dev runs are frequent)"

patterns-established:
  - "Service log prefix: [desktop-shortcut] — matches [updater] / [main] convention"
  - "Silent catch: console.warn only, no rethrow, no IPC push — error stays in main process logs"

requirements-completed: [DESK-01, DESK-02]

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 7 Plan 01: Desktop Shortcut Auto-Creation Summary

**XDG .desktop entry auto-created on first packaged AppImage run via write-file-atomic, existsSync idempotency gate, and fire-and-forget main-process wiring**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T17:02:39Z
- **Completed:** 2026-04-27T17:03:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- New service `electron/src/main/services/desktop-shortcut.ts` exports `ensureDesktopShortcut()` — 66 lines, one exported function, three private helpers
- Closes DESK-01: on first packaged AppImage run, writes `~/.local/share/applications/jobengine.desktop` with correct Exec=, Icon=, StartupWMClass= entries
- Closes DESK-02: `existsSync(target)` short-circuit prevents any overwrite of existing .desktop file (user customizations preserved)
- Icon copy from `$APPDIR/usr/share/icons/hicolor/256x256/apps/jobengine-electron.png` to stable user icon-theme path, independently guarded
- Wired into `electron/src/main/index.ts` with `void ensureDesktopShortcut()` after `setTimeout(initUpdater)` — fire-and-forget, never blocks startup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create services/desktop-shortcut.ts** - `6bc24fd` (feat)
2. **Task 2: Wire ensureDesktopShortcut() into index.ts** - `ea650d7` (feat)

**Plan metadata:** (committed with SUMMARY)

## Files Created/Modified

- `electron/src/main/services/desktop-shortcut.ts` (NEW) — one-shot service: dev-mode guard, $APPIMAGE guard, existsSync idempotency, icon copy, .desktop write via write-file-atomic at mode 0o644
- `electron/src/main/index.ts` (MODIFY +6 lines) — import + void call site after setTimeout(initUpdater)

## Acceptance Criteria Results

### Task 1 (14 criteria — all PASS)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `export async function ensureDesktopShortcut(): Promise<void>` present | PASS |
| 2 | Exactly 4 imports (electron, fs, path, write-file-atomic); no BrowserWindow/child_process/ipcMain | PASS |
| 3 | `Exec="${appImagePath}"` present; no `getPath('exe')` | PASS |
| 4 | `if (!app.isPackaged) return` present; silent (no log on that branch) | PASS |
| 5 | `process.env.APPIMAGE` guard with informative skip log | PASS |
| 6 | `if (existsSync(target)) return` present; no mtime/hash/sha256 | PASS |
| 7 | `fs.mkdir(path.dirname(...), { recursive: true })` count = 2 | PASS |
| 8 | `writeFileAtomic(target, entry, { mode: 0o644 })` present | PASS |
| 9 | `existsSync(iconSrc) && !existsSync(iconDst)` guard present | PASS |
| 10 | `console.warn('[desktop-shortcut] failed (non-fatal):')` present; no throw; no IPC refs | PASS |
| 11 | All 3 console calls use `[desktop-shortcut]` prefix (3/3) | PASS |
| 12 | No `process.platform`, no `setTimeout`, no `spawn\|exec(` | PASS |
| 13 | All Desktop Entry keys present: [Desktop Entry], Version=1.5, Type=Application, Name=JobEngine, Comment=, Terminal=false, Categories=Utility;, StartupWMClass=JobEngine | PASS |
| 14 | `npm run typecheck` exits 0 | PASS |

### Task 2 (5 criteria — all PASS)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Import line present; appears after `import { initUpdater } from './services/updater'` | PASS |
| 2 | `void ensureDesktopShortcut()` present; no await, no setTimeout wrapper, no args | PASS |
| 3 | Call after `setTimeout(initUpdater)` and before `app.on('activate')` | PASS |
| 4 | All existing lines preserved: registerIpcHandlers, startFileWatcher, initScheduler, setTimeout initUpdater | PASS |
| 5 | `npm run typecheck` exits 0 | PASS |

### Build (AC6 — optional)

`npm run build` exits 0. Output: `out/main/index.js 1,047.13 kB` built in 885ms.

## Decisions Made

- No `process.platform === 'linux'` guard — the `$APPIMAGE` environment variable is only set by the AppImage runtime (Linux-only), making the platform guard redundant and excluding all non-AppImage packaged builds cleanly
- Dev-mode guard is silent (no log) — diverges from `updater.ts` intentionally; dev runs are frequent and a skipped-log adds noise
- `existsSync(target) return` is the complete idempotency implementation — no version sentinel, mtime check, or content hash (these would violate DESK-02 by creating a path to overwrite)
- T-07-01 (shell injection via Exec= path) mitigated by double-quoting `${appImagePath}` per XDG Desktop Entry Spec §exec-variables

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Worktree has no `node_modules` (git worktrees share the working tree but not installed deps). Resolved by running typecheck and build temporarily against the main repo's `node_modules` (copied files, ran, restored). No code change required.

## Known Stubs

None. The service writes the actual .desktop file on first run; no placeholder content.

## Threat Flags

No new threat surface beyond the plan's threat model. All T-07-01 through T-07-06 items addressed in the implementation as specified.

## UAT Items (Deferred — requires packaged AppImage)

Per user preference: defer all human UAT until project is feature-complete. Adding 6 items to the deferred backlog (5 new from Phase 7 verification spec, 1 optional):

| # | Item | Deferred At |
|---|------|-------------|
| 15 | Run `npm run dist`, launch AppImage, verify `~/.local/share/applications/jobengine.desktop` exists with `Exec="<absolute-path>"` double-quoted | Phase 7 Plan 01 |
| 16 | Verify `~/.local/share/icons/hicolor/256x256/apps/jobengine.png` exists and matches bundled icon byte-for-byte | Phase 7 Plan 01 |
| 17 | Log out / log back in (or `update-desktop-database ~/.local/share/applications`); confirm "JobEngine" appears in system launcher with icon | Phase 7 Plan 01 |
| 18 | Manually edit `~/.local/share/applications/jobengine.desktop` (add `X-User-Edit=test`); run AppImage again; confirm file is BYTE-FOR-BYTE unchanged (DESK-02) | Phase 7 Plan 01 |
| 19 | Delete `.desktop` file; run AppImage again; confirm it gets recreated (DESK-01 recovery) | Phase 7 Plan 01 |
| 20 | Optional: install AppImageLauncher first, accept integration prompt, check whether two entries appear (T-07-06 accepted risk) | Phase 7 Plan 01 |

Prior deferred UAT backlog: 14 items across Phases 2–5. Total after Phase 7: 20 items.

## Next Phase Readiness

- Phase 7 Plan 01 complete — DESK-01 and DESK-02 satisfied in code
- No blockers for Phase 8 (CV Upload & PDF Extraction)
- Phase 8 verifies in dev mode (no packaged build required) — independent of Phase 7 UAT gate

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `electron/src/main/services/desktop-shortcut.ts` exists | FOUND |
| `electron/src/main/index.ts` exists | FOUND |
| `07-01-SUMMARY.md` exists | FOUND |
| Commit `6bc24fd` (Task 1) exists | FOUND |
| Commit `ea650d7` (Task 2) exists | FOUND |
| `ensureDesktopShortcut` exported | CONFIRMED |
| `void ensureDesktopShortcut()` call site in index.ts | CONFIRMED |
| import line in index.ts | CONFIRMED |

---
*Phase: 07-desktop-shortcut-auto-creation*
*Completed: 2026-04-27*
