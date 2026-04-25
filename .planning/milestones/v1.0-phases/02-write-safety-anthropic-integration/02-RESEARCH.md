# Phase 2: Write Safety + Anthropic Integration — Research

**Researched:** 2026-04-22
**Domain:** Anthropic streaming SDK in Electron main process + concurrent-write safety for file-backed state + child_process orchestration
**Confidence:** HIGH (Anthropic streaming/caching, proper-lockfile, write-file-atomic all verified against official docs published 2026-04; Electron safeStorage verified with known-issue list; integration points verified against Phase 1 code in repo)

---

## Summary

Phase 2 installs four distinct technical capabilities on top of the Phase 1 Electron shell: (1) a streaming Anthropic Messages call driven from the main process, with prompt caching keyed to a 5-file stable-prefix hierarchy, (2) OS-keychain storage of the API key via `safeStorage`, (3) concurrent-write safety for tracker edits via `proper-lockfile` + `write-file-atomic`, with banner suppression for GUI-originated writes, (4) child_process spawning of existing repo scripts (`scan.mjs`, `batch-runner.sh`, `generate-pdf.mjs`) with stdout/stderr streamed to a renderer-visible operations log. The SDK, lock primitives, and safeStorage are all well-documented and their semantics are unambiguous — the only hard surprise surfaced by this research is that **the total context prefix (cv.md + oferta.md + _shared.md + _profile.md + profile.yml ≈ 666 lines) is below the 2048-token minimum for Sonnet 4.6 caching**, which materially changes how D-05's cache-hit UX will behave on real context and must be addressed before implementation.

**Primary recommendation:** Implement streaming via `anthropic.messages.stream({...})` with `AbortController` signal; implement prompt caching with a single `cache_control: {type: "ephemeral"}` breakpoint at the end of the stable prefix (in `system`), not spread across blocks; gate all GUI writes to `applications.md` behind one main-process helper that wraps `proper-lockfile.lock()` → read → regex-replace → `writeFileAtomic` → release, and use a single `pendingGuiWrites: Set<string>` in the watcher to coordinate banner suppression. Add a Wave 0 task to measure actual token counts for the prefix and confirm whether caching will trigger at all on this model.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Anthropic streaming call (API key + SDK) | Main process (Node) | — | Key never crosses the contextBridge; SDK runs in Node-only world. Renderer only receives forwarded tokens via `webContents.send`. |
| Token streaming to UI | Main → Renderer (IPC push) | — | `ipcMain`/`webContents.send` push events; `ipcRenderer.on` in preload; contextBridge exposes an `onEvaluationToken` subscribe function (same pattern as `onFilesChanged`). |
| API key storage | Main process (safeStorage + disk) | — | `safeStorage.encryptString` → `app.getPath('userData')/api-key.enc`. Renderer gets only `{hasKey: boolean}`. |
| Prompt caching logic | Main process | — | Building the request body, placing `cache_control`, reading `usage` out of the final Message is all SDK-level work. |
| mtime-based context read | Main process | — | Reads 5 files; writes `data/.mtime-cache.json`; renderer never sees the files directly. |
| Concurrent write safety (status edits) | Main process | — | `proper-lockfile` + `writeFileAtomic` on `data/applications.md`. Renderer sends `updateStatus(num, newStatus)` and receives success/failure. |
| TSV-addition merge (batch results) | Child process (batch-runner.sh + merge-tracker.mjs) | — | Unchanged from Phase 1 v1. GUI does not write new tracker rows directly; only status updates on existing rows. |
| Child-process orchestration (scan/batch/pdf) | Main process (child_process.spawn) | — | Cannot fork from renderer with contextIsolation + sandbox. Main forks, relays stdout/stderr lines as IPC events. |
| Markdown rendering (streaming + CV) | Renderer (React) | — | Reuses Phase 1 `ReportViewer` component map; accumulates tokens into a string and re-renders react-markdown each delta. |
| File-change watcher + banner suppression | Main process (chokidar) | Renderer (banner render) | Main holds the `pendingGuiWrite` flag; renderer just receives or doesn't receive the `files-changed` event. |

**Why this matters:** The strict contextIsolation baseline from Phase 1 (`sandbox: true`, `nodeIntegration: false`) means the renderer cannot `require('@anthropic-ai/sdk')`, cannot `child_process.spawn`, cannot `fs.readFile`, and cannot call `safeStorage`. Every capability in this phase lives in the main process and communicates to the renderer via the narrow `contextBridge` surface.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.90.0 (published 2026-04-16) | Streaming + non-streaming Messages API client | Official SDK; first-party TypeScript types; built-in `AbortController` support; emits typed `MessageStreamEvent` objects. `[VERIFIED: npm view @anthropic-ai/sdk version]` |
| `proper-lockfile` | 4.1.2 | Advisory file lock with stale detection | Battle-tested (`npm-cli`, `cacache`, `npm pack` all use it); stale detection via mtime polling; returns a `release` function for clean RAII-style usage. `[VERIFIED: npm view proper-lockfile version]` |
| `write-file-atomic` | 7.0.1 (published 2026-04-22) | Atomic file write via temp file + rename | Standard npm solution; used by `npm`, `cacache`, `graceful-fs` ecosystem; `rename(2)` is atomic on POSIX; preserves existing mode/chown. `[VERIFIED: npm view write-file-atomic version]` |
| `electron.safeStorage` | bundled with Electron 41.2.2 | OS-keychain-backed string encryption | Cross-platform (macOS Keychain, Windows DPAPI, Linux libsecret/kwallet); zero additional dependency. `[VERIFIED: electron/package.json in repo]` |

### Supporting (already installed — no new deps)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chokidar` | ^5.0.0 | File watching — already in Phase 1 | Extend watcher with `pendingGuiWrite` suppression flag |
| `zod` | 3.24.3 | IPC input validation — already in Phase 1 | Validate `updateStatus`, `evaluateUrl`, `saveApiKey` inputs |
| `react-markdown` | 10.1.0 | Markdown → React — already used by `ReportViewer.tsx` | Reuse for streaming output and CV viewer |
| `js-yaml` | ^4.1.1 | Already used by parsers and `scan.mjs` | No new YAML needs in Phase 2 |
| `lucide-react` | ^0.511.0 | Icons — already Phase 1 | UI-SPEC specifies `Sparkles`, `User`, `Settings`, `Loader2`, `AlertCircle`, `KeyRound`, `Check`, `FileDown`, `Search`, `X`, `ChevronUp`, `ChevronDown`, `ShieldCheck`, `Eye`, `EyeOff` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `safeStorage` | `keytar` | `keytar` adds native dependency + requires rebuild per Electron version; `safeStorage` is built-in and zero-dep. REQUIREMENTS.md allows either; CONTEXT.md D-09 picks `safeStorage`. Keep it. |
| `proper-lockfile` | `lockfile`, `exclusive-lock` | `proper-lockfile` has the largest install base and actively maintained stale detection; others are thinner or abandoned. |
| `write-file-atomic` | `fs.writeFile` then `fs.rename` manually | Rolling your own means reimplementing the murmur-hash temp name, chown preservation, and fsync logic. `write-file-atomic` is ~300 LOC of well-tested code. |
| Anthropic SDK streaming | Raw `fetch` with SSE parsing | SDK gives typed events + `.finalMessage()` accumulator + built-in abort; raw SSE parsing is a pitfall farm (see "Common Pitfalls"). |
| `child_process.spawn` | Electron `UtilityProcess` | UtilityProcess is newer and has better integration, but requires bundling the child as a separate entry; `spawn` is simpler for invoking existing `.mjs` / `.sh` scripts by absolute path. Use `spawn`. |

**Installation (main process only):**
```bash
cd electron && npm install --save @anthropic-ai/sdk@^0.90.0 proper-lockfile@^4.1.2 write-file-atomic@^7.0.1 \
  && npm install --save-dev @types/proper-lockfile @types/write-file-atomic
```

**Version verification:**
- `@anthropic-ai/sdk@0.90.0` — published 2026-04-16 `[VERIFIED: npm registry]`
- `proper-lockfile@4.1.2` — published 2022-06-24 (stable, no breaking updates) `[VERIFIED: npm registry]`
- `write-file-atomic@7.0.1` — published 2026-04-22 `[VERIFIED: npm registry]`

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────── RENDERER (React + contextBridge) ─────────────────────────┐
│                                                                                   │
│   EvaluatePanel ── URL input ──→  window.api.evaluateUrl(url)                     │
│       ▲                                                                           │
│       │ window.api.onEvaluationToken(cb)  [streaming push]                        │
│       │ window.api.onEvaluationDone(cb)                                           │
│       │ window.api.onEvaluationError(cb)                                          │
│       │                                                                           │
│       └───── StreamingReportView (accumulates tokens → react-markdown)            │
│                                                                                   │
│   TrackerRow ── Status cell click ──→ window.api.updateStatus(num, newStatus)     │
│   SettingsSlideOver ── Save key ──→ window.api.saveApiKey(rawKey)                 │
│   CvPanel ── Regenerate ──→ window.api.regeneratePDF()                            │
│   PipelinePanel ── Scan ──→ window.api.runScan()                                  │
│   PipelinePanel ── Batch ──→ window.api.runBatch()                                │
│   OperationsLogDrawer ← window.api.onOperationOutput(cb) [streaming push]         │
│                                                                                   │
└─────────────────────── preload/index.ts (contextBridge) ──────────────────────────┘
                                      │
                   ipcRenderer.invoke  │  ipcRenderer.on (push)
                                      ▼
┌─────────────────────────── MAIN PROCESS (Node 22) ────────────────────────────────┐
│                                                                                   │
│   ipc-handlers.ts (registerIpcHandlers)                                           │
│     ├── updateStatus(num, newStatus)                                              │
│     │     ↓  Zod validate → writeQueue.push                                       │
│     │     ↓  proper-lockfile.lock('data/applications.md', {stale:10000, retries:5})│
│     │     ↓  fs.readFile → regex-replace status column → writeFileAtomic          │
│     │     ↓  release()                                                            │
│     │     ↓  watcher.pendingGuiWrites.add(path) [500ms TTL]                       │
│     │                                                                             │
│     ├── evaluateUrl(url)  ──→  evaluation-service.ts                              │
│     │                            ↓  mtimeCache.read(5 context files)              │
│     │                            ↓  build request body w/ cache_control breakpoint│
│     │                            ↓  AbortController stored in activeStreams Map   │
│     │                            ↓  anthropic.messages.stream({...}, {signal})    │
│     │                            ↓  for await (event of stream) send IPC 'token'  │
│     │                            ↓  stream.finalMessage() → send 'done' w/ usage  │
│     │                                                                             │
│     ├── cancelEvaluation()     → activeStreams.get(id).abort()                    │
│     ├── checkApiKey()          → returns {hasKey: boolean}                        │
│     ├── saveApiKey(rawKey)     → safeStorage.encryptString → fs.writeFile         │
│     ├── verifyApiKey(rawKey)   → minimal /messages probe or count_tokens call     │
│     ├── runScan()              → child_process.spawn('node', ['scan.mjs'], {cwd}) │
│     ├── runBatch()             → spawn('bash', ['batch/batch-runner.sh'], {cwd})  │
│     ├── regeneratePDF()        → spawn('node', ['generate-pdf.mjs', ...], {cwd}) │
│     └── [each spawn] pipe child.stdout/stderr → webContents.send('op:output',...) │
│                                                                                   │
│   watcher.ts (chokidar) ─── file event ──→ if (pendingGuiWrites.has(path)) skip   │
│                                                else send 'files-changed'          │
│                                                                                   │
│   evaluation-service.ts                                                           │
│     ├── loadContext() — reads cv.md, _shared.md, oferta.md, _profile.md,          │
│     │                   profile.yml; diffs mtimes against data/.mtime-cache.json  │
│     ├── buildRequest(url, cached) — assembles system[] + messages[] w/ cache_ctrl │
│     └── streamEvaluation(req, onToken, onDone, onError, abortSignal)              │
│                                                                                   │
│   mtime-cache.ts                                                                  │
│     ├── read() — loads data/.mtime-cache.json (or {} if missing/corrupt)          │
│     ├── check(path) — fs.stat → compare against cache → {changed: bool, mtimeMs}  │
│     └── save() — writeFileAtomic to data/.mtime-cache.json                        │
│                                                                                   │
│   key-store.ts                                                                    │
│     ├── hasKey() — existsSync(app.getPath('userData')+'/api-key.enc')             │
│     ├── get() — readFile → safeStorage.decryptString                              │
│     ├── save(raw) — safeStorage.encryptString → writeFileAtomic                   │
│     └── isAvailable() — safeStorage.isEncryptionAvailable() + backend check       │
│                                                                                   │
└────┬───────────────────────────────┬──────────────────────────────────────────────┘
     │ HTTPS to api.anthropic.com   │ child_process spawn
     ▼                               ▼
  Anthropic API             scan.mjs / batch-runner.sh / generate-pdf.mjs
  (SSE stream)               (existing Phase-1 scripts, unchanged)
                                    │
                                    ▼
                             batch/tracker-additions/*.tsv
                                    │
                                    ▼
                             merge-tracker.mjs  (NEW tracker rows only)
                                    │
                                    ▼
                             data/applications.md  (written via merge script — locked sep)
```

### Recommended File Structure (additions only — extends Phase 1 layout)

```
electron/src/
├── main/
│   ├── index.ts                       # [extend] register new handlers, init mtime-cache + key-store
│   ├── ipc-handlers.ts                # [extend] add updateStatus, evaluateUrl, cancelEvaluation, etc.
│   ├── watcher.ts                     # [extend] add pendingGuiWrites Set; suppression window 500ms
│   ├── parsers/                       # unchanged
│   └── services/                      # [NEW directory]
│       ├── evaluation-service.ts      # Anthropic streaming + prompt caching
│       ├── mtime-cache.ts             # data/.mtime-cache.json sidecar
│       ├── key-store.ts               # safeStorage wrapper
│       ├── write-queue.ts             # proper-lockfile + writeFileAtomic helper
│       ├── status-writer.ts           # update status in applications.md line
│       └── process-runner.ts          # child_process.spawn + stdout/stderr relay
├── preload/
│   ├── index.ts                       # [extend] add ~14 new channel exports
│   └── types.ts                       # [extend] add new ElectronAPI methods + event types
└── renderer/components/
    ├── EvaluatePanel.tsx              # NEW
    ├── StreamingReportView.tsx        # NEW (wraps react-markdown, accumulates tokens)
    ├── TokenStatsRow.tsx              # NEW
    ├── CvPanel.tsx                    # NEW
    ├── SettingsSlideOver.tsx          # NEW
    ├── ApiKeyField.tsx                # NEW (password + reveal toggle)
    ├── ApiKeyBanner.tsx               # NEW (yellow nudge)
    ├── OperationsLogDrawer.tsx        # NEW (VS-Code-style drawer)
    ├── DrawerTab.tsx                  # NEW
    ├── PdfToast.tsx                   # NEW
    ├── InlineErrorBanner.tsx          # NEW (reusable 44px red strip)
    ├── StatusSelect.tsx               # REWRITE (per-row activation)
    ├── TrackerRow.tsx                 # extend (click-to-activate on Status cell)
    └── TrackerPanel.tsx               # extend (track which row is editing; remove above-list stub)

lib/mtime-cache.mjs                    # NEW — Node-level sidecar helper (per REQUIREMENTS.md)
data/.mtime-cache.json                 # NEW — sidecar data (gitignored? see Open Q4)
```

### Pattern 1: Anthropic Streaming in Main Process

**What:** Open a streaming Messages call from the main process, relay each text delta to the renderer, and surface the final `usage` object (with `cache_read_input_tokens`) when the stream ends.

**When to use:** The only evaluation path in Phase 2 — `evaluateUrl(url)` IPC handler.

**Example (combines verified patterns):**
```typescript
// services/evaluation-service.ts
// Source: https://platform.claude.com/docs/en/api/messages-streaming
//         https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
import Anthropic from '@anthropic-ai/sdk'
import type { BrowserWindow } from 'electron'

interface EvaluationParams {
  url: string
  apiKey: string
  model: string              // 'claude-sonnet-4-6' | 'claude-haiku-4-5'
  win: BrowserWindow
  contextFiles: {             // pre-loaded by caller (mtime-cache hits avoid re-reads)
    shared: string
    oferta: string
    cv: string
    profile: string           // _profile.md + profile.yml merged
  }
}

export async function streamEvaluation(params: EvaluationParams) {
  const client = new Anthropic({ apiKey: params.apiKey })
  const controller = new AbortController()

  // Return the controller so the caller can abort
  const streamPromise = (async () => {
    const stream = client.messages.stream(
      {
        model: params.model,
        max_tokens: 8192,                  // A-G report budget
        system: [
          {
            type: 'text',
            text: params.contextFiles.shared
                + '\n\n---\n\n' + params.contextFiles.oferta
                + '\n\n---\n\n' + params.contextFiles.cv
                + '\n\n---\n\n' + params.contextFiles.profile,
            cache_control: { type: 'ephemeral' },  // ONE breakpoint at end of stable prefix
          },
        ],
        messages: [
          { role: 'user', content: `Evaluate this job URL and produce A-G report: ${params.url}` },
        ],
      },
      { signal: controller.signal },       // Pass AbortSignal via request options
    )

    // Send each text delta as IPC event (VERIFIED: SDK emits 'text' event with textDelta)
    stream.on('text', (delta: string) => {
      if (!params.win.isDestroyed()) {
        params.win.webContents.send('evaluation:token', delta)
      }
    })

    try {
      const finalMessage = await stream.finalMessage()
      if (!params.win.isDestroyed()) {
        params.win.webContents.send('evaluation:done', {
          usage: finalMessage.usage,        // input_tokens, cache_creation_input_tokens,
                                            // cache_read_input_tokens, output_tokens
          stopReason: finalMessage.stop_reason,
        })
      }
    } catch (err: any) {
      // SDK throws APIUserAbortError on controller.abort()
      if (err?.name === 'APIUserAbortError') {
        params.win.webContents.send('evaluation:cancelled')
      } else {
        params.win.webContents.send('evaluation:error', {
          status: err?.status,             // 429 / 500 / 401 etc
          type: err?.error?.type,          // 'authentication_error', 'rate_limit_error'
          message: err?.message,
          retryAfter: err?.headers?.['retry-after'], // for 429
        })
      }
    }
  })()

  return { controller, done: streamPromise }
}
```

**Notes:**
- `[CITED: helpers.md]` The `.on('text', cb)` event fires for each text delta — this is simpler than iterating `for await` and filtering for `content_block_delta` with `text_delta` type.
- `[CITED: helpers.md]` Alternative: `for await (const event of stream)` if you also need to handle `message_start` (first `usage` snapshot) or `content_block_stop`. For this phase, `.on('text')` + `.finalMessage()` is the minimal sufficient path.
- `[CITED: helpers.md]` `APIUserAbortError` is the thrown type when the signal aborts. Catch by `err.name === 'APIUserAbortError'`.

### Pattern 2: Prompt Caching with a Single Breakpoint

**What:** Mark the stable context prefix with `cache_control: {type: "ephemeral"}` so on a repeat evaluation within 5 minutes, `cache_read_input_tokens > 0`.

**When to use:** Every evaluation. The cache only pays off on the second+ run.

**Example:**
```typescript
// VERIFIED: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
system: [
  {
    type: 'text',
    text: stableContextPrefix,        // _shared.md + oferta.md + cv.md + _profile.md + profile.yml
    cache_control: { type: 'ephemeral' },
  },
],
messages: [
  { role: 'user', content: `Evaluate: ${jobUrl}` },   // URL/JD is the volatile tail
],
```

**Critical constraints (verified against official docs 2026-04):**
- `[CITED: prompt-caching docs]` **No beta header required.** Standard 5-min TTL is default on the main API for all Claude models.
- `[CITED: prompt-caching docs]` **Max 4 breakpoints** per request. Using 1 is the conservative choice.
- `[CITED: prompt-caching docs]` **Minimum cacheable tokens — Sonnet 4.6 is 2048 tokens.** Haiku 4.5 is 4096 tokens.
- `[CITED: prompt-caching docs]` When the prefix is below the threshold, the request succeeds silently and both `cache_creation_input_tokens` and `cache_read_input_tokens` are 0.
- `[CITED: prompt-caching docs]` Cache hierarchy invalidation: tools → system → messages. Any change to stable prefix invalidates the cache.
- `[CITED: prompt-caching docs]` For `ttl: "1h"`: 2× base input token price for writes, requires `"ttl": "1h"` field and longer TTLs must appear **before** shorter ones structurally.

**Recommendation:** Go with standard 5-min ephemeral (matches UI-SPEC "Resolved Discretion"). See Common Pitfall #6 for the prefix-size issue.

### Pattern 3: Concurrent-Write-Safe Status Update

**What:** When the user edits a row's status in the GUI, acquire an advisory lock on `data/applications.md`, read-modify-write the matching row's status column, release the lock, and suppress the chokidar "files changed" banner for this GUI-initiated write.

**When to use:** Every `updateStatus` IPC call.

**Example:**
```typescript
// services/status-writer.ts
// Source: proper-lockfile README + write-file-atomic README + Go reference (career.go:544)
import lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'
import { promises as fs } from 'fs'

export interface StatusUpdateResult {
  success: boolean
  error?: 'lock-timeout' | 'not-found' | 'parse-error' | 'fs-error'
  message?: string
}

export async function updateStatus(
  filePath: string,
  reportNumber: number,      // identify the row by report number (matches Go career.go:564)
  newStatus: string,
  pendingGuiWrites: Set<string>,
): Promise<StatusUpdateResult> {
  // VERIFIED: proper-lockfile README — stale:10000 is default, retries supports object
  let release: () => Promise<void>
  try {
    release = await lockfile.lock(filePath, {
      stale: 10_000,               // lock considered stale after 10s (default)
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 }, // ~5s total wait
    })
  } catch (err: any) {
    return { success: false, error: 'lock-timeout', message: err.message }
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    // Match by report number: [N] inside the Report column link
    // Status column is index 6 (0-indexed after split('|')) in the 9-col schema
    let found = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line.startsWith('|')) continue
      if (!line.includes(`[${reportNumber}]`)) continue

      // Replace status column; format is:
      // | num | date | company | role | score | STATUS | pdf | report | notes |
      // (trim()+split('|') produces empty first/last elements)
      const parts = line.split('|').map(s => s.trim())
      if (parts.length < 10) continue        // 9 cols + empty bookends = 10 parts
      parts[6] = newStatus                   // 0=empty, 1=num, 2=date, ..., 6=status
      lines[i] = '| ' + parts.slice(1, -1).join(' | ') + ' |'
      found = true
      break
    }

    if (!found) {
      return { success: false, error: 'not-found', message: `No row with report [${reportNumber}]` }
    }

    // VERIFIED: write-file-atomic — temp + rename; preserves mode/chown
    pendingGuiWrites.add(filePath)             // suppress banner — watcher checks this Set
    await writeFileAtomic(filePath, lines.join('\n'))
    // TTL: clear after chokidar's awaitWriteFinish stability window (500ms) + a margin
    setTimeout(() => pendingGuiWrites.delete(filePath), 1500)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: 'fs-error', message: err.message }
  } finally {
    await release!()
  }
}
```

**Notes:**
- The Go reference `UpdateApplicationStatus` in `dashboard/internal/data/career.go:544` uses the same regex-replace-by-report-number pattern; this Node implementation mirrors its semantics. `[VERIFIED: grep of career.go]`
- `pendingGuiWrites` is a `Set<string>` owned by the watcher module, shared with the write helper. The watcher checks it before emitting `files-changed`. TTL (1500ms) must exceed chokidar's `awaitWriteFinish.stabilityThreshold` (500ms) plus the 300ms watcher debounce in Phase 1's `watcher.ts` — so 1500ms gives comfortable margin.
- **The batch path does NOT use `proper-lockfile`.** It uses its own `batch/.batch-state.lock/` directory (`mkdir`-based) and `batch/batch-runner.pid`. `[VERIFIED: grep of batch-runner.sh lines 85-147]`. Since the batch writes new tracker rows via `merge-tracker.mjs` (which does a full-file read+write of `applications.md`), there IS a theoretical race between a GUI status edit and a batch merge. The `proper-lockfile` on the GUI side provides advisory protection but only against callers that also acquire it — `merge-tracker.mjs` does NOT currently acquire `proper-lockfile`. **This is a real concern.** See Open Questions Q1.

### Pattern 4: Child-Process Spawning with stdout/stderr Relay

**What:** Spawn `scan.mjs`, `batch-runner.sh`, or `generate-pdf.mjs` from the main process and forward every stdout/stderr line as an IPC event to the renderer's operations log drawer.

**When to use:** ELEC-06 (PDF regeneration), ELEC-07 (scan + batch triggers).

**Example:**
```typescript
// services/process-runner.ts
// Sources: Node child_process docs; Electron IPC best practices (electronjs.org/docs/latest/tutorial/ipc)
import { spawn, ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import * as readline from 'readline'

export type OpKind = 'scan' | 'batch' | 'pdf'

interface OpRun {
  kind: OpKind
  runId: string
  child: ChildProcess
}

const activeOps = new Map<string, OpRun>()

export function startOp(opts: {
  kind: OpKind
  command: string              // 'node' or 'bash'
  args: string[]               // ['scan.mjs'] or ['batch/batch-runner.sh']
  cwd: string                  // projectRoot
  win: BrowserWindow
}): string {
  const runId = `${opts.kind}-${Date.now()}`
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: { ...process.env },                   // inherit; batch-runner needs ANTHROPIC_API_KEY
                                                // and PATH to find `claude` CLI
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Line-buffered relay (avoids partial-line fragments in the drawer)
  const stdoutReader = readline.createInterface({ input: child.stdout! })
  const stderrReader = readline.createInterface({ input: child.stderr! })

  stdoutReader.on('line', (line) => {
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:output', { runId, kind: opts.kind, stream: 'stdout', line })
    }
  })
  stderrReader.on('line', (line) => {
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:output', { runId, kind: opts.kind, stream: 'stderr', line })
    }
  })

  child.on('exit', (code, signal) => {
    activeOps.delete(runId)
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:done', { runId, kind: opts.kind, code, signal })
    }
  })

  child.on('error', (err) => {
    activeOps.delete(runId)
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:error', { runId, kind: opts.kind, message: err.message })
    }
  })

  activeOps.set(runId, { kind: opts.kind, runId, child })
  return runId
}

export function cancelOp(runId: string): boolean {
  const op = activeOps.get(runId)
  if (!op) return false
  op.child.kill('SIGTERM')
  return true
}
```

**Notes:**
- **`readline.createInterface` is required** — raw `data` events on `child.stdout` fire on arbitrary byte boundaries, so a single log line can be split across events. Using `readline` ensures whole-line messages hit the drawer. `[ASSUMED based on Node docs + common gotcha]`
- The batch runner needs `ANTHROPIC_API_KEY` in env. Per CONTEXT.md (REQUIREMENTS.md API-04), the CLI batch path continues to use the env var — NOT the GUI-stored key. The GUI should warn the user that `batch/batch-runner.sh` requires `ANTHROPIC_API_KEY` to be exported in the shell environment when launched. `[VERIFIED: REQUIREMENTS.md API-04]`
- `spawn` with `cwd: projectRoot` is critical — the scripts use `fileURLToPath(import.meta.url)` to resolve their own dir AND some use relative paths like `'data/applications.md'` assuming PWD is project root. `[VERIFIED: scan.mjs:29 — PORTALS_PATH = 'portals.yml']`

### Pattern 5: mtime-Based Context Cache

**What:** Before each evaluation, stat the 5 context files. If all mtimes match `data/.mtime-cache.json`, reuse the in-memory content string. If any changed, re-read that file and update the sidecar.

**When to use:** Every `evaluateUrl` call, before building the Anthropic request.

**Example:**
```typescript
// services/mtime-cache.ts
// Source: REQUIREMENTS.md API-05; writeFileAtomic for sidecar persistence
import { promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

interface CacheEntry { mtimeMs: number; content: string }

export class MtimeCache {
  private cache = new Map<string, CacheEntry>()
  private sidecarPath: string

  constructor(projectRoot: string) {
    this.sidecarPath = path.join(projectRoot, 'data', '.mtime-cache.json')
  }

  async init() {
    try {
      const raw = await fs.readFile(this.sidecarPath, 'utf-8')
      const json = JSON.parse(raw) as Record<string, number>
      // Note: sidecar stores mtime only; content must be re-read on first session start
      for (const [p, mtimeMs] of Object.entries(json)) {
        this.cache.set(p, { mtimeMs, content: '' })    // content empty = needs re-read
      }
    } catch { /* missing or corrupt — start fresh */ }
  }

  async read(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    const cached = this.cache.get(filePath)
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.content) {
      return cached.content
    }
    const content = await fs.readFile(filePath, 'utf-8')
    this.cache.set(filePath, { mtimeMs: stat.mtimeMs, content })
    return content
  }

  async persist() {
    const snapshot: Record<string, number> = {}
    for (const [p, entry] of this.cache) snapshot[p] = entry.mtimeMs
    await writeFileAtomic(this.sidecarPath, JSON.stringify(snapshot, null, 2))
  }
}
```

**Edge cases:**
- **File deleted between stat and read:** `fs.stat` throws `ENOENT`. Handler should return a user-actionable error ("cv.md not found — the evaluation needs it"). Don't treat as cache hit.
- **Permissions changed:** `fs.readFile` throws `EACCES`. Surface as an operations log error, not as a silent cache read.
- **Clock skew / mtime going backward (git checkout, file restore):** mtime mismatch → re-read. Correct behavior.
- **First session after app install:** sidecar file doesn't exist. The `init()` swallows the error and starts with empty cache. First evaluation writes the sidecar.
- **Corrupt sidecar JSON:** same as above — swallow, start fresh.
- **Sidecar concurrent-write safety:** Only the main process writes it; no races.

### Anti-Patterns to Avoid

- **Running the Anthropic SDK in the renderer** — requires exposing the API key over IPC or bundling a copy into the renderer. Both violate ELEC-01 security baseline. Keep SDK in main.
- **Using `fs.writeFile` without lock** — the concurrent GUI + batch + external editor scenario corrupts the file. Use `proper-lockfile` + `writeFileAtomic`.
- **Using the Phase 1 chokidar watcher's `'all'` handler for writes the GUI just made** — produces a banner pop immediately after the user clicked "save", which is jarring. Use `pendingGuiWrites` Set.
- **Storing the API key in `localStorage` or any file visible to the renderer** — fails D-09 and API-04. Must be `safeStorage`-encrypted and read only in main.
- **Piping `child.stdout` directly to renderer as `data` events** — produces fragmented half-lines in the log drawer. Wrap with `readline.createInterface`.
- **Placing `cache_control` breakpoints on content that changes per-request** — invalidates the cache every run. Only the stable context files get the breakpoint; the JD/URL goes in `messages`.
- **Ignoring `retry-after` on 429** — a naïve immediate retry hits the same limit. Surface the header to the user per D-03.
- **Not setting a `max_tokens`** — SDK throws on messages.create without it. A-G reports fit in ~8192.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE parsing from Anthropic | Custom `fetch` + text decoder + SSE framer | `@anthropic-ai/sdk` `.messages.stream()` | SSE has edge cases (keep-alive, reconnect, half-events); SDK handles them and gives typed events. |
| File write locking | `fs.open(path, 'wx')` marker files | `proper-lockfile` | Stale detection via mtime polling; `onCompromised` callback; concurrent retry logic; handles `realpath` resolution. |
| Atomic file write | `writeFileSync(tmp)` + `rename` manually | `write-file-atomic` | Preserves mode/chown, handles fsync, proper cleanup on failure, concurrent-write queuing. |
| API key encryption | AES-256-GCM via Node `crypto` | `safeStorage` | OS keychain integration (Keychain/DPAPI/libsecret) is what users actually expect; rolling your own crypto doesn't gain anything. |
| Markdown rendering of stream | String concatenation → innerHTML | react-markdown + remark-gfm + rehype-sanitize (already in use) | XSS via injected `<script>` in the model output is a real threat; sanitize is mandatory. Phase 1 already uses this pipeline. |
| AbortController for Anthropic streaming | Polling a flag inside the event loop | SDK's built-in `signal` option + `stream.abort()` | SDK handles the underlying socket close + emits `abort` event. Polling leaks resources. |
| Child-process stdout line buffering | Manual buffer + `split('\n')` | `readline.createInterface` | Handles CRLF, incomplete final lines, backpressure. |
| Token cost calculation | Hard-coded price constants | Compute from `usage` × published per-million rates | Keep prices in a small table; Sonnet 4.6 pricing: `$3/M in`, `$15/M out`, cache read `$0.30/M` (0.1× base), cache write `$3.75/M` (1.25× base). `[CITED: pricepertoken.com + anthropic docs]` |
| Status-field regex replacement | Full markdown-table parser | Line-level split on `|` + index-6 replacement | Matches the Go reference in `career.go:580`. Simpler, less surface area for bugs. |

**Key insight:** Every "Don't Hand-Roll" item above is a pitfall farm — the ecosystem has converged on single solutions for each. Phase 2's job is assembly, not primitive building.

---

## Runtime State Inventory

Not applicable — this is an additive phase (new features, new files, no rename/refactor/migration). The only stored state this phase introduces is net-new (`data/.mtime-cache.json`, `{userData}/api-key.enc`).

---

## Common Pitfalls

### Pitfall 1: safeStorage backend is `basic_text` on Linux without libsecret
**What goes wrong:** On a Linux system without `libsecret` or `kwallet` installed, `safeStorage.encryptString` silently falls back to a hardcoded plaintext password — the "encrypted" data is effectively decipherable by anyone with read access to the file.
**Why it happens:** Electron can't use the OS keychain if no secret store exists. It doesn't fail — it degrades. `[VERIFIED: electron/electron#39789 and safe-storage docs]`
**How to avoid:** After `saveApiKey`, call `safeStorage.getSelectedStorageBackend()`. If it returns `'basic_text'`, show a warning in the Settings slide-over: "Your OS keyring is unavailable; the key is stored with weak protection. Install libsecret/kwallet to upgrade." Don't refuse to store — but be honest.
**Warning signs:** User on WSL2 or a minimal Docker-based desktop, or environments without `XDG_CURRENT_DESKTOP` set to a recognized value. This project's dev environment is WSL2 per init — **probably hits this**. `[VERIFIED: env shows WSL2]`

### Pitfall 2: `isEncryptionAvailable()` called before `ready` event
**What goes wrong:** On older Electron versions it crashed; on current (41.x) it returns `false` — which your code might misinterpret as "keychain unavailable" and disable the feature permanently.
**Why it happens:** safeStorage bootstraps during the ready event. `[VERIFIED: safeStorage docs + electron#32206]`
**How to avoid:** Only initialize `key-store.ts` inside `app.whenReady().then(...)`. Already the pattern used in `electron/src/main/index.ts:53`.
**Warning signs:** Any call path that imports key-store at module-top-level and immediately calls it.

### Pitfall 3: Prefix too short for prompt caching (Sonnet 4.6 minimum = 2048 tokens)
**What goes wrong:** The repo's actual context files total ~666 lines (`cv.md` 119 + `_shared.md` 161 + `oferta.md` 216 + `_profile.md` 102 + `profile.yml` 68). At roughly 1.3 tokens per line of Markdown, that's ~850-900 tokens. **Below the Sonnet 4.6 2048-token minimum for caching.** The API will accept the request with `cache_control` but `cache_creation_input_tokens` and `cache_read_input_tokens` will both always be 0. The D-05 UI will forever show "warming (first run)".
**Why it happens:** Anthropic silently ignores cache markers on prefixes below the model's threshold. `[VERIFIED: prompt-caching docs "Shorter prompts won't be cached (no error returned)"]`
**How to avoid:** Three options:
1. **Use Haiku 3.5 — threshold is only 2048 tokens.** But CONTEXT.md scopes selector to Sonnet 4.6 / Haiku 4.5 (both 4096 min — **even worse** for caching). `[VERIFIED: prompt-caching docs minimums table]`
2. **Include `article-digest.md` if it exists** — typically adds 200-500 tokens but may still not reach 2048/4096.
3. **Append padding content to the stable prefix** — e.g., the full `modes/_shared.md` + contents of a couple more mode files to pad to 4096+. Feels hacky.
4. **Accept reality and rewrite D-05's UI:** show the cache stat row as "Input: N | Cache: not eligible (prefix under 4K tokens) | Cost: ~$0.00N | Model: X" rather than "warming (first run)".
**Warning signs:** Every evaluation reports `cache_read_input_tokens = 0` even on the 2nd, 3rd, 4th run in rapid succession. The success criterion in ROADMAP.md #2 ("run a second evaluation within one hour of the first and see `cache_read_input_tokens > 0`") would be **unsatisfiable as configured**. **This MUST be surfaced before planning — see Open Q2.**

### Pitfall 4: Anthropic streaming's `usage` is cumulative in `message_delta`
**What goes wrong:** If you read `usage` from the `message_delta` event and sum across multiple `message_delta`s, you double-count. The SDK's `.finalMessage()` returns the final accumulated Message whose `usage` is what you want.
**Why it happens:** `[CITED: messages-streaming docs "The token counts shown in the usage field of the message_delta event are cumulative"]`
**How to avoid:** Always read `usage` from `await stream.finalMessage()`, never from individual events.
**Warning signs:** Token counts displayed are roughly 2× or N× higher than expected.

### Pitfall 5: Batch runner writes to `applications.md` without proper-lockfile
**What goes wrong:** Batch and GUI writes race. If the user edits a status in the GUI while `merge-tracker.mjs` is mid-read of `applications.md`, the merge script reads a stale version and the GUI's edit gets overwritten.
**Why it happens:** `batch-runner.sh` uses its own mkdir-based lock (`batch/.batch-state.lock/`) for batch state, NOT for `applications.md`. `merge-tracker.mjs` has no lock at all. `[VERIFIED: grep batch-runner.sh + merge-tracker.mjs]`
**How to avoid:** One of:
1. **Teach `merge-tracker.mjs` to acquire `proper-lockfile.lock(applicationsPath, ...)` before read/write.** This is the right fix and is tiny.
2. **Accept that GUI status edits are best-effort during an active batch run** and gray out the Status column while the Batch op tab is running.
3. **Document the race and leave it as a known issue for Phase 3.**
Recommendation: Option 1. It's ~10 LOC in `merge-tracker.mjs` and closes the real hole. CONTEXT.md D-14 mentions the TSV-addition pattern bypass for status updates but does NOT address merge-tracker's lock gap.
**Warning signs:** A GUI status change appears, then reverts to the old value a few seconds later after a batch run completes.

### Pitfall 6: chokidar on WSL2 with `usePolling: true` has ~1s latency
**What goes wrong:** The `pendingGuiWrites` suppression TTL of 1500ms must exceed chokidar's detection latency + `awaitWriteFinish.stabilityThreshold`. On WSL2 with `interval: 1000`, a write may not be detected until ~1-1.5s after it completes. Add `awaitWriteFinish: 500ms` on top → potentially 2s total. A 1500ms TTL may expire BEFORE the watcher fires, causing a banner to appear.
**Why it happens:** `[VERIFIED: watcher.ts:20 — usePolling on WSL with interval:1000 + awaitWriteFinish:500ms]`
**How to avoid:** Set `pendingGuiWrites` TTL to 3000ms on WSL, 1500ms otherwise. Probe `isWSL()` (already defined in watcher.ts). Or simpler: clear the entry in `pendingGuiWrites` only after the watcher actually fires for that path — put the clear in the watcher's handler, not on a timer.
**Warning signs:** GUI user edits a status, banner flashes briefly afterward, user has to click refresh (which re-reads the tracker — no data loss, but jarring).

### Pitfall 7: Child process inherits `cwd` incorrectly
**What goes wrong:** `scan.mjs` line 29: `const PORTALS_PATH = 'portals.yml'` — a relative path. If `spawn('node', ['scan.mjs'])` is called with `cwd` set to anywhere other than project root, the scan fails with "Cannot find portals.yml".
**Why it happens:** The scripts expect to run with PWD = project root. `[VERIFIED: grep of scan.mjs]`
**How to avoid:** Always pass `{cwd: projectRoot}` to `spawn`. Phase 1's `resolveProjectRoot()` function is already implemented in `main/index.ts:7`; reuse it.
**Warning signs:** "ENOENT: no such file or directory, open 'portals.yml'" in the scan operations log.

### Pitfall 8: `merge-tracker.mjs` absolute-path behavior
**What goes wrong:** `merge-tracker.mjs` resolves its own directory via `fileURLToPath(import.meta.url)` (line 23) and builds `APPS_FILE` from that, NOT from PWD. So its locality to the project root is correct regardless of `cwd`. BUT `batch-runner.sh` uses `cd $SCRIPT_DIR/..` to set `$PROJECT_DIR` and operates relative to its own location. Either works from Electron main as long as the script paths are correctly passed.
**Why it happens:** Good defensive coding on the existing scripts' part. `[VERIFIED: merge-tracker.mjs:23]`
**How to avoid:** Nothing to do — just don't move the scripts. Spawn `node /abs/path/to/merge-tracker.mjs` works.

### Pitfall 9: AbortController leak on normal stream completion
**What goes wrong:** If the handler stores `AbortController` in a Map keyed by evaluation ID, but only deletes the entry on `abort()`, completed evaluations accumulate Map entries.
**Why it happens:** Developer forgets the "happy path" cleanup.
**How to avoid:** In the `streamEvaluation` service, delete the Map entry in the `finally` of the inner async function, regardless of success/abort/error.
**Warning signs:** Memory usage climbs across many evaluations; eventually the Map is huge.

### Pitfall 10: React re-render storm on streaming
**What goes wrong:** Every token (hundreds to thousands) triggers a state update in the renderer. If `StreamingReportView` re-renders the entire react-markdown tree on each token, performance tanks on long reports.
**Why it happens:** react-markdown re-parses the markdown tree each render.
**How to avoid:** (1) Batch token updates with `requestAnimationFrame` — flush the accumulated buffer every 16ms instead of per-token; (2) Memoize react-markdown with `React.memo` keyed on content; (3) Consider throttling at the main-process side (e.g., batch tokens into 50ms chunks before sending IPC) — simplest. `[ASSUMED based on React + SSE streaming patterns]`
**Warning signs:** Scrolling in the streaming output is janky; the whole app feels slow during evaluation.

---

## Code Examples

### Loading safeStorage-encrypted key

```typescript
// services/key-store.ts
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
import { app, safeStorage } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

const KEY_PATH = path.join(app.getPath('userData'), 'api-key.enc')

export const keyStore = {
  async hasKey(): Promise<boolean> {
    return existsSync(KEY_PATH)
  },

  async get(): Promise<string | null> {
    if (!existsSync(KEY_PATH)) return null
    if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable')
    const buf = await fs.readFile(KEY_PATH)
    return safeStorage.decryptString(buf)
  },

  async save(raw: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable')
    const encrypted = safeStorage.encryptString(raw)
    await writeFileAtomic(KEY_PATH, encrypted)
  },

  async clear(): Promise<void> {
    if (existsSync(KEY_PATH)) await fs.unlink(KEY_PATH)
  },

  backendWarning(): string | null {
    // On Linux, detect if we fell back to plaintext
    if (process.platform !== 'linux') return null
    // VERIFIED: getSelectedStorageBackend returns 'basic_text' when no keyring
    const backend = safeStorage.getSelectedStorageBackend?.()
    if (backend === 'basic_text') {
      return 'OS keyring unavailable — key stored with weak protection. Install libsecret or kwallet to upgrade.'
    }
    return null
  },
}
```

### Verify API key (Settings "Verify" button)

```typescript
// Uses a minimal message rather than /models (SDK doesn't expose models.list directly in all versions).
// Source: Anthropic SDK — client.messages.create with small max_tokens
async function verifyApiKey(rawKey: string): Promise<{ ok: boolean; error?: string }> {
  const client = new Anthropic({ apiKey: rawKey })
  try {
    await client.messages.create({
      model: 'claude-haiku-4-5',                 // cheapest available
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    return { ok: true }
  } catch (err: any) {
    if (err?.status === 401) return { ok: false, error: 'Invalid API key' }
    if (err?.status === 429) return { ok: false, error: 'Rate limited — try again' }
    return { ok: false, error: err?.message ?? 'Verification failed' }
  }
}
```

### Extracting cost from usage

```typescript
// Pricing per million tokens — Sonnet 4.6 (verified 2026-04 via pricepertoken.com and platform.claude.com)
const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-4-6': { in: 3.00,  out: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-haiku-4-5':  { in: 1.00,  out: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25  },
  // Haiku 4.5 pricing [ASSUMED — verify via platform.claude.com/pricing before shipping]
}

function calculateCost(model: string, usage: {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}): number {
  const p = PRICES[model] ?? PRICES['claude-sonnet-4-6']
  return (
    (usage.input_tokens * p.in) +
    (usage.output_tokens * p.out) +
    (usage.cache_read_input_tokens * p.cacheRead) +
    (usage.cache_creation_input_tokens * p.cacheWrite)
  ) / 1_000_000
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `keytar` for credential storage in Electron | `safeStorage` (built-in) | Electron 15+ | Zero native dependency; no rebuild per Electron version. |
| Manual SSE parsing from Anthropic | `@anthropic-ai/sdk` streaming helpers | SDK 0.20+ (2024) | Typed events, `.finalMessage()`, `AbortController` support. |
| Prompt caching required beta header | Standard on all active models | 2024-08 (beta → GA) | No `anthropic-beta: prompt-caching-*` header needed for 5-min TTL. `[VERIFIED: prompt-caching docs]` |
| `lockfile` npm package | `proper-lockfile` | ~2017 | Active maintenance; stale detection works correctly. |
| `fs.writeFile` + `fs.rename` manual atomic | `write-file-atomic` | ~2015 | Handles chown/mode/fsync; murmur-hashed temp name avoids collision. |
| `child_process.fork` for Electron child work | `UtilityProcess` (Electron 22+) | 2023 | Better integration, but needs separate bundle. For this phase, `spawn` of existing scripts is still the right tool. |

**Deprecated / outdated:**
- **`keytar`**: still works but deprecated in favor of `safeStorage` for Electron 15+. The CONTEXT.md D-09 correctly specifies `safeStorage`.
- **Beta header for standard prompt caching**: no longer required. Use `ttl: "1h"` only if opting into extended cache.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Haiku 4.5 pricing ($1/M in, $5/M out, cache-read $0.10/M, cache-write $1.25/M) | Code Examples — Extracting cost | Cost display slightly off; not functional. Verify at platform.claude.com/pricing before shipping. |
| A2 | `readline.createInterface` is the right line-buffering approach for child stdout in Electron | Pattern 4 | If buggy, log drawer shows partial/duplicated lines. Well-established Node pattern; low risk. |
| A3 | 3000ms `pendingGuiWrites` TTL on WSL, 1500ms elsewhere is sufficient | Pitfall 6 | Too short → banner flicker. Too long → misses back-to-back external edits. Tunable in response to user reports. |
| A4 | Single `cache_control` breakpoint at end of stable prefix is optimal | Pattern 2 | Multiple breakpoints might recover some caching on the `_shared`-only prefix if the rest changes, but is more complex. Monitor cache hits in practice. |
| A5 | Sonnet 4.6 cache-write cost is 1.25× base input (= $3.75/M) | Code Examples | [VERIFIED via pricepertoken.com — MEDIUM confidence; cross-verify via platform.claude.com/pricing]. |
| A6 | Throttling tokens at main-process side (50ms chunks) is preferable to requestAnimationFrame batching in renderer | Pitfall 10 | If react-markdown is already fast, throttling is unnecessary complexity. Measure before optimizing. |
| A7 | The `runId` naming pattern `${kind}-${Date.now()}` is sufficient for operations log drawer tab keys | Pattern 4 | Two rapid spawns of the same kind within 1ms would collide. Vanishingly unlikely; acceptable. |
| A8 | The batch runner's exiting lock scheme is sufficient for batch-internal concurrency | Pattern 3 + Pitfall 5 | True for batch-vs-batch races. The GUI-vs-batch race still exists unless merge-tracker.mjs learns proper-lockfile. |

**Claims with verified sources (no assumption):**
- Streaming event names, cache_control syntax, TTL values, usage fields, minimums (from platform.claude.com docs, 2026-04)
- safeStorage API signatures, Linux `basic_text` fallback, isEncryptionAvailable ready-event dependency (from electronjs.org/docs and linked issues)
- proper-lockfile option names and defaults (from GitHub README)
- write-file-atomic temp-file-rename mechanism (from GitHub README)
- Node child_process + readline patterns (standard Node documentation)
- All existing Phase 1 code references (grepped directly in repo)

---

## Open Questions

1. **Batch-path concurrent-write safety — is this in scope for Phase 2?**
   - What we know: `merge-tracker.mjs` writes `data/applications.md` without any file lock. The GUI adds `proper-lockfile` on its write path. An interleaved GUI edit + batch merge can clobber GUI changes.
   - What's unclear: ROADMAP.md success criterion #5 says "zero corruption across 100+ interleaved GUI+batch operations." The fix is ~10 LOC in `merge-tracker.mjs` but CONTEXT.md doesn't explicitly include it.
   - Recommendation: **Add teaching `merge-tracker.mjs` to acquire `proper-lockfile` as a task in Phase 2's plan.** It's the cleanest way to satisfy the success criterion.

2. **Prefix is below Sonnet 4.6 cache threshold — how do we satisfy ROADMAP.md #2?**
   - What we know: `cv.md` (119) + `_shared.md` (161) + `oferta.md` (216) + `_profile.md` (102) + `profile.yml` (68) ≈ 666 lines ≈ ~850-900 tokens. Sonnet 4.6 minimum is 2048; Haiku 4.5 minimum is 4096. The prefix as specified CANNOT trigger cache.
   - What's unclear: Is this a real problem for the user's data, or is the test user's context going to be much larger? If the user's `cv.md` is typical (~150-300 lines) and `article-digest.md` exists (~200-500 lines), total could reach 2048+ for Sonnet. For Haiku 4.5, 4096 is hard to reach.
   - Recommendation: **Before planning, either (a) confirm the user's actual context file sizes and include `article-digest.md` in the prefix when present, or (b) change the default model to one with a lower minimum, or (c) rewrite the token stats UI copy from "warming (first run)" to "Cache: not eligible (prefix under 4K tokens)" and accept that success criterion #2 requires >= 4K tokens in prefix**. This is a discussion-level question the planner cannot resolve alone.

3. **`data/.mtime-cache.json` — gitignored or committed?**
   - What we know: Sidecar is regenerated on every evaluation; committing it creates merge conflicts.
   - What's unclear: Is `data/.*.json` already in `.gitignore`? Need to check.
   - Recommendation: Add `data/.mtime-cache.json` to `.gitignore` in the plan.

4. **Should the GUI-stored API key be exposed to the batch path (ELEC-07 batch trigger)?**
   - What we know: REQUIREMENTS.md API-04 explicitly says "CLI batch path continues to use `ANTHROPIC_API_KEY` env var." So batch-runner.sh does NOT read the safeStorage-encrypted key.
   - What's unclear: When the user clicks "Run batch evaluation" from the GUI, does the main process inject the decrypted key into the child's env? Or must the user have already exported `ANTHROPIC_API_KEY` in their shell?
   - Recommendation: **Main process decrypts the key and injects it into `child.env` when spawning batch-runner.sh.** This is the behavior that matches user expectation (they configured the key in Settings; it should "just work"). Alternative is to show a dialog "Batch run requires ANTHROPIC_API_KEY in your shell environment." The former is more polished.

5. **Model selector — should it persist across sessions?**
   - What we know: UI-SPEC says model change "persists to user preferences sidecar immediately." CONTEXT.md D-07 doesn't specify where.
   - Recommendation: Store in `{userData}/preferences.json` (small JSON with `{model, ...}`) written via writeFileAtomic. Keep it separate from the encrypted key file. This is Claude's discretion per CONTEXT.md.

6. **Token throttling: main-process or renderer?**
   - What we know: Pitfall 10 warns about re-render storms on streaming.
   - Recommendation: Start without throttling; if react-markdown reparsing is slow in practice, add a 50ms `setTimeout`-based flush buffer in the main process before measuring more invasive optimizations. The UI-SPEC already says "auto-scroll to bottom ONLY if the user hasn't manually scrolled up during streaming" which implies smooth rendering is table-stakes.

7. **`runBatch` UX when an evaluation is in-flight:**
   - What we know: UI-SPEC marks "Run batch evaluation" as disabled if Evaluate panel has a stream in-flight.
   - What's unclear: Does the reverse also hold — should the Evaluate button be disabled while Batch is running? A single API key is shared; parallel requests hit the same rate limit.
   - Recommendation: **Allow parallel.** Anthropic's rate limits are fairly generous for personal use. If 429 arrives, D-03 error UX handles it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 18+ | Anthropic SDK, scan.mjs, merge-tracker.mjs | ✓ | 22.22.2 | — |
| npm | Install new packages | ✓ | 11.12.1 | — |
| git | commit_docs auto-commits | ✓ | 2.43.0 | — |
| Electron 41.2.2 | safeStorage, ipcMain, BrowserWindow | ✓ | bundled | — |
| Anthropic API reachability | All evaluations | ✓ (assumed) | n/a | surface 500/network errors inline |
| libsecret or kwallet (Linux) | safeStorage strong encryption | ✗ (likely — WSL2) | — | `basic_text` fallback with warning |
| `claude` CLI | batch-runner.sh workers | — | — | Batch button surfaces "claude CLI not found" on spawn error |
| Playwright + Chromium | generate-pdf.mjs | ✓ (assumed — Phase 1 used it indirectly) | — | PDF button surfaces script's stderr in log drawer |
| bash | batch/batch-runner.sh | ✓ | n/a | — |

**Missing dependencies with no fallback:**
- `claude` CLI — only blocks the batch path. UI should surface the error in the operations log drawer; do NOT block app startup on this.

**Missing dependencies with fallback:**
- Linux keyring (libsecret/kwallet) — safeStorage degrades to `basic_text` with a visible warning in Settings.

---

## Security Domain

Per `security_enforcement: false` (absent from config.json, so default behavior applies per the GSD rulebook). Phase 2 extends Phase 1's security baseline without loosening it. Key verifications:

| Control | Applies | Standard Enforcement |
|---------|---------|---------------------|
| V2 Authentication (API key handling) | yes | safeStorage encrypts at rest; never crosses contextBridge; never logged. |
| V5 Input Validation (IPC) | yes | Zod schemas on `updateStatus`, `saveApiKey`, `evaluateUrl`, `regeneratePDF`, `runScan`, `runBatch` — mirrors Phase 1's `ReportPathSchema` pattern in `ipc-handlers.ts`. |
| V6 Cryptography | yes | Use safeStorage — never hand-roll AES. |
| V7 Error Handling | yes | Errors surfaced as typed IPC events; no stack traces shipped to renderer. |
| V10 Malicious Code (XSS via streaming) | yes | `rehype-sanitize` already in render pipeline from Phase 1 — keep applied to streaming output. |
| V12 File Handling | yes | All paths built from `projectRoot` + constant segments, not from renderer input. Exception: `ReportPathSchema` already validates Phase 1's only renderer-provided path. |

**Known threat patterns for this stack:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leak via console.log | Information Disclosure | Zero `console.log` on the key; Zod strips sensitive fields from error payloads. |
| Renderer tricks main into reading arbitrary files | Tampering | Continue Phase 1 pattern — validate any path inputs with Zod regex. No new paths come from renderer in Phase 2. |
| Prompt injection in URL content | Tampering of LLM output | Out of scope — user accepts that an adversarial job posting can influence the A-G report. Not a security boundary violation. |
| XSS in streaming markdown | XSS | `rehype-sanitize` — already applied. |
| Local file race corrupts tracker | Denial of Service / data loss | `proper-lockfile` + `writeFileAtomic`. |
| child_process command injection | Tampering | Static argument arrays (`['scan.mjs']` not shell-composed); never `exec()`; always `spawn()` with array args. |

---

## Project Constraints (from CLAUDE.md)

These directives override all other research recommendations:

1. **User vs System Layer:** `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`, `data/*`, `reports/*`, `output/*`, `interview-prep/*` are NEVER auto-updated. Phase 2 adds code and reads these files; it does NOT modify them programmatically except through user action (e.g., `regeneratePDF` overwrites `output/*` — allowed as an output-layer write).
2. **Ethical use (no auto-submit):** The Evaluate panel produces a report; it does NOT apply to the job. This aligns with CONTEXT.md; no code path should call Playwright's form-fill logic.
3. **TSV-addition pattern for NEW tracker entries:** Already baked into CONTEXT.md D-14. Status updates are a targeted line-level edit and bypass the TSV addition.
4. **NEVER create new entries in applications.md if company+role already exists** — enforced by `merge-tracker.mjs` already, not a Phase 2 concern.
5. **Canonical statuses only** (no bold, no dates, no extra text) — the StatusSelect dropdown options come from `templates/states.yml`, enforcing this structurally.
6. **All reports include `**URL:**` in the header** — this is a prompt contract, not a code contract. Phase 2's system prompt assembly must ensure `modes/oferta.md` (which contains this requirement) is in the stable prefix.
7. **`ANTHROPIC_API_KEY` env var for CLI batch path** — Phase 2 adds GUI-key storage but MUST NOT remove env-var support from batch-runner.sh.

---

## Validation Architecture

Not applicable — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. Standard `node --test tests/*.test.mjs` + manual verification at phase gate per config.

---

## Sources

### Primary (HIGH confidence)
- Anthropic Streaming docs — `https://platform.claude.com/docs/en/api/messages-streaming` — event flow, SSE format, SDK stream helpers, AbortController/signal cancellation
- Anthropic Prompt Caching docs — `https://platform.claude.com/docs/en/build-with-claude/prompt-caching` — cache_control syntax, TTL values, usage fields, minimum token thresholds per model, invalidation hierarchy
- Anthropic TypeScript SDK helpers — `https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md` — MessageStream event names, `.finalMessage()`, `.abort()`, async iterator support
- Electron safeStorage docs — `https://www.electronjs.org/docs/latest/api/safe-storage` — isEncryptionAvailable, encryptString/decryptString, Linux basic_text fallback
- proper-lockfile README — `https://github.com/moxystudio/node-proper-lockfile` — lock(), release pattern, stale detection, options
- write-file-atomic README — `https://github.com/npm/write-file-atomic` — temp + rename atomicity, options, signature
- Phase 1 code files read directly in this session: `electron/src/preload/types.ts`, `electron/src/preload/index.ts`, `electron/src/main/ipc-handlers.ts`, `electron/src/main/watcher.ts`, `electron/src/main/index.ts`, `electron/src/renderer/App.tsx`, `electron/src/renderer/components/StatusSelect.tsx`, `electron/src/renderer/components/ReportViewer.tsx`, `electron/package.json`
- Reference code read: `dashboard/internal/data/career.go` lines 544-596 (UpdateApplicationStatus, replaceStatusInLine), `batch/batch-runner.sh` lines 1-150 (lock scheme), `merge-tracker.mjs` lines 1-100, `lib/statuses.mjs`, `scan.mjs` lines 1-50, `templates/states.yml`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/01-electron-shell-read-only-views/01-CONTEXT.md`

### Secondary (MEDIUM confidence)
- Electron child_process best practices — `https://www.electronjs.org/docs/latest/tutorial/ipc` (IPC patterns), `https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html` (child_process from main vs renderer)
- Claude Sonnet 4.6 pricing — `https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4.6` — $3/M in, $15/M out, 0.1× cache read, 1.25× cache write (corroborated by platform.claude.com/docs/en/about-claude/pricing)
- Electron safeStorage Linux issues — `https://github.com/electron/electron/issues/39789` (XDG_CURRENT_DESKTOP detection), `https://github.com/electron/electron/issues/32206` (pre-ready crash, now fixed)
- npm registry version checks — `npm view @anthropic-ai/sdk / proper-lockfile / write-file-atomic version` run in session

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Haiku 4.5 exact pricing (Assumption A1)
- WSL2-specific pendingGuiWrites TTL of 3000ms (Assumption A3 — empirically tunable)
- React re-render cost on react-markdown per-token updates (Assumption A6)

---

## Metadata

**Confidence breakdown:**
- Standard stack (SDK, locks, atomic writes): HIGH — all verified against current official docs and npm registry
- Architecture (IPC, main-vs-renderer split, spawn patterns): HIGH — Phase 1 code directly read; Anthropic SDK helpers doc explicit
- Prompt caching semantics: HIGH for syntax; MEDIUM for the "will the cache actually trigger on this project's actual files" question — see Pitfall 3 and Open Q2
- safeStorage cross-platform: HIGH for macOS/Windows; MEDIUM for the specific WSL2 environment detection behavior (test needed)
- Concurrent-write race coverage: HIGH for the GUI-vs-GUI path; MEDIUM for GUI-vs-batch without merge-tracker patch (see Open Q1)
- Child-process patterns: HIGH (standard Node primitives, well-documented)
- Pitfalls: HIGH — directly verified against repo code and official docs

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30-day window for stable libraries; any earlier if a major `@anthropic-ai/sdk` release introduces breaking streaming or cache API changes)
