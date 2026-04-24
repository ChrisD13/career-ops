# Phase 02: Write Safety + Anthropic Integration - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/main/services/evaluation-service.ts` | service | streaming | `electron/src/main/ipc-handlers.ts` + RESEARCH.md Pattern 1 | role-match (no prior streaming analog) |
| `electron/src/main/services/key-store.ts` | service | request-response | `electron/src/main/ipc-handlers.ts` | role-match |
| `electron/src/main/services/status-writer.ts` | service | CRUD | `dashboard/internal/data/career.go:544–596` | exact (same write algorithm, different language) |
| `electron/src/main/services/mtime-cache.ts` | service | file-I/O | `lib/statuses.mjs` (cache Map + fallback pattern) | role-match |
| `electron/src/main/services/process-runner.ts` | service | event-driven | `electron/src/main/watcher.ts` (child event relay) | role-match |
| `electron/src/main/ipc-handlers.ts` | middleware | request-response | `electron/src/main/ipc-handlers.ts` (self — extend) | exact |
| `electron/src/main/watcher.ts` | middleware | event-driven | `electron/src/main/watcher.ts` (self — extend) | exact |
| `electron/src/preload/types.ts` | config | request-response | `electron/src/preload/types.ts` (self — extend) | exact |
| `electron/src/preload/index.ts` | config | request-response | `electron/src/preload/index.ts` (self — extend) | exact |
| `electron/src/renderer/panels/EvaluatePanel.tsx` | component | streaming | `electron/src/renderer/components/PipelinePanel.tsx` + `ReportViewer.tsx` | role-match |
| `electron/src/renderer/panels/CVPanel.tsx` | component | request-response | `electron/src/renderer/components/ReportViewer.tsx` | exact |
| `electron/src/renderer/components/SettingsSlideOver.tsx` | component | request-response | `electron/src/renderer/components/SplitPaneLayout.tsx` (slide-over overlay pattern) | partial-match |
| `electron/src/renderer/components/OpsDrawer.tsx` | component | event-driven | `electron/src/renderer/components/FileChangeBanner.tsx` + watcher push pattern | partial-match |
| `electron/src/renderer/components/StatusSelect.tsx` | component | CRUD | `electron/src/renderer/components/StatusSelect.tsx` (self — rewrite) | exact |
| `lib/mtime-cache.mjs` | utility | file-I/O | `lib/statuses.mjs` | exact |
| `merge-tracker.mjs` | utility | CRUD | `merge-tracker.mjs` (self — extend) | exact |

---

## Pattern Assignments

### `electron/src/main/services/evaluation-service.ts` (service, streaming)

**Analog:** RESEARCH.md Pattern 1 + `electron/src/main/ipc-handlers.ts` for structure conventions

**Imports pattern** — copy from `ipc-handlers.ts` lines 1–8, add SDK:
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
```

**Core streaming pattern** — from RESEARCH.md Pattern 1 (lines 232–291):
```typescript
export async function streamEvaluation(params: EvaluationParams) {
  const client = new Anthropic({ apiKey: params.apiKey })
  const controller = new AbortController()

  const streamPromise = (async () => {
    const stream = client.messages.stream(
      {
        model: params.model,
        max_tokens: 8192,
        system: [
          {
            type: 'text',
            text: params.contextFiles.shared
                + '\n\n---\n\n' + params.contextFiles.oferta
                + '\n\n---\n\n' + params.contextFiles.cv
                + '\n\n---\n\n' + params.contextFiles.profile,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          { role: 'user', content: `Evaluate this job URL and produce A-G report: ${params.url}` },
        ],
      },
      { signal: controller.signal },
    )

    stream.on('text', (delta: string) => {
      if (!params.win.isDestroyed()) {
        params.win.webContents.send('evaluation:token', delta)
      }
    })

    try {
      const finalMessage = await stream.finalMessage()
      if (!params.win.isDestroyed()) {
        params.win.webContents.send('evaluation:done', {
          usage: finalMessage.usage,
          stopReason: finalMessage.stop_reason,
        })
      }
    } catch (err: any) {
      if (err?.name === 'APIUserAbortError') {
        params.win.webContents.send('evaluation:cancelled')
      } else {
        params.win.webContents.send('evaluation:error', {
          status: err?.status,
          type: err?.error?.type,
          message: err?.message,
          retryAfter: err?.headers?.['retry-after'],
        })
      }
    }
  })()

  return { controller, done: streamPromise }
}
```

**IPC push pattern** — copy from `watcher.ts` lines 26–33 (the `win.webContents.send` + `isDestroyed()` guard):
```typescript
// From watcher.ts lines 28–31 — always guard with isDestroyed()
if (!win.isDestroyed()) {
  win.webContents.send('evaluation:token', delta)
}
```

**Error handling pattern** — from RESEARCH.md Pattern 1: catch `APIUserAbortError` by name; surface status/type/message/retryAfter to renderer. Never throw through IPC; always send typed error event.

---

### `electron/src/main/services/key-store.ts` (service, request-response)

**Analog:** RESEARCH.md Code Examples "Loading safeStorage-encrypted key" + `ipc-handlers.ts` style

**Imports pattern:**
```typescript
import { app, safeStorage } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'
```

**Core pattern** — from RESEARCH.md Code Examples (lines 683–715):
```typescript
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
  backendWarning(): string | null {
    if (process.platform !== 'linux') return null
    const backend = safeStorage.getSelectedStorageBackend?.()
    if (backend === 'basic_text') {
      return 'OS keyring unavailable — key stored with weak protection. Install libsecret or kwallet to upgrade.'
    }
    return null
  },
}
```

**Initialization constraint:** Only call `keyStore` methods inside `app.whenReady().then(...)`. Mirror `index.ts` line 53's `app.whenReady()` guard.

---

### `electron/src/main/services/status-writer.ts` (service, CRUD)

**Analog:** `dashboard/internal/data/career.go` lines 544–596 (Go reference) + RESEARCH.md Pattern 3

**Go reference for regex-replace algorithm** (`career.go` lines 579–596):
```go
// replaceStatusInLine replaces only the status column in a tracker row.
func replaceStatusInLine(line, newStatus string) string {
  parts := strings.Split(strings.Trim(line, "|"), "|")
  if len(parts) < 8 { return line }
  for i := range parts { parts[i] = strings.TrimSpace(parts[i]) }
  parts[5] = newStatus   // Go schema: 0=num,1=date,2=company,3=role,4=score,5=STATUS
  return "| " + strings.Join(parts, " | ") + " |"
}
```

**Node translation** — Note column index difference: Node schema has `score` BEFORE `status`; Go `parts[5]` = status (after Trim+Split strips outer pipes), Node `parts[6]` = status (split includes empty bookends):
```typescript
// parts layout after line.split('|').map(s=>s.trim()):
// [0]=''  [1]=num  [2]=date  [3]=company  [4]=role  [5]=score  [6]=STATUS  [7]=pdf  [8]=report  [9]=notes  [10]=''
parts[6] = newStatus
lines[i] = '| ' + parts.slice(1, -1).join(' | ') + ' |'
```

**Lock + atomic write pattern** — from RESEARCH.md Pattern 3:
```typescript
import lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'
import { promises as fs } from 'fs'

export async function updateStatus(
  filePath: string,
  reportNumber: number,
  newStatus: string,
  pendingGuiWrites: Set<string>,
): Promise<StatusUpdateResult> {
  let release: () => Promise<void>
  try {
    release = await lockfile.lock(filePath, {
      stale: 10_000,
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
    })
  } catch (err: any) {
    return { success: false, error: 'lock-timeout', message: err.message }
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    // ... line-replace logic ...
    pendingGuiWrites.add(filePath)
    await writeFileAtomic(filePath, lines.join('\n'))
    setTimeout(() => pendingGuiWrites.delete(filePath), 3000) // 3s on WSL (see Pitfall 6)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: 'fs-error', message: err.message }
  } finally {
    await release!()
  }
}
```

**Error handling:** Return typed `StatusUpdateResult` union (success, lock-timeout, not-found, parse-error, fs-error) — never throw through IPC boundary.

---

### `electron/src/main/services/mtime-cache.ts` (service, file-I/O)

**Analog:** `lib/statuses.mjs` (in-memory Map with fallback + lazy init pattern)

**Caching Map pattern from `lib/statuses.mjs` lines 24–43:**
```javascript
const catalogCache = new Map()  // keyed by baseDir; reuse across calls

function loadStates(baseDir) {
  // try candidates; fall back silently on missing/corrupt
  try { ... } catch { /* fall through to defaults */ }
  return FALLBACK_STATES
}
```

**TypeScript translation for mtime-cache.ts** — from RESEARCH.md Pattern 5:
```typescript
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
      for (const [p, mtimeMs] of Object.entries(json)) {
        this.cache.set(p, { mtimeMs, content: '' })  // content re-read on first access
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

**Imports:** `{ promises as fs } from 'fs'`, `* as path from 'path'`, `writeFileAtomic from 'write-file-atomic'`.

---

### `electron/src/main/services/process-runner.ts` (service, event-driven)

**Analog:** `electron/src/main/watcher.ts` (event relay to renderer via `win.webContents.send`)

**IPC push relay pattern from `watcher.ts` lines 26–33:**
```typescript
watcher.on('all', () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (!win.isDestroyed()) {
      win.webContents.send('files-changed')  // ← push pattern to copy
    }
  }, 300)
})
```

**Core spawn + relay pattern** — from RESEARCH.md Pattern 4:
```typescript
import { spawn } from 'child_process'
import * as readline from 'readline'

export function startOp(opts: { kind: OpKind; command: string; args: string[]; cwd: string; win: BrowserWindow }): string {
  const runId = `${opts.kind}-${Date.now()}`
  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

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
```

**Critical:** Use `readline.createInterface` (not raw `data` events) for line-buffered relay. Always pass `cwd: projectRoot` from `resolveProjectRoot()` (`index.ts` line 7).

---

### `electron/src/main/ipc-handlers.ts` (middleware, request-response — extend)

**Analog:** `electron/src/main/ipc-handlers.ts` (self — lines 1–34)

**Existing handler structure to replicate** (lines 1–34):
```typescript
import { ipcMain } from 'electron'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { parseApplications } from './parsers/applications'

const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)

export function registerIpcHandlers(projectRoot: string): void {
  ipcMain.handle('readTracker', async () => {
    return parseApplications(path.join(projectRoot, 'data', 'applications.md'))
  })

  ipcMain.handle('readReport', async (_event, rawPath: unknown) => {
    const reportPath = ReportPathSchema.parse(rawPath)    // Zod validate EVERY IPC input
    return fs.readFile(path.join(projectRoot, reportPath), 'utf-8')
  })
}
```

**New handlers follow the same pattern:**
- `ipcMain.handle('updateStatus', async (_event, raw) => { const { num, status } = UpdateStatusSchema.parse(raw); ... })`
- `ipcMain.handle('evaluateUrl', async (_event, rawUrl) => { const url = UrlSchema.parse(rawUrl); ... })`
- `ipcMain.handle('saveApiKey', async (_event, rawKey) => { const key = ApiKeySchema.parse(rawKey); ... })`
- Push-only channels (`evaluation:token`, `op:output`) use `webContents.send` in services, NOT `ipcMain.handle`.

**Validation schemas to add:**
```typescript
const UpdateStatusSchema = z.object({ num: z.number().int().positive(), status: z.string().min(1).max(50) })
const UrlSchema = z.string().url()
const ApiKeySchema = z.string().regex(/^sk-ant-/)
```

---

### `electron/src/main/watcher.ts` (middleware, event-driven — extend)

**Analog:** `electron/src/main/watcher.ts` (self — lines 1–46)

**Current handler to extend** (lines 24–33):
```typescript
// Current: unconditionally sends 'files-changed'
watcher.on('all', () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (!win.isDestroyed()) {
      win.webContents.send('files-changed')
    }
  }, 300)
})
```

**Add `pendingGuiWrites: Set<string>` parameter to `startFileWatcher`:**
```typescript
// Phase 2 extension — add pendingGuiWrites check
export function startFileWatcher(
  projectRoot: string,
  win: BrowserWindow,
  pendingGuiWrites: Set<string>,   // NEW parameter
): () => void {
  // ...
  watcher.on('all', (_event, filePath) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (pendingGuiWrites.has(filePath)) return    // suppress banner for GUI writes
      if (!win.isDestroyed()) {
        win.webContents.send('files-changed')
      }
    }, 300)
  })
}
```

**WSL TTL note:** The `pendingGuiWrites.delete(filePath)` setTimeout in `status-writer.ts` uses 3000ms on WSL (reuse `isWSL()` from `watcher.ts` line 4).

---

### `electron/src/preload/types.ts` (config — extend)

**Analog:** `electron/src/preload/types.ts` (self — lines 1–40)

**Existing interface to extend** (lines 27–33):
```typescript
export interface ElectronAPI {
  readTracker: () => Promise<TrackerRow[]>
  readPipeline: () => Promise<PipelineEntry[]>
  readReport: (reportPath: string) => Promise<string>
  readStatuses: () => Promise<StatusEntry[]>
  listReports: () => Promise<string[]>
  onFilesChanged: (callback: () => void) => () => void   // ← subscribe pattern to copy
}
```

**New types and methods to add** (follow exact same shape):
```typescript
// New event payload types
export interface EvaluationDonePayload {
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number }
  stopReason: string
}
export interface EvaluationErrorPayload { status?: number; type?: string; message: string; retryAfter?: string }
export interface OpOutputPayload { runId: string; kind: string; stream: 'stdout' | 'stderr'; line: string }
export interface OpDonePayload { runId: string; kind: string; code: number | null; signal: string | null }

// New ElectronAPI methods — extend the interface
export interface ElectronAPI {
  // ... existing ...
  updateStatus: (num: number, newStatus: string) => Promise<{ success: boolean; error?: string }>
  evaluateUrl: (url: string) => Promise<{ evaluationId: string }>
  cancelEvaluation: (evaluationId: string) => Promise<void>
  checkApiKey: () => Promise<{ hasKey: boolean }>
  saveApiKey: (rawKey: string) => Promise<{ warning?: string }>
  verifyApiKey: (rawKey: string) => Promise<{ ok: boolean; error?: string }>
  readCv: () => Promise<string>
  regeneratePDF: () => Promise<{ runId: string }>
  runScan: () => Promise<{ runId: string }>
  runBatch: () => Promise<{ runId: string }>
  // Push-event subscriptions (same pattern as onFilesChanged)
  onEvaluationToken: (cb: (delta: string) => void) => () => void
  onEvaluationDone: (cb: (payload: EvaluationDonePayload) => void) => () => void
  onEvaluationError: (cb: (payload: EvaluationErrorPayload) => void) => () => void
  onEvaluationCancelled: (cb: () => void) => () => void
  onOperationOutput: (cb: (payload: OpOutputPayload) => void) => () => void
  onOperationDone: (cb: (payload: OpDonePayload) => void) => () => void
}
```

---

### `electron/src/preload/index.ts` (config — extend)

**Analog:** `electron/src/preload/index.ts` (self — lines 1–19)

**Existing pattern for request-response** (lines 5–7):
```typescript
readTracker: () => ipcRenderer.invoke('readTracker'),
readReport: (reportPath: string) => ipcRenderer.invoke('readReport', reportPath),
```

**Existing pattern for push-event subscription** (lines 10–16):
```typescript
onFilesChanged: (callback: () => void) => {
  const listener = () => callback()
  ipcRenderer.on('files-changed', listener)
  return () => {
    ipcRenderer.removeListener('files-changed', listener)
  }
},
```

**New channels follow the exact same two patterns:**
```typescript
// Request-response additions:
updateStatus: (num: number, newStatus: string) => ipcRenderer.invoke('updateStatus', { num, newStatus }),
evaluateUrl: (url: string) => ipcRenderer.invoke('evaluateUrl', url),
cancelEvaluation: (id: string) => ipcRenderer.invoke('cancelEvaluation', id),
checkApiKey: () => ipcRenderer.invoke('checkApiKey'),
saveApiKey: (rawKey: string) => ipcRenderer.invoke('saveApiKey', rawKey),
verifyApiKey: (rawKey: string) => ipcRenderer.invoke('verifyApiKey', rawKey),
readCv: () => ipcRenderer.invoke('readCv'),
regeneratePDF: () => ipcRenderer.invoke('regeneratePDF'),
runScan: () => ipcRenderer.invoke('runScan'),
runBatch: () => ipcRenderer.invoke('runBatch'),

// Push-event subscriptions (copy onFilesChanged structure exactly):
onEvaluationToken: (callback: (delta: string) => void) => {
  const listener = (_: unknown, delta: string) => callback(delta)
  ipcRenderer.on('evaluation:token', listener)
  return () => ipcRenderer.removeListener('evaluation:token', listener)
},
```

---

### `electron/src/renderer/panels/EvaluatePanel.tsx` (component, streaming)

**Analog:** `electron/src/renderer/components/PipelinePanel.tsx` (load-state machine + `useEffect` fetch) + `ReportViewer.tsx` (markdown rendering pipeline)

**Load-state machine from `PipelinePanel.tsx` lines 12–26:**
```typescript
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: PipelineEntry[] }

// EvaluatePanel uses a streaming-aware variant:
type StreamState =
  | { kind: 'idle' }
  | { kind: 'streaming'; content: string; evaluationId: string }
  | { kind: 'done'; content: string; usage: EvaluationDonePayload['usage'] }
  | { kind: 'error'; partial: string; error: EvaluationErrorPayload }
  | { kind: 'cancelled'; partial: string }
```

**useEffect subscription pattern from `App.tsx` lines 22–25:**
```typescript
// From App.tsx — mirrors how onFilesChanged is subscribed
useEffect(() => {
  const unsub = window.api.onEvaluationToken((delta) => {
    setStreamState(s => s.kind === 'streaming' ? { ...s, content: s.content + delta } : s)
  })
  return unsub
}, [])
```

**Markdown rendering pipeline from `ReportViewer.tsx` lines 1–4, 23–71, 101–110:**
```typescript
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
// ... same components map (h1/h2/p/a/table etc.) ...
// Render streaming content:
<Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
  {streamState.content}
</Markdown>
```

**Error/empty states from `ErrorState.tsx`:**
```typescript
// Copy error pattern from ErrorState.tsx — use onRetry prop for Retry button
<ErrorState heading="Evaluation failed" body={streamState.error.message} onRetry={handleRetry} />
```

**Cancellable fetch cleanup pattern from `ReportViewer.tsx` lines 76–87:**
```typescript
useEffect(() => {
  let cancelled = false
  // ...
  return () => { cancelled = true }
}, [path, refreshKey])
```

---

### `electron/src/renderer/panels/CVPanel.tsx` (component, request-response)

**Analog:** `electron/src/renderer/components/ReportViewer.tsx` — exact same structure (load state, readFile, react-markdown render)

**Full pattern from `ReportViewer.tsx` lines 73–111:**
```typescript
export function CVPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    window.api.readCv()                            // new IPC channel (readCv replaces readReport)
      .then(content => {
        if (!cancelled) setState({ kind: 'ready', content })
      })
      .catch(err => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => { cancelled = true }
  }, [])                                           // no refreshKey — CV changes are external

  // Render: same EmptyState / ErrorState / Markdown pipeline as ReportViewer
}
```

**Panel header with button pattern from `PipelinePanel.tsx` lines 50–53:**
```typescript
<div className="h-9 flex items-center px-4 border-b border-ctp-overlay bg-ctp-surface sticky top-0">
  <span className="text-label text-ctp-subtext uppercase tracking-wider">CV Preview</span>
  {/* Add Regenerate PDF button here */}
</div>
```

---

### `electron/src/renderer/components/SettingsSlideOver.tsx` (component, request-response)

**Analog:** `electron/src/renderer/components/SplitPaneLayout.tsx` (overlay panel with close button) + `FileChangeBanner.tsx` (inline banner pattern)

**Overlay panel frame from `SplitPaneLayout.tsx` lines 11–39:**
```typescript
// Adapt to slide-over: fixed position from right, not split layout
// Close button pattern from lines 22–28:
<button
  type="button"
  onClick={onClose}
  aria-label="Close settings"
  className="text-ctp-blue hover:text-ctp-text p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
>
  <X size={14} aria-hidden="true" />
</button>
```

**Inline banner pattern from `FileChangeBanner.tsx` lines 8–21:**
```typescript
// Reuse for the "no API key" nudge — same yellow warning strip style
<div className="flex items-center gap-2 h-10 px-3 bg-ctp-yellow/15 text-ctp-yellow text-body">
  <KeyRound size={14} aria-hidden="true" />
  <span>Add your Anthropic API key to evaluate offers</span>
</div>
```

**Load-state pattern for async verify button from `PipelinePanel.tsx`:**
```typescript
type VerifyState = 'idle' | 'loading' | 'ok' | 'error'
const [verifyState, setVerifyState] = useState<VerifyState>('idle')
// Click handler:
setVerifyState('loading')
window.api.verifyApiKey(rawKey).then(r => setVerifyState(r.ok ? 'ok' : 'error'))
```

---

### `electron/src/renderer/components/OpsDrawer.tsx` (component, event-driven)

**Analog:** `electron/src/renderer/components/FileChangeBanner.tsx` (conditional render + push-event subscription) + `App.tsx` (global state at App level)

**Push-event subscription pattern from `App.tsx` lines 22–25:**
```typescript
// From App.tsx — OpsDrawer subscribes the same way
useEffect(() => {
  const unsub = window.api.onOperationOutput((payload) => {
    setLogs(prev => [...prev, payload])
    setOpen(true)                             // auto-open on any output
  })
  return unsub
}, [])

useEffect(() => {
  const unsub = window.api.onOperationDone((payload) => {
    if (payload.code === 0) {
      // auto-collapse after 5s on clean exit
      const t = setTimeout(() => setOpen(false), 5000)
      return () => clearTimeout(t)
    }
  })
  return unsub
}, [])
```

**Conditional render pattern from `FileChangeBanner.tsx` line 9:**
```typescript
if (!visible) return null     // Same pattern: if (!open) return collapsed handle only
```

**Catppuccin monospace log styling — extend existing code pattern from `ReportViewer.tsx` lines 54–59:**
```typescript
// Adapt pre/code style for log drawer:
className="font-mono text-body bg-ctp-surface text-ctp-text overflow-x-auto whitespace-pre"
```

---

### `electron/src/renderer/components/StatusSelect.tsx` (component, CRUD — rewrite)

**Analog:** `electron/src/renderer/components/StatusSelect.tsx` (self — full rewrite from Phase 1 stub)

**Phase 1 stub to replace** (lines 1–24):
```typescript
// Current: disabled, no-op
export function StatusSelect({ statuses, currentStatus }: Props) {
  return (
    <select disabled defaultValue={selected} ...>
      {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  )
}
```

**Phase 2 replacement pattern — add `num`, `onSave`, `onCancel` props:**
```typescript
interface Props {
  statuses: StatusEntry[]
  currentStatus: string
  num: number                             // report number for updateStatus IPC
  onStatusChange?: (newStatus: string) => void   // optimistic update in parent
}

export function StatusSelect({ statuses, currentStatus, num, onStatusChange }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    setSaving(true)
    setError(null)
    onStatusChange?.(newStatus)                  // optimistic update immediately
    const result = await window.api.updateStatus(num, newStatus)
    setSaving(false)
    if (!result.success) setError(result.error ?? 'Failed to save')
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={saving}
      className="h-7 px-2 bg-ctp-surface border border-ctp-overlay text-ctp-text text-body rounded ..."
    >
      {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  )
}
```

**Per-row activation** (`TrackerRow.tsx` pattern to add): click on status cell toggles between `<StatusBadge>` (read-only) and `<StatusSelect>` (active). State lives in `TrackerRow` or `TrackerPanel` (`editingRowNum: number | null`).

---

### `lib/mtime-cache.mjs` (utility, file-I/O)

**Analog:** `lib/statuses.mjs` (shared module export pattern, in-memory Map, YAML/JSON fallback)

**Module structure from `lib/statuses.mjs` lines 1–6, 24–25, 78–83:**
```javascript
// Imports
import { readFileSync } from 'fs'
import { join } from 'path'

// In-memory cache Map (module-level singleton)
const catalogCache = new Map()

// Named exports — no default export
export function getStatusCatalog(baseDir) { ... }
export function normalizeStatusId(raw, baseDir) { ... }
```

**`lib/mtime-cache.mjs` follows same pattern but with async `fs.promises`:**
```javascript
import { promises as fs, existsSync } from 'fs'
import { join } from 'path'

const SIDECAR = 'data/.mtime-cache.json'

// In-memory Map: { filePath -> { mtimeMs, content } }
const cache = new Map()
let sidecarPath = null

export async function initMtimeCache(projectRoot) {
  sidecarPath = join(projectRoot, SIDECAR)
  try {
    const raw = await fs.readFile(sidecarPath, 'utf-8')
    const json = JSON.parse(raw)
    for (const [p, mtimeMs] of Object.entries(json)) {
      cache.set(p, { mtimeMs, content: '' })
    }
  } catch { /* start fresh */ }
}

export async function readWithMtimeCache(filePath) {
  const stat = await fs.stat(filePath)
  const cached = cache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.content) {
    return cached.content
  }
  const content = await fs.readFile(filePath, 'utf-8')
  cache.set(filePath, { mtimeMs: stat.mtimeMs, content })
  return content
}

export async function persistMtimeCache() {
  const snapshot = {}
  for (const [p, entry] of cache) snapshot[p] = entry.mtimeMs
  // writeFileAtomic not available in Node mjs context without install — use fs.rename trick or import
  await fs.writeFile(sidecarPath + '.tmp', JSON.stringify(snapshot, null, 2))
  await fs.rename(sidecarPath + '.tmp', sidecarPath)
}
```

---

### `merge-tracker.mjs` (utility, CRUD — extend)

**Analog:** `merge-tracker.mjs` (self — lines 1–80, extend to add proper-lockfile)

**Current write pattern** (line 17 — uses sync `writeFileSync`):
```javascript
import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync } from 'fs'
```

**Add proper-lockfile wrapping** — extend around the existing read-modify-write:
```javascript
import lockfile from 'proper-lockfile'

// Replace the direct writeFileSync call with:
async function mergeWithLock(appsFile, additions) {
  const release = await lockfile.lock(appsFile, {
    stale: 10_000,
    retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
  })
  try {
    const content = readFileSync(appsFile, 'utf-8')
    const updated = applyAdditions(content, additions)   // existing merge logic
    writeFileSync(appsFile, updated, 'utf-8')
  } finally {
    await release()
  }
}
```

**Existing validation pattern to preserve** (lines 38–44):
```javascript
function validateStatus(status) {
  const normalized = normalizeStatusMeta(status, CAREER_OPS)
  if (normalized.recognized) return normalized.label
  console.warn(`⚠️  Non-canonical status "${status}" → defaulting to "Evaluated"`)
  return 'Evaluated'
}
```

---

## Shared Patterns

### IPC Push-Event Subscription (subscribe + unsubscribe)
**Source:** `electron/src/preload/index.ts` lines 10–16; `electron/src/renderer/App.tsx` lines 22–25
**Apply to:** `OpsDrawer.tsx`, `EvaluatePanel.tsx`, all new push-event consumers
```typescript
// Preload side (index.ts):
onSomeEvent: (callback: (payload: T) => void) => {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on('channel:name', listener)
  return () => ipcRenderer.removeListener('channel:name', listener)
},

// Renderer side (component useEffect):
useEffect(() => {
  const unsub = window.api.onSomeEvent((payload) => { /* handle */ })
  return unsub   // cleanup on unmount
}, [])
```

### win.isDestroyed() Guard
**Source:** `electron/src/main/watcher.ts` lines 29–31
**Apply to:** All `win.webContents.send(...)` calls in `evaluation-service.ts`, `process-runner.ts`
```typescript
if (!win.isDestroyed()) {
  win.webContents.send('channel', payload)
}
```

### Zod IPC Input Validation
**Source:** `electron/src/main/ipc-handlers.ts` lines 9, 21–22
**Apply to:** All new `ipcMain.handle` registrations in `ipc-handlers.ts`
```typescript
const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)
// ... inside handler:
const reportPath = ReportPathSchema.parse(rawPath)   // throws ZodError on invalid input
```

### Three-State Load Machine
**Source:** `electron/src/renderer/components/PipelinePanel.tsx` lines 12–14; `ReportViewer.tsx` lines 13–16
**Apply to:** `EvaluatePanel.tsx`, `CVPanel.tsx`, `SettingsSlideOver.tsx`
```typescript
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: T }
```

### Catppuccin Design Tokens
**Source:** All existing components — `bg-ctp-surface`, `border-ctp-overlay`, `text-ctp-text`, `text-ctp-subtext`, `text-ctp-blue`, `text-ctp-red`, `text-ctp-yellow`
**Apply to:** All new renderer components
- Interactive: `hover:bg-ctp-overlay`, `focus-visible:ring-2 focus-visible:ring-ctp-blue`
- Error: `text-ctp-red`, `bg-ctp-red/15`
- Warning: `text-ctp-yellow`, `bg-ctp-yellow/15`
- Success: `text-ctp-green`
- Mono text: `font-mono text-body`

### Cancellation Cleanup
**Source:** `electron/src/renderer/components/ReportViewer.tsx` lines 76–87
**Apply to:** `EvaluatePanel.tsx` streaming subscription, `CVPanel.tsx` readFile effect
```typescript
useEffect(() => {
  let cancelled = false
  // async op
  return () => { cancelled = true }
}, [dep])
```

### atomic fs write with `writeFileAtomic`
**Source:** RESEARCH.md Pattern 3, Pattern 5; `key-store.ts` code example
**Apply to:** `status-writer.ts`, `mtime-cache.ts`, `key-store.ts`
```typescript
import writeFileAtomic from 'write-file-atomic'
await writeFileAtomic(filePath, content)   // always prefer over fs.writeFile
```

---

## No Analog Found

All files have analogs. The following files are novel in data flow but have structural analogs for their scaffolding:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `electron/src/main/services/evaluation-service.ts` | service | streaming | No prior Anthropic SDK usage in codebase. Scaffold follows `ipc-handlers.ts` conventions; streaming implementation verbatim from RESEARCH.md Pattern 1. |
| `electron/src/main/services/key-store.ts` | service | request-response | No prior `safeStorage` usage. Pattern from RESEARCH.md Code Examples. |
| `electron/src/renderer/components/OpsDrawer.tsx` | component | event-driven | No prior drawer/terminal component. Nearest structural analog: `FileChangeBanner.tsx` for push-event subscription + conditional render. |

---

## Metadata

**Analog search scope:** `electron/src/`, `lib/`, `dashboard/internal/data/`, project root `.mjs` files
**Files scanned:** 20 source files read directly
**Key cross-references:**
- Go reference `dashboard/internal/data/career.go:544–596` — status replacement algorithm
- `lib/statuses.mjs` — module export pattern + in-memory Map caching
- `electron/src/main/watcher.ts` — `isWSL()`, `isDestroyed()` guard, push-event relay
- `electron/src/renderer/components/ReportViewer.tsx` — react-markdown pipeline (components map, plugins, error/empty states)
- `electron/src/preload/index.ts` — push-event subscription pattern (the `on{X}` pattern with cleanup)
**Pattern extraction date:** 2026-04-22
