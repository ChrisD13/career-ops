---
phase: 05-electron-auto-update
reviewed: 2026-04-24T12:00:00Z
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
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-24T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review of the Phase 5 auto-update wiring. Two issues from the prior review have been resolved: the non-null assertion on `status.version` in `UpdateBanner.tsx` has been replaced with a conditional guard, and the `VersionSchema` regex now has a `$` end anchor. The architecture remains sound — `autoInstallOnAppQuit = false`, the `win.isDestroyed()` guard before IPC push, the suppression of the banner until `update-downloaded` (not `update-available`), and the atomic dismiss-file write are all correct.

One new warning emerges from the fixed regex: `/^\d+\.\d+\.\d+$/` now correctly anchors both ends, but it rejects valid semver prerelease strings (e.g. `1.0.0-beta.1`). If electron-updater delivers such a version the `updater:dismiss` handler throws without a try/catch, the IPC rejects silently (renderer uses `void`), and the dismiss file is never written. Three info items remain from the prior review: a dead union variant, a magic number, and the optimistic dismiss pattern.

The `package.json` GitHub coordinates (`YOUR_GITHUB_ORG` / `YOUR_REPO_NAME`) are intentional placeholders documented as a `user_setup` item; they are not flagged here.

---

## Warnings

### WR-01: `VersionSchema` rejects prerelease semver — `updater:dismiss` has no try/catch

**File:** `electron/src/main/ipc-handlers.ts:42` and `ipc-handlers.ts:260-263`
**Issue:** `VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)` rejects any semver prerelease (e.g. `1.0.0-beta.1`, `2.0.0-rc.2`). The `updater:dismiss` handler calls `VersionSchema.parse(raw)` without a try/catch. If electron-updater emits a prerelease version string — which `releaseType: "release"` makes unlikely but does not prevent — the parse throws, the IPC promise rejects, and the renderer's `void window.api.updaterDismiss(status.version)` swallows the error. `setStatus(null)` still hides the banner (called unconditionally), but `dismissed-update.json` is never written. On the next launch the banner reappears for the same version. The failure is fully silent.

Compare to sibling handlers `saveApiKey` (line 80) and `addVcFirm` (line 207) which both wrap parse/write in try/catch and return structured error objects.

**Fix — option A:** Wrap the handler body to match the sibling pattern:
```ts
ipcMain.handle('updater:dismiss', async (_e, raw: unknown) => {
  try {
    const version = VersionSchema.parse(raw)
    await setDismissedVersion(version)
  } catch (err: any) {
    console.warn('[updater] dismiss failed:', err?.message)
    // non-fatal — dismiss is best-effort
  }
})
```

**Fix — option B:** Widen the regex to accept prerelease semver and eliminate the parse failure root cause:
```ts
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/)
```

Both fixes should be applied together for defense in depth.

---

## Info

### IN-01: `UpdaterStatus.phase: 'downloading'` is a dead union variant

**File:** `electron/src/preload/types.ts:138`
**Issue:** The `UpdaterStatus` interface declares `phase: 'downloading' | 'downloaded'`, but `updater.ts` only ever sends `phase: 'downloaded'` (the `update-available` event intentionally does not emit a status). `UpdateBanner` guards `status.phase !== 'downloaded'` and returns null for any other value, making `'downloading'` unreachable in practice. This creates a misleading type contract.
**Fix:** Either remove `'downloading'` from the union to match actual behavior, or emit a `'downloading'` status in the `update-available` handler if a progress indicator is desired in a future iteration.

### IN-02: Magic number `5000` in startup delay

**File:** `electron/src/main/index.ts:93`
**Issue:** `setTimeout(() => { initUpdater(mainWindow) }, 5000)` uses a bare numeric literal. The intent is documented in the inline comment, but consistency with other numeric constants in the codebase favors a named constant.
**Fix:**
```ts
const UPDATER_STARTUP_DELAY_MS = 5_000 // delay so startup UX is not blocked
setTimeout(() => { initUpdater(mainWindow) }, UPDATER_STARTUP_DELAY_MS)
```

### IN-03: Optimistic dismiss — banner can reappear if write fails

**File:** `electron/src/renderer/components/UpdateBanner.tsx:47-52`
**Issue:** The "Later" button calls `setStatus(null)` unconditionally, regardless of whether the `updaterDismiss` IPC write succeeded. If `setDismissedVersion` fails (e.g., disk full, permissions error), the dismiss file is never written, the banner hides immediately, but reappears on the next launch for the same version. This is benign in the common path but produces a confusing repeat experience under error conditions.
**Fix:** No code change required for current scope. If this becomes a UX issue, await the IPC result before clearing state:
```tsx
onClick={async () => {
  if (status.version) {
    await window.api.updaterDismiss(status.version)
  }
  setStatus(null)
}}
```

---

_Reviewed: 2026-04-24T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
