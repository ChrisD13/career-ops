---
phase: 02-write-safety-anthropic-integration
plan: "02"
subsystem: electron-main
tags:
  - anthropic
  - ipc
  - streaming
  - safe-storage
  - prompt-caching
  - child-process
dependency_graph:
  requires:
    - 02-01 (status-writer, mtime-cache, write-queue stubs used; Plan 01 will overwrite stubs)
  provides:
    - electron/src/main/services/key-store.ts (keyStore)
    - electron/src/main/services/evaluation-service.ts (streamEvaluation, verifyApiKey, calculateCost, cancelActiveEvaluation)
    - electron/src/main/services/process-runner.ts (startOp, cancelOp, OpKind)
    - electron/src/main/services/preferences.ts (preferences)
    - electron/src/main/ipc-handlers.ts (HandlerDeps, registerIpcHandlers — 17 channels)
    - electron/src/preload/types.ts (ElectronAPI with 22 members + 10 payload interfaces)
    - electron/src/preload/index.ts (full contextBridge binding)
    - electron/src/main/index.ts (pendingGuiWrites + MtimeCache lifecycle wiring)
  affects:
    - 02-03 (EvaluatePanel + Settings panels consume evaluateUrl, checkApiKey, saveApiKey, onEvaluationToken, onEvaluationDone)
    - 02-05 (Operations panel consumes runScan, runBatch, regeneratePDF, onOperationOutput, onOperationDone)
tech_stack:
  added:
    - "@anthropic-ai/sdk@^0.90.0 — Anthropic Messages streaming client"
    - "write-file-atomic@^6.x — atomic file writes for key-store and preferences"
    - "vite@^8.x (devDep) — pre-existing build dependency that was missing; installed as Rule 3 fix"
  patterns:
    - "Prompt caching: stable prefix assembled as single system turn with cache_control ephemeral at end (D-11 pattern)"
    - "Module-level AbortController singleton enforces one concurrent evaluation (Pitfall 9 mitigation)"
    - "finalMessage() usage extraction (Pitfall 4 mitigation — not streamed usage events)"
    - "HandlerDeps dependency-injection bag for IPC handlers (enables testability)"
    - "subscribe<T> helper in preload centralises ipcRenderer.on + removeListener pattern"
    - "Zod validation at IPC boundary for all input-bearing handlers"
key_files:
  created:
    - electron/src/main/services/key-store.ts
    - electron/src/main/services/evaluation-service.ts
    - electron/src/main/services/process-runner.ts
    - electron/src/main/services/preferences.ts
    - electron/src/main/services/status-writer.ts (stub — Plan 01 overwrites)
    - electron/src/main/services/mtime-cache.ts (stub — Plan 01 overwrites)
    - electron/src/main/services/write-queue.ts (stub — Plan 01 overwrites)
  modified:
    - electron/src/preload/types.ts
    - electron/src/preload/index.ts
    - electron/src/main/ipc-handlers.ts
    - electron/src/main/index.ts
    - electron/src/main/watcher.ts (added optional pendingGuiWrites param for TS compat)
    - electron/package.json (added @anthropic-ai/sdk, write-file-atomic, vite)
decisions:
  - "Stub files created for Plan 01 artifacts (status-writer, mtime-cache, write-queue) — stubs provide correct type signatures so Plan 02 compiles; Plan 01 will overwrite them"
  - "watcher.ts updated with optional 3rd pendingGuiWrites param — Plan 01 will make it required in its full implementation"
  - "safeStorage backend detection uses getSelectedStorageBackend?.() with optional-chain guard for Electron version safety"
  - "article-digest.md included in stable prefix only when file exists (Pitfall 3: boosting prefix size toward 2048-token Sonnet cache threshold)"
  - "ANTHROPIC_API_KEY injected only for kind=batch via envOverrides; scan and pdf spawns do not receive the key (T-02-11 mitigation)"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 11
  files_modified: 5
---

# Phase 2 Plan 02: Anthropic Streaming Pipeline + IPC Surface Summary

Anthropic streaming pipeline with safeStorage-backed API key management, child-process orchestration, and complete IPC surface extension (main + preload + types). Four new services, 17 IPC handlers, 22 ElectronAPI members, and shared state wiring in main/index.ts.

## Objective

Land the Anthropic streaming pipeline, safeStorage API key management, child-process orchestration, and the full IPC surface extension that all Phase 2 renderer work (Plans 03, 04, 05) depends on.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create key-store, evaluation-service, process-runner, preferences services | 12da055 | 7 new files in services/ |
| 2 | Extend preload (types + contextBridge) and ipc-handlers with all new channels | d2e906f | preload/types.ts, preload/index.ts, main/ipc-handlers.ts |
| 3 | Wire shared state (pendingGuiWrites, MtimeCache, keyStore readiness) into main/index.ts | 357877e | main/index.ts, main/watcher.ts, package.json |

## New IPC Channels Available to Renderer

### Request-Response (invoke)

| Channel | Handler | Notes |
|---------|---------|-------|
| `updateStatus` | writeStatus() from Plan 01 | Zod-validates {num, newStatus}; passes pendingGuiWrites |
| `evaluateUrl` | streamEvaluation() | Returns {evaluationId}; fires push events asynchronously |
| `cancelEvaluation` | cancelActiveEvaluation() | Aborts AbortController on active stream |
| `checkApiKey` | keyStore.hasKey() + backendWarning() | Never returns plaintext key |
| `saveApiKey` | keyStore.save() | Zod-validates sk-ant- prefix; returns backendWarning if basic_text |
| `verifyApiKey` | verifyApiKey() | Minimal haiku call; ok/error response |
| `getModel` | preferences.getModel() | Defaults to claude-sonnet-4-6 |
| `setModel` | preferences.setModel() | Zod-validates against ALLOWED_MODELS enum |
| `readCv` | fs.readFile(cv.md) | Hardcoded path; no renderer-supplied path |
| `regeneratePDF` | startOp(node generate-pdf.mjs) | Returns {runId} |
| `runScan` | startOp(node scan.mjs) | Returns {runId} |
| `runBatch` | startOp(bash batch/batch-runner.sh) | Injects ANTHROPIC_API_KEY from keyStore |

### Push Events (subscribe)

| Channel | Payload | Source |
|---------|---------|--------|
| `evaluation:token` | string (delta) | evaluation-service stream.on('text') |
| `evaluation:done` | EvaluationDonePayload {usage, stopReason, costUsd, model} | evaluation-service finalMessage() |
| `evaluation:error` | EvaluationErrorPayload {status?, type?, message, retryAfter?} | evaluation-service catch |
| `evaluation:cancelled` | void | evaluation-service APIUserAbortError catch |
| `op:output` | OpOutputPayload {runId, kind, stream, line, ts} | process-runner readline |
| `op:done` | OpDonePayload {runId, kind, code, signal} | process-runner child.on('exit') |

## SDK Version Pinning

- `@anthropic-ai/sdk@^0.90.0` installed with `--legacy-peer-deps` due to peer conflict with `zod@3.24.3` (SDK wants ^3.25.0 or ^4.0.0). The zod version in use is sufficient for all Plan 02 usage patterns; upgrading zod to 3.25+ is deferred to avoid renderer breakage.

## Prompt Cache Configuration

Stable prefix assembly order (D-11):
1. `modes/_shared.md` — most stable
2. `modes/oferta.md` — mode prompt
3. `cv.md` — CV content
4. `article-digest.md` — optional; included when file exists (Pitfall 3: boosts prefix toward Sonnet 2048-token minimum)
5. `config/profile.yml` — profile config
6. `modes/_profile.md` — most volatile of stable part

The entire prefix is placed as a single system-turn content block with `cache_control: { type: 'ephemeral' }` at the end. User turn contains only the URL prompt. The prefix typically exceeds 2048 tokens when cv.md and article-digest.md are both present.

## Linux safeStorage Backend

During dev on WSL2 (Linux), `safeStorage.getSelectedStorageBackend()` returns `basic_text` because no keyring daemon (libsecret/kwallet) is available. The `keyStore.backendWarning()` method detects this and returns a non-null warning string. This warning is surfaced via `checkApiKey` and `saveApiKey` responses so Plan 03 can display an `InlineWarningBanner`. The key is still encrypted (via Electron's basic_text fallback) and stored atomically.

## EvaluationDonePayload.usage Shape (for Plan 03 token-stats row)

```typescript
{
  input_tokens: number,            // prompt tokens consumed
  output_tokens: number,           // completion tokens
  cache_creation_input_tokens: number,  // tokens written to cache (first run)
  cache_read_input_tokens: number,      // tokens read from cache (repeat runs)
}
```

Cost formula: `(input * 3.0 + output * 15.0 + cacheRead * 0.30 + cacheWrite * 3.75) / 1_000_000` for claude-sonnet-4-6.

## Hardcoded Child Commands

All child process commands are hardcoded in `ipc-handlers.ts` — the renderer cannot supply command, args, cwd, or env (T-02-13 mitigation):

| Handler | Command | Args | cwd |
|---------|---------|------|-----|
| runScan | `node` | `['scan.mjs']` | projectRoot |
| regeneratePDF | `node` | `['generate-pdf.mjs']` | projectRoot |
| runBatch | `bash` | `['batch/batch-runner.sh']` | projectRoot |

`ANTHROPIC_API_KEY` is injected only for `runBatch` via `envOverrides`. The scan and PDF spawns do not receive the API key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing vite devDependency prevented npm run build**
- **Found during:** Task 3 verification (npm run build)
- **Issue:** `electron-vite` requires `vite` as a peer but it was not installed. Build failed with `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`.
- **Fix:** `npm install vite --save-dev --legacy-peer-deps` — installed vite@8.x
- **Files modified:** electron/package.json
- **Commit:** 357877e

**2. [Rule 3 - Blocking] watcher.ts 2-arg signature conflicted with 3-arg call in index.ts**
- **Found during:** Task 3 — TypeScript compile check (tsconfig.node.json)
- **Issue:** `startFileWatcher` only accepted 2 args; index.ts calls it with 3 (pendingGuiWrites). Plan 01 will fully rewrite the watcher but runs in a parallel worktree.
- **Fix:** Added optional 3rd parameter `pendingGuiWrites?: Set<string>` to `watcher.ts` with `void pendingGuiWrites` to suppress unused-param error. Plan 01 will make it required and implement the suppression logic.
- **Files modified:** electron/src/main/watcher.ts
- **Commit:** 357877e

**3. [Rule 3 - Blocking] Stub files needed for Plan 01 artifacts (parallel worktree)**
- **Found during:** Task 1 — Plan 01 runs in a parallel worktree; its files (status-writer.ts, mtime-cache.ts, write-queue.ts) don't exist yet
- **Fix:** Created minimal stub files with correct type signatures. The MtimeCache stub falls back to direct fs.readFile; status-writer stub returns an error. Plan 01 will overwrite all three stubs with full implementations.
- **Files created:** services/status-writer.ts, services/mtime-cache.ts, services/write-queue.ts
- **Commit:** 12da055

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `MtimeCache.init()` / `persist()` are no-ops | services/mtime-cache.ts | Plan 01 parallel worktree; stubs will be overwritten |
| `updateStatus()` always returns `{success: false}` | services/status-writer.ts | Plan 01 parallel worktree; stubs will be overwritten |
| `lockAndWrite()` always throws | services/write-queue.ts | Plan 01 parallel worktree; stubs will be overwritten |

These stubs do not block Plan 02's goal (IPC surface + streaming pipeline). The merge of both worktrees will replace all stubs with Plan 01's full implementations.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. All T-02-09 through T-02-20 mitigations verified:
- T-02-09: `checkApiKey` only returns `{hasKey, backendWarning}` — no plaintext key
- T-02-10: `UrlSchema = z.string().url()` at evaluateUrl handler entry
- T-02-11: ANTHROPIC_API_KEY injected only for runBatch (1 occurrence in ipc-handlers.ts)
- T-02-12: `ApiKeySchema.regex(/^sk-ant-/)` at saveApiKey + verifyApiKey handler entry
- T-02-13: Commands hardcoded in ipc-handlers.ts; renderer controls nothing
- T-02-15: Single AbortController singleton enforces one concurrent stream
- T-02-17: ALLOWED_MODELS enum + ModelSchema Zod gate

## Self-Check: PASSED

All created files verified present on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| electron/src/main/services/key-store.ts | FOUND |
| electron/src/main/services/evaluation-service.ts | FOUND |
| electron/src/main/services/process-runner.ts | FOUND |
| electron/src/main/services/preferences.ts | FOUND |
| electron/src/preload/types.ts | FOUND |
| electron/src/preload/index.ts | FOUND |
| electron/src/main/ipc-handlers.ts | FOUND |
| electron/src/main/index.ts | FOUND |
| Commit 12da055 (Task 1) | FOUND |
| Commit d2e906f (Task 2) | FOUND |
| Commit 357877e (Task 3) | FOUND |
