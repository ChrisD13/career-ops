---
phase: 07-desktop-shortcut-auto-creation
reviewed: 2026-04-27T17:10:21Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - electron/src/main/services/desktop-shortcut.ts
  - electron/src/main/index.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-27T17:10:21Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two new source files implement Linux AppImage desktop shortcut auto-creation. `desktop-shortcut.ts` creates a `.desktop` file and copies an icon on first run. `index.ts` integrates the call as a fire-and-forget side-effect after `app.whenReady()`.

The implementation is clean and well-commented. There are no security vulnerabilities. Two warnings affect correctness: the shortcut goes stale after an auto-update (the most significant risk given Phase 5 ships an auto-updater), and a `spawn` exit-code check omission in `index.ts` silently hides npm install failures. Four info items cover spec compliance gaps, naming asymmetry, and unhandled async rejections.

## Warnings

### WR-01: Desktop shortcut becomes stale after AppImage auto-update

**File:** `electron/src/main/services/desktop-shortcut.ts:44`
**Issue:** `existsSync(target)` returns `true` after the first launch and the function returns early every subsequent run. `electron-updater` (confirmed in `updater.ts`) downloads a new AppImage and relaunches from the new binary path. After the relaunch, `$APPIMAGE` points to the updated binary, but the `.desktop` file still contains the old `Exec=` path. The user's desktop launcher silently invokes the wrong binary — or nothing at all if the old path is deleted. The `X-JobEngine-Version` field is written but never read, meaning the version-tracking mechanism exists but is never exercised.

**Fix:** Check whether the existing file's `Exec=` or `X-JobEngine-Version` differs from the current values before skipping:

```typescript
export async function ensureDesktopShortcut(): Promise<void> {
  if (!app.isPackaged) return

  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) {
    console.log('[desktop-shortcut] $APPIMAGE not set — skipping')
    return
  }

  const target = shortcutPath()
  const newEntry = buildDesktopEntry(appImagePath, app.getVersion())

  if (existsSync(target)) {
    try {
      const existing = await fs.readFile(target, 'utf-8')
      if (existing === newEntry) return          // identical — nothing to do
      // Exec path or version changed (post-update relaunch) — fall through to rewrite
    } catch {
      // unreadable — fall through and rewrite
    }
  }

  try {
    // ... icon copy logic unchanged ...
    await fs.mkdir(path.dirname(target), { recursive: true })
    await writeFileAtomic(target, newEntry, { mode: 0o644 })
    console.log('[desktop-shortcut] created/updated', target)
  } catch (err) {
    console.warn('[desktop-shortcut] failed (non-fatal):', (err as Error).message)
  }
}
```

---

### WR-02: `spawn` close event does not check exit code — install failures are silently ignored

**File:** `electron/src/main/index.ts:18-22`
**Issue:** `proc.on('close', () => resolve())` resolves the promise regardless of the npm process exit code. If `npm install` exits non-zero (e.g., registry unreachable, permission denied), the app continues to boot with missing deps and crashes at a call site far removed from the actual cause. Additionally, both `'close'` and `'error'` can fire for the same process, meaning `resolve()` is called twice; while harmless with a plain `Promise`, it indicates the process lifecycle is not fully modelled.

**Fix:**

```typescript
await new Promise<void>((resolve) => {
  const proc = spawn('npm', ['install'], { cwd: projectRoot, stdio: 'inherit' })
  proc.once('close', (code) => {
    if (code !== 0) {
      console.warn('[main] npm install exited with code', code, '— some features may be unavailable')
    }
    resolve()
  })
  proc.once('error', (err) => {
    console.warn('[main] npm install failed:', err.message)
    resolve()
  })
})
```

---

## Info

### IN-01: `Exec` value not escaped per freedesktop Desktop Entry spec

**File:** `electron/src/main/services/desktop-shortcut.ts:24`
**Issue:** The spec requires that characters `"`, `` ` ``, `$`, and `\` be escaped with a backslash inside double-quoted `Exec` arguments. Wrapping in `"..."` handles spaces but leaves these characters unescaped. AppImage paths are typically safe, but a path that contains a literal `$` (e.g., `/home/user/apps/job$engine.AppImage`) produces a malformed entry that most launchers will silently misparse.

**Fix:** Apply a minimal escape before interpolating:

```typescript
const escapedPath = appImagePath.replace(/["\\`$]/g, '\\$&')
`Exec="${escapedPath}"`,
```

---

### IN-02: Asymmetric icon source vs. target naming breaks the `ICON_NAME` constant abstraction

**File:** `electron/src/main/services/desktop-shortcut.ts:49`
**Issue:** The icon source path hardcodes `jobengine-electron.png` (the electron-builder default bundle name) while the target uses the `ICON_NAME` constant (`jobengine`). This is intentional (stable XDG name vs. bundled artifact name), but anyone reading the code or renaming the constant will miss the implicit coupling. There is no comment explaining the divergence.

**Fix:** Add a comment on the source path, or introduce a `ICON_SOURCE_NAME` constant at the top of the file alongside `ICON_NAME`:

```typescript
const ICON_NAME        = 'jobengine'            // XDG icon-theme name — stable, used in .desktop
const ICON_SOURCE_NAME = 'jobengine-electron'   // electron-builder bundle name in usr/share/icons
```

Then reference `ICON_SOURCE_NAME` at line 49.

---

### IN-03: `app.whenReady().then(async () => {...})` has no `.catch()`

**File:** `electron/src/main/index.ts:71`
**Issue:** The async callback initializes scheduler, mtime cache, IPC handlers, and file watcher. Any unhandled rejection inside the callback will produce an `UnhandledPromiseRejection` and crash Electron in recent Node.js versions. The individual services have internal try/catch, but a future addition that doesn't self-catch will be silently fatal.

**Fix:**

```typescript
app.whenReady()
  .then(async () => {
    // ... existing body ...
  })
  .catch((err) => {
    console.error('[main] fatal startup error:', err)
    app.quit()
  })
```

---

### IN-04: Redundant `console.log` import-time calls will appear in production builds

**File:** `electron/src/main/index.ts:73`
**Issue:** `console.log('[main] project root:', projectRoot)` fires unconditionally in packaged builds. This is not a bug, but it's a routine startup log that will appear in end-user logs with no guarding condition (unlike the `[desktop-shortcut]` and `[updater]` logs which are contextual). Minor, but noted for consistency.

**Fix:** Wrap in `if (!app.isPackaged)` if production-log cleanliness is a goal, or leave as-is if the project treats main-process logs as always-on diagnostics (acceptable either way).

---

_Reviewed: 2026-04-27T17:10:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
