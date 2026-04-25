---
phase: 02-write-safety-anthropic-integration
plan: "01"
subsystem: write-safety
tags:
  - write-safety
  - concurrency
  - file-locking
  - proper-lockfile
  - mtime-cache
dependency_graph:
  requires: []
  provides:
    - updateStatus(filePath, num, newStatus, pendingGuiWrites)
    - lockAndWrite(filePath, transform, pendingGuiWrites?)
    - MtimeCache class (electron main process)
    - initMtimeCache / readWithMtimeCache / persistMtimeCache (Node lib)
    - startFileWatcher with pendingGuiWrites suppression
  affects:
    - electron/src/main/index.ts (Plan 02 wires pendingGuiWrites Set)
    - electron/src/main/ipc-handlers.ts (Plan 02 registers updateStatus handler)
    - merge-tracker.mjs (now serializes on proper-lockfile before applications.md writes)
tech_stack:
  added:
    - proper-lockfile@4.1.2 (root + electron)
    - write-file-atomic@7.0.1 (electron)
    - "@anthropic-ai/sdk@0.90.0 (electron)"
    - zod upgraded to ^3.25.0 in electron (SDK peer dep requirement)
    - "@types/proper-lockfile (electron dev)"
    - "@types/write-file-atomic (electron dev)"
  patterns:
    - proper-lockfile RAII pattern (acquire → try/finally release)
    - write-file-atomic for atomic POSIX writes
    - pendingGuiWrites Set for chokidar banner suppression (D-15)
    - mtime sidecar cache (module-level Map + JSON persistence)
key_files:
  created:
    - lib/mtime-cache.mjs
    - electron/src/main/services/write-queue.ts
    - electron/src/main/services/status-writer.ts
    - electron/src/main/services/mtime-cache.ts
  modified:
    - merge-tracker.mjs (async main + proper-lockfile wrapping)
    - electron/src/main/watcher.ts (pendingGuiWrites 3rd parameter + suppression check)
    - package.json (proper-lockfile added)
    - electron/package.json (SDK + lockfile + atomic + zod upgrade)
    - .gitignore (data/.mtime-cache.json added)
decisions:
  - "Zod upgraded to ^3.25.0 in electron/package.json — @anthropic-ai/sdk@0.90.0 requires zod >=3.25.0 as a peer dep; prior version was 3.24.3. No API surface change."
  - "GUI_WRITE_SUPPRESSION_MS constant defined in write-queue.ts and imported by status-writer.ts — single source of truth for WSL (3000ms) vs non-WSL (1500ms) TTL"
  - "Early exits in merge-tracker.mjs (no APPS_FILE, no ADDITIONS_DIR, no TSV files) happen BEFORE lock acquisition — no lock overhead for the common no-op case"
  - "verify() call moved outside the lock in merge-tracker.mjs — verify-pipeline.mjs is read-only, no need to hold the lock during it"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 4
  files_modified: 5
---

# Phase 2 Plan 01: Write Safety Foundation Summary

**One-liner:** Proper-lockfile + write-file-atomic write-safety foundation with mtime-cache sidecar for applications.md concurrency and context re-read elimination.

## What Changed

### Packages Installed

**Root package.json:**
- `proper-lockfile@^4.1.2` — advisory file locking for merge-tracker.mjs

**electron/package.json (dependencies):**
- `@anthropic-ai/sdk@^0.90.0` — Anthropic streaming SDK (used by Plan 02's evaluation-service.ts)
- `proper-lockfile@^4.1.2` — lock primitive for status-writer.ts and write-queue.ts
- `write-file-atomic@^7.0.1` — atomic POSIX write (temp + rename) for status-writer and mtime-cache
- `zod` upgraded from `3.24.3` to `^3.25.0` (SDK peer dep)

**electron/package.json (devDependencies):**
- `@types/proper-lockfile`
- `@types/write-file-atomic`

### Files Created

**`lib/mtime-cache.mjs`** — satisfies REQUIREMENTS.md API-05. Module-level singleton Map caching `{filePath → {mtimeMs, content}}`. Exports `initMtimeCache(projectRoot)`, `readWithMtimeCache(filePath)`, `persistMtimeCache()`. Atomic persistence via temp+rename. Sidecar at `data/.mtime-cache.json`.

**`electron/src/main/services/write-queue.ts`** — reusable `lockAndWrite(filePath, transform, pendingGuiWrites?)` helper. Acquires proper-lockfile, reads file, calls transform(), adds to pendingGuiWrites (with TTL), writes via write-file-atomic, releases lock in finally. Exports `GUI_WRITE_SUPPRESSION_MS` constant (3000ms WSL, 1500ms elsewhere).

**`electron/src/main/services/status-writer.ts`** — `updateStatus(filePath, reportNumber, newStatus, pendingGuiWrites)` returning typed `StatusUpdateResult`. Finds row by `[reportNumber]` substring in report column, replaces `parts[6]` (status column), writes atomically. Returns discriminated union: `lock-timeout | not-found | parse-error | fs-error`. Imports `GUI_WRITE_SUPPRESSION_MS` from write-queue.

**`electron/src/main/services/mtime-cache.ts`** — TypeScript class `MtimeCache` mirroring lib/mtime-cache.mjs semantics for the main process. Uses `write-file-atomic` for sidecar persistence. Sidecar path: `path.join(projectRoot, 'data', '.mtime-cache.json')`.

### Files Extended

**`merge-tracker.mjs`** — refactored synchronous main into async `main()` function. Lock acquired on `APPS_FILE` (proper-lockfile) after early exits but before `readFileSync`. Release guaranteed in `try/finally`. Timeout exits with code 2 and clear message. No change to merge algorithm.

**`electron/src/main/watcher.ts`** — added `pendingGuiWrites: Set<string>` as 3rd parameter. Changed `watcher.on('all', ())` to `watcher.on('all', (_event, filePath))` and added suppression check: `if (filePath && pendingGuiWrites.has(filePath)) return` before emitting `files-changed`. Preserves all existing behavior for external writes.

**`.gitignore`** — added `data/.mtime-cache.json` (per-machine sidecar, T-02-04 mitigation).

## Interface Contracts Published

Plan 02 imports these symbols:

```typescript
// electron/src/main/services/status-writer.ts
export type StatusUpdateError = 'lock-timeout' | 'not-found' | 'parse-error' | 'fs-error'
export interface StatusUpdateResult { success: boolean; error?: StatusUpdateError; message?: string }
export function updateStatus(filePath, reportNumber, newStatus, pendingGuiWrites): Promise<StatusUpdateResult>

// electron/src/main/services/write-queue.ts
export function lockAndWrite(filePath, transform, pendingGuiWrites?): Promise<void>
export const GUI_WRITE_SUPPRESSION_MS: number  // 3000 on WSL, 1500 elsewhere

// electron/src/main/services/mtime-cache.ts
export class MtimeCache {
  constructor(projectRoot: string)
  init(): Promise<void>
  read(filePath: string): Promise<string>
  persist(): Promise<void>
}

// electron/src/main/watcher.ts (extended)
export function startFileWatcher(projectRoot, win, pendingGuiWrites: Set<string>): () => void

// lib/mtime-cache.mjs (Node, satisfies REQUIREMENTS.md API-05)
export async function initMtimeCache(projectRoot): Promise<void>
export async function readWithMtimeCache(filePath): Promise<string>
export async function persistMtimeCache(): Promise<void>
```

## What Plan 02 Needs to Know

1. **`main/index.ts` must create `const pendingGuiWrites = new Set<string>()` and pass it** to both `startFileWatcher(projectRoot, win, pendingGuiWrites)` and to `registerIpcHandlers(projectRoot, win, pendingGuiWrites)` — the set is the shared coordination object.

2. **TypeScript compilation has 2 errors in `index.ts`** (`Expected 3 arguments, but got 2` for `startFileWatcher` calls) — these are Plan 02's responsibility to fix when wiring the Set.

3. **`updateStatus` finds rows by `[reportNumber]` substring** in the report column (format: `[42](reports/...)`). The Zod schema for the IPC handler should validate `reportNumber` as a positive integer.

4. **The `@anthropic-ai/sdk` package is now installed** in electron/ — Plan 02's `evaluation-service.ts` can import it directly as `import Anthropic from '@anthropic-ai/sdk'`.

5. **`merge-tracker.mjs` is now fully async** — any callers that `require`/import it as a synchronous module need to await. The `node merge-tracker.mjs` CLI entry point handles this via `main().catch(...)`.

6. **data/.mtime-cache.json is gitignored** — first evaluation run will create it; subsequent runs will benefit from cache hits if the context files haven't changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod version conflict with @anthropic-ai/sdk**
- **Found during:** Task 1 npm install
- **Issue:** `@anthropic-ai/sdk@0.90.0` requires `zod@^3.25.0 || ^4.0.0` as a peer dep; electron/ had `zod@3.24.3` — npm refused to install with ERESOLVE
- **Fix:** Upgraded zod to `^3.25.0` in electron/package.json alongside the SDK install. No API surface change between 3.24.x and 3.25.x for the schemas used in Phase 1.
- **Files modified:** `electron/package.json`
- **Commit:** 7d4c1a0

None beyond the above — all other plan instructions executed exactly as written.

## Known Stubs

None. This plan creates backend services only (no UI components, no data flows to renderer).

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All STRIDE mitigations T-02-01 through T-02-06 implemented as specified.

## Self-Check: PASSED

All created files exist and commits verified:
- `lib/mtime-cache.mjs` — exists, exports verified, syntax clean
- `electron/src/main/services/write-queue.ts` — exists, exports verified
- `electron/src/main/services/status-writer.ts` — exists, exports verified
- `electron/src/main/services/mtime-cache.ts` — exists, exports verified
- `merge-tracker.mjs` — proper-lockfile import + lock call present, syntax clean
- `electron/src/main/watcher.ts` — pendingGuiWrites parameter + suppression check present
- `.gitignore` — data/.mtime-cache.json covered
- Commits: 7d4c1a0, c57e947, 2a9dd8c — all present in git log
