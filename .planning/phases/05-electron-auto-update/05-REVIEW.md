---
phase: 05-electron-auto-update
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - electron/package.json
  - electron/src/preload/types.ts
  - electron/src/preload/index.ts
  - electron/src/main/services/updater.ts
  - electron/src/main/ipc-handlers.ts
  - electron/src/main/index.ts
  - electron/src/renderer/components/UpdateBanner.tsx
  - electron/src/renderer/App.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This review covers the Phase 5 auto-update wiring: the `electron-updater` service, IPC handlers for install/dismiss, preload bridge, and the `UpdateBanner` renderer component. The architecture is sound — `autoInstallOnAppQuit = false`, the `win.isDestroyed()` guard before IPC push, the `update-available` suppression (no banner before download completes), and the atomic dismiss-file write are all correct.

One Critical issue: the `package.json` publish config still contains template placeholders (`YOUR_GITHUB_ORG` / `YOUR_REPO_NAME`). At runtime this causes a silent 404 that kills the entire feature with no user-facing signal. Two warnings involve an unsafe non-null assertion in the renderer and a missing regex end-anchor in input validation. Three info items cover a phantom union variant, a magic number, and an optimistic dismiss pattern.

The GitHub Actions release pipeline and the `latest-linux.yml` manifest publishing flow are not in scope for this review and should be validated separately before the first release tag.

---

## Critical Issues

### CR-01: Placeholder GitHub coordinates in publish config

**File:** `electron/package.json:58-60`
**Issue:** The `build.publish` block still has `"owner": "YOUR_GITHUB_ORG"` and `"repo": "YOUR_REPO_NAME"`. At startup `autoUpdater.checkForUpdates()` hits `https://api.github.com/repos/YOUR_GITHUB_ORG/YOUR_REPO_NAME/releases/latest`, which 404s. The error handler in `updater.ts:86-89` is intentionally silent (per CONTEXT.md). Combined, this means the entire auto-update feature fails silently and permanently on every packaged build until these are replaced with real values.
**Fix:**
```json
"publish": [
  {
    "provider": "github",
    "owner": "santifer",
    "repo": "jobengine",
    "releaseType": "release"
  }
]
```
Replace `owner` and `repo` with the actual GitHub repository coordinates before cutting the first release tag.

---

## Warnings

### WR-01: Non-null assertion on `status.version` — can pass `undefined` to IPC

**File:** `electron/src/renderer/components/UpdateBanner.tsx:48`
**Issue:** `status.version` is typed `string | undefined` in `UpdaterStatus`. The "Later" button calls `window.api.updaterDismiss(status.version!)`. If `version` is `undefined`, the non-null assertion suppresses the TypeScript error at compile time, but `VersionSchema.parse(undefined)` in `ipc-handlers.ts:261` throws a Zod error at runtime. In practice electron-updater always populates `version` in the `update-downloaded` event, but the type contract does not guarantee it and the assertion hides the gap.
**Fix:**
```tsx
onClick={() => {
  if (status.version) {
    void window.api.updaterDismiss(status.version)
  }
  setStatus(null)
}}
```
Alternatively, tighten `UpdaterStatus.version` from `string | undefined` to `string` (justified since `phase: 'downloaded'` always carries a version from electron-updater).

### WR-02: `VersionSchema` regex missing end anchor — accepts trailing garbage

**File:** `electron/src/main/ipc-handlers.ts:42`
**Issue:** `VersionSchema = z.string().regex(/^\d+\.\d+\.\d+/)` has no `$` end anchor. A value like `"1.2.3../../../../etc/passwd"` matches the pattern. The version string is used only as a JSON value in `dismissed-update.json` and is not passed to a path or shell, so this is not an immediate exploitable vulnerability. However it violates the principle that schema validation should reject malformed input entirely.
**Fix:**
```ts
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)
```

---

## Info

### IN-01: `UpdaterStatus.phase: 'downloading'` is a dead union variant

**File:** `electron/src/preload/types.ts:138`
**Issue:** The `UpdaterStatus` interface declares `phase: 'downloading' | 'downloaded'`, but `updater.ts` only ever sends `phase: 'downloaded'` (the `update-available` event intentionally does not emit a status). The `UpdateBanner` component guards `status.phase !== 'downloaded'` and returns null for any other value, making `'downloading'` unreachable in practice. This creates a misleading type contract.
**Fix:** Either remove `'downloading'` from the union to match actual behavior, or emit a `'downloading'` status in the `update-available` handler if a progress indicator is desired in a future iteration.

### IN-02: Magic number `5000` in startup delay

**File:** `electron/src/main/index.ts:93`
**Issue:** `setTimeout(() => { initUpdater(mainWindow) }, 5000)` uses a bare `5000` with an inline comment. For consistency with other numeric constants in the codebase and to make the intent self-documenting, this should be a named constant.
**Fix:**
```ts
const UPDATER_STARTUP_DELAY_MS = 5_000 // delay so startup UX is not blocked
setTimeout(() => { initUpdater(mainWindow) }, UPDATER_STARTUP_DELAY_MS)
```

### IN-03: Optimistic dismiss — banner can reappear if write fails

**File:** `electron/src/renderer/components/UpdateBanner.tsx:47-50`
**Issue:** The "Later" button calls `setStatus(null)` immediately (optimistic UI) before the `updaterDismiss` IPC write completes. If `setDismissedVersion` fails (e.g., disk full), the dismiss file is never written. On the next app launch, `update-downloaded` fires again for the same version and the banner reappears, requiring the user to click "Later" repeatedly.
**Fix:** No code change required for the current scope. If this becomes a UX issue, await the IPC result before clearing state:
```tsx
onClick={async () => {
  if (status.version) {
    await window.api.updaterDismiss(status.version)
  }
  setStatus(null)
}}
```

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
