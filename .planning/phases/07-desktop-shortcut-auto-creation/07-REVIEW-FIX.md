---
phase: 07-desktop-shortcut-auto-creation
fixed_at: 2026-04-27T17:13:02Z
review_path: .planning/phases/07-desktop-shortcut-auto-creation/07-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-04-27T17:13:02Z
**Source review:** .planning/phases/07-desktop-shortcut-auto-creation/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — critical_warning scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Desktop shortcut becomes stale after AppImage auto-update

**Files modified:** `electron/src/main/services/desktop-shortcut.ts`
**Commit:** b1f98bc
**Applied fix:** Replaced the unconditional `if (existsSync(target)) return` early exit with a content-comparison check. `buildDesktopEntry` is now called before the existence check so `newEntry` is available for comparison. If the file exists and its content matches `newEntry` exactly, the function returns (idempotent). If content differs (e.g., `Exec=` path changed after an auto-update relaunch) or the file is unreadable, execution falls through to the write block. Updated the log message from `'created'` to `'created/updated'` to reflect the new semantics. Icon-copy block left intact — it has its own `!existsSync(iconDst)` guard and was not affected.

**Status:** fixed: requires human verification (state-handling correctness — content comparison logic should be confirmed against real post-update relaunch scenario)

---

### WR-02: `spawn` close event does not check exit code — install failures are silently ignored

**Files modified:** `electron/src/main/index.ts`
**Commit:** 37be7ab
**Applied fix:** Changed both `proc.on('close', ...)` and `proc.on('error', ...)` to `proc.once(...)` to prevent double-resolve. Added `(code)` parameter to the close handler with a `code !== 0` check that emits a `console.warn` with the exit code and a note that features may be unavailable. `resolve()` is always called in both handlers — install failures remain non-fatal and do not crash startup.

**Status:** fixed: requires human verification (state-handling correctness — exit-code warning path should be confirmed against an actual failed npm install scenario)

---

_Fixed: 2026-04-27T17:13:02Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
