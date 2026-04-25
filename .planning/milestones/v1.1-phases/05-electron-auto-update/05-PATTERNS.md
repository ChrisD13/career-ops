# Phase 5: Electron Auto-Update - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

---

## Path Correction Notice

The task brief references `electron/preload/index.ts` and `electron/preload/types.ts`. These paths do not exist. The actual paths are:

- `electron/src/preload/index.ts`
- `electron/src/preload/types.ts`

All pattern references below use the correct paths.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/main/services/updater.ts` | service | event-driven | `electron/src/main/services/preferences.ts` (dismiss file I/O) + `electron/src/main/services/evaluation-service.ts` (webContents.send push) | exact (composite) |
| `electron/src/main/ipc-handlers.ts` | handler | request-response | `electron/src/main/ipc-handlers.ts` itself — extend in place | exact |
| `electron/src/main/index.ts` | entrypoint | event-driven | `electron/src/main/index.ts` itself — `initScheduler` call at line 89 is the lifecycle wiring analog | exact |
| `electron/src/preload/index.ts` | preload bridge | request-response + event subscription | `electron/src/preload/index.ts` itself — `subscribe<T>` helper + api object extension | exact |
| `electron/src/preload/types.ts` | types | — | `electron/src/preload/types.ts` itself — interface extension pattern | exact |
| `electron/src/renderer/components/UpdateBanner.tsx` | component | event-driven | `electron/src/renderer/components/VcDropAlertBanner.tsx` (primary) + `electron/src/renderer/components/FileChangeBanner.tsx` (mounting) | exact |
| `electron/src/renderer/App.tsx` | component | — | `electron/src/renderer/App.tsx` itself — `<FileChangeBanner>` mount inside `<main>` at line 204 | exact |
| `electron/package.json` (dependencies) | config | — | `electron/package.json` itself — `dependencies` block pattern | exact |
| `electron/package.json` (build config) | config | — | `electron/package.json` `build` block lines 51-66 — extend in place | exact |

---

## Pattern Assignments

---

### `electron/src/main/services/updater.ts` (service, event-driven)

**Primary analog A — dismiss file I/O:** `electron/src/main/services/preferences.ts`

**Primary analog B — win.webContents.send push:** `electron/src/main/services/evaluation-service.ts`

---

**Imports pattern** — copy from `preferences.ts` lines 1-5 and `evaluation-service.ts` lines 1-5:

```typescript
// preferences.ts lines 1-5 (userData path + writeFileAtomic pattern)
import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

// evaluation-service.ts line 2 (BrowserWindow type import)
import type { BrowserWindow } from 'electron'

// updater.ts adds:
import { autoUpdater, UpdateInfo } from 'electron-updater'
// NOTE: MUST import from 'electron-updater' not 'electron' — built-in doesn't support Linux AppImage
```

---

**Dismiss file pattern** — direct transplant from `preferences.ts` lines 14-32:

```typescript
// preferences.ts lines 14-16 — userData path function (copy exactly)
function prefsPath(): string {
  return path.join(app.getPath('userData'), 'preferences.json')
}

// preferences.ts lines 18-33 — existsSync guard + try/catch JSON parse (copy structure)
async function load(): Promise<Prefs> {
  const p = prefsPath()
  if (!existsSync(p)) return { model: DEFAULT_MODEL, vcScrapeInterval: DEFAULT_VC_INTERVAL }
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const json = JSON.parse(raw)
    // ... validate and return
  } catch {
    return { model: DEFAULT_MODEL, vcScrapeInterval: DEFAULT_VC_INTERVAL }
  }
}

// preferences.ts lines 43-44 — writeFileAtomic call pattern
await writeFileAtomic(prefsPath(), JSON.stringify({ ...current, model }, null, 2))
```

For `updater.ts`, adapt to:

```typescript
function dismissFilePath(): string {
  return path.join(app.getPath('userData'), 'dismissed-update.json')
}

async function getDismissedVersion(): Promise<string | null> {
  const p = dismissFilePath()
  if (!existsSync(p)) return null
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch { return null }
}

export async function setDismissedVersion(version: string): Promise<void> {
  await writeFileAtomic(dismissFilePath(), JSON.stringify({ version }, null, 2))
}
```

---

**win.webContents.send push pattern** — copy from `evaluation-service.ts`:

```typescript
// evaluation-service.ts line 99 — isDestroyed guard before send (always use this)
if (!params.win.isDestroyed()) {
  params.win.webContents.send('evaluation:error', { message: ... })
}

// evaluation-service.ts lines 130-132 — push on stream event
stream.on('text', (delta: string) => {
  if (!params.win.isDestroyed()) {
    params.win.webContents.send('evaluation:token', delta)
  }
})

// evaluation-service.ts lines 141-148 — push on terminal event with payload
if (!params.win.isDestroyed()) {
  params.win.webContents.send('evaluation:done', {
    usage,
    stopReason: finalMessage.stop_reason ?? 'end_turn',
    costUsd: calculateCost(params.model, usage),
    model: params.model,
  })
}
```

For `updater.ts`, adapt to:

```typescript
autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
  const dismissed = await getDismissedVersion()
  if (dismissed === info.version) return
  const releaseNotes = typeof info.releaseNotes === 'string'
    ? info.releaseNotes.split('\n').slice(0, 3).join('\n')
    : null
  if (!win.isDestroyed()) {
    win.webContents.send('updater:status', {
      phase: 'downloaded',
      version: info.version,
      releaseNotes,
    })
  }
})
```

---

**Dev mode guard** — copy from `index.ts` lines 76-78 (existing pattern for isPackaged guard):

```typescript
// index.ts lines 76-78
if (!app.isPackaged) {
  await ensureRootDeps(projectRoot)
}
```

For `updater.ts`:

```typescript
export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    console.log('[updater] skipped — not packaged')
    return
  }
  // ... rest of init
}
```

---

**Error handling pattern** — silent error, log only (per CONTEXT). Copy `evaluation-service.ts` error structure (lines 150-162) but strip the user-facing IPC push:

```typescript
// evaluation-service.ts lines 150-162 — error handler shape with isDestroyed guard
} catch (err: any) {
  if (err?.name === 'APIUserAbortError') {
    if (!params.win.isDestroyed()) {
      params.win.webContents.send('evaluation:cancelled')
    }
  } else if (!params.win.isDestroyed()) {
    params.win.webContents.send('evaluation:error', { ... })
  }
}
```

For `updater.ts`, no IPC push on error — log only:

```typescript
autoUpdater.on('error', (err: Error) => {
  console.warn('[updater] error:', err.message)
  // No banner — fail silently per CONTEXT
})
```

---

### `electron/src/main/ipc-handlers.ts` (modify — add updater handlers)

**Analog:** `electron/src/main/ipc-handlers.ts` itself — extend `registerIpcHandlers()` function.

**Existing handler pattern** (lines 68-71 — zod validation + service call):

```typescript
// ipc-handlers.ts lines 68-71 — canonical handler pattern
ipcMain.handle('updateStatus', async (_e, raw: unknown) => {
  const { num, newStatus } = UpdateStatusSchema.parse(raw)
  return writeStatus(applicationsPath, num, newStatus, pendingGuiWrites)
})
```

**Existing schema definition pattern** (lines 21-41):

```typescript
// ipc-handlers.ts lines 21-27 — zod schema at module top
const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)
const UpdateStatusSchema = z.object({
  num: z.number().int().positive(),
  newStatus: z.string().min(1).max(50),
})
const UrlSchema = z.string().url()
```

**Add to `registerIpcHandlers()`** — after Phase 3 VC handlers (line 251+):

```typescript
// ipc-handlers.ts addition — add VersionSchema at module top with other schemas
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+/)

// Add inside registerIpcHandlers():
ipcMain.handle('updater:install', async () => {
  installUpdate()
})

ipcMain.handle('updater:dismiss', async (_e, raw: unknown) => {
  const version = VersionSchema.parse(raw)
  await setDismissedVersion(version)
})
```

**Import additions at top of file** (follow lines 1-20 pattern):

```typescript
import { installUpdate, setDismissedVersion } from './services/updater'
```

**OPEN QUESTION flagged in RESEARCH.md (Q4):** CONTEXT.md locks channels `updater:check`, `updater:status`, `updater:install`. Research proposes dropping `updater:check` (auto-fires on startup) and adding `updater:dismiss` (required for "Later" persist). Planner must surface this deviation for user confirmation before execution.

---

### `electron/src/main/index.ts` (modify — call initUpdater after window shown)

**Analog:** `electron/src/main/index.ts` itself — `initScheduler` lifecycle wiring at line 89.

**Scheduler init pattern** (lines 87-89):

```typescript
// index.ts lines 87-89 — service init after createWindow, before closed handler
registerIpcHandlers({ projectRoot, pendingGuiWrites, mtimeCache, win: mainWindow })
const stopWatcher = startFileWatcher(projectRoot, mainWindow, pendingGuiWrites)
await initScheduler(projectRoot, mainWindow)
```

**Critical constraint — idempotent-unsafe comment** (lines 100-102):

```typescript
// index.ts lines 100-102 — do NOT re-call inside app.on('activate')
// NOTE: registerIpcHandlers is idempotent-unsafe (would double-register); we do NOT
// re-call it. The new window reuses the handlers registered on the first ready.
```

`initUpdater` must follow the same pattern: called once after `registerIpcHandlers`, NOT inside `app.on('activate')`.

**Add after line 89** (`await initScheduler(...)`):

```typescript
// After initScheduler — 5-second delay so update check doesn't block startup UX
setTimeout(() => { initUpdater(mainWindow) }, 5000)
```

**Import addition** (follow lines 1-10 pattern):

```typescript
import { initUpdater } from './services/updater'
```

---

### `electron/src/preload/index.ts` (modify — expose updater IPC bridge)

**Analog:** `electron/src/preload/index.ts` itself.

**subscribe helper** (lines 8-12 — exact copy for `onUpdaterStatus`):

```typescript
// preload/index.ts lines 8-12 — generic typed subscription helper
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}
```

**api object extension pattern** (lines 14-65 — add after Phase 3 block):

```typescript
// preload/index.ts lines 57-64 — Phase 3 VC pattern: invoke + subscribe
runVcScrape: () => ipcRenderer.invoke('runVcScrape'),
readVcCompanies: () => ipcRenderer.invoke('readVcCompanies'),
// ...
```

**Add to `api` object** (after Phase 3 block, before `contextBridge.exposeInMainWorld`):

```typescript
// Phase 5 — auto-update
onUpdaterStatus: (cb) => subscribe<UpdaterStatus>('updater:status', cb),
updaterInstall: () => ipcRenderer.invoke('updater:install'),
updaterDismiss: (version: string) => ipcRenderer.invoke('updater:dismiss', version),
```

**Import addition** at top of file (follow existing type imports pattern, lines 2-6):

```typescript
import type {
  ElectronAPI, EvaluationDonePayload, EvaluationErrorPayload,
  OpOutputPayload, OpDonePayload,
  AddFirmPayload,
  UpdaterStatus,         // ADD
} from './types'
```

---

### `electron/src/preload/types.ts` (modify — add UpdaterStatus interface)

**Analog:** `electron/src/preload/types.ts` itself.

**Interface addition pattern** — follow `OpOutputPayload` style (lines 49-57):

```typescript
// types.ts lines 49-57 — discriminated union with string literal 'kind'
export interface OpOutputPayload {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | ...
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}
```

**Add before `ElectronAPI` interface** (line 136):

```typescript
// Phase 5 — auto-update
export interface UpdaterStatus {
  phase: 'downloading' | 'downloaded'
  version?: string
  releaseNotes?: string | null
}
```

**ElectronAPI extension** — add after Phase 3 block (lines 179-186):

```typescript
// types.ts lines 179-186 — Phase 3 pattern: typed return + typed payload param
runVcScrape: () => Promise<{ runId: string; error?: string }>
readVcCompanies: () => Promise<VcCompany[]>
// ...

// Phase 5 additions:
onUpdaterStatus: (cb: (status: UpdaterStatus) => void) => () => void
updaterInstall: () => Promise<void>
updaterDismiss: (version: string) => Promise<void>
```

---

### `electron/src/renderer/components/UpdateBanner.tsx` (new — UI component)

**Primary analog:** `electron/src/renderer/components/VcDropAlertBanner.tsx`

**Secondary analog (mounting reference):** `electron/src/renderer/components/FileChangeBanner.tsx`

**Dismiss state pattern** (VcDropAlertBanner lines 20-22):

```typescript
// VcDropAlertBanner.tsx lines 20-22 — local dismissed state + conditional render
const [dismissed, setDismissed] = useState(false)
const worst = worstDrop(firms)
if (dismissed || !worst) return null
```

**Banner DOM structure** (VcDropAlertBanner lines 29-49 — copy className conventions):

```typescript
// VcDropAlertBanner.tsx lines 29-49
<div
  role="status"
  aria-live="polite"
  className={`flex items-center justify-between h-10 w-full px-3 ${colorClasses}`}
  data-testid="vc-drop-alert-banner"
  data-severity={severe ? 'severe' : 'warning'}
>
  <div className="flex items-center gap-2 text-body">
    <AlertTriangle size={14} aria-hidden="true" />
    <span>{worst.firm}: company count dropped ...</span>
  </div>
  <button
    type="button"
    onClick={() => setDismissed(true)}
    aria-label="Dismiss alert"
    className="rounded hover:bg-ctp-overlay/40 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
  >
    <X size={14} aria-hidden="true" />
  </button>
</div>
```

**For UpdateBanner — pattern combining VcDropAlertBanner dismiss structure + two-button layout:**

```typescript
import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../../preload/types'

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)

  useEffect(() => {
    // subscribe pattern from preload/index.ts lines 8-12 — returns unsubscribe fn
    return window.api.onUpdaterStatus(setStatus)
  }, [])

  // Only show after download is complete (Pitfall 3: gate on 'downloaded' not 'available')
  if (!status || status.phase !== 'downloaded') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between h-10 w-full px-3 bg-ctp-green/15 text-ctp-green"
      data-testid="update-banner"
    >
      <span className="text-body">Update available: v{status.version}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void window.api.updaterInstall()}
          className="..."
        >
          Install Now
        </button>
        <button
          type="button"
          onClick={() => {
            void window.api.updaterDismiss(status.version!)
            setStatus(null)
          }}
          aria-label="Dismiss update"
          className="rounded hover:bg-ctp-overlay/40 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
        >
          Later
        </button>
      </div>
    </div>
  )
}
```

**Color palette note:** Use `bg-ctp-green/15 text-ctp-green` for positive update (matches ctp palette used across all banners). VcDropAlertBanner uses `red` and `yellow` for warnings; FileChangeBanner uses `yellow`. Green distinguishes update-available as a positive signal.

---

### `electron/src/renderer/App.tsx` (modify — mount UpdateBanner)

**Analog:** `electron/src/renderer/App.tsx` itself — `<FileChangeBanner>` mount at line 204.

**Existing banner mount** (lines 203-206):

```typescript
// App.tsx lines 203-206 — banner sits inside <main>, ABOVE content, BEFORE flex-1 div
<main className="flex-1 flex flex-col min-w-0">
  <FileChangeBanner visible={filesChanged} onRefresh={handleRefresh} />
  <div className="flex-1 min-h-0 overflow-hidden">
```

**Add `<UpdateBanner>` immediately after `<FileChangeBanner>` — no props needed:**

```tsx
<main className="flex-1 flex flex-col min-w-0">
  <FileChangeBanner visible={filesChanged} onRefresh={handleRefresh} />
  <UpdateBanner />
  <div className="flex-1 min-h-0 overflow-hidden">
```

**Import addition** (follow lines 1-16 pattern):

```typescript
import { UpdateBanner } from './components/UpdateBanner'
```

No new state in App.tsx — UpdateBanner manages its own state via IPC subscription internally (same pattern as VcDropAlertBanner which manages its own dismissed state).

---

### `electron/package.json` (modify — add electron-updater dependency)

**Analog:** `electron/package.json` lines 14-30 (`dependencies` block).

**Existing runtime dependency pattern** (lines 14-30):

```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.90.0",
  ...
  "write-file-atomic": "^7.0.1",
  "zod": "^3.25.76"
}
```

**Add `electron-updater` to `dependencies` (not devDependencies) — runs at runtime inside packaged app:**

```json
"electron-updater": "^6.8.3"
```

---

### `electron/package.json` build config (modify — add GitHub publish config)

**Analog:** `electron/package.json` `build` block lines 51-66 — extend in place.

**Existing build config** (lines 51-66):

```json
"build": {
  "appId": "io.jobengine.desktop",
  "productName": "JobEngine",
  "directories": { "output": "dist" },
  "linux": { "target": ["AppImage"], "category": "Utility" },
  "files": ["out/**/*"]
}
```

**OPEN QUESTION flagged in RESEARCH.md (Q3):** CONTEXT.md locks `electron-builder.yml` as the config file. The existing config lives in `package.json#build`. Creating both causes merge conflicts with unpredictable precedence. Research recommendation is to extend `package.json#build` in place (minimal-change, no conflict). **Planner must surface this deviation for user confirmation before execution.**

**If user confirms extend-in-place, add `publish` key:**

```json
"build": {
  "appId": "io.jobengine.desktop",
  "productName": "JobEngine",
  "publish": [
    {
      "provider": "github",
      "owner": "YOUR_GITHUB_ORG",
      "repo": "YOUR_REPO_NAME",
      "releaseType": "release"
    }
  ],
  "directories": { "output": "dist" },
  "linux": { "target": ["AppImage"], "category": "Utility" },
  "files": ["out/**/*"]
}
```

**Critical:** `releaseType` must be `"release"` — default `"draft"` makes releases invisible to unauthenticated runtime update checks.

**Placeholder note:** `YOUR_GITHUB_ORG` and `YOUR_REPO_NAME` must be replaced with actual values before first `npm run dist` publish.

---

## Shared Patterns

### win.webContents.send push (main → renderer)
**Source:** `electron/src/main/services/evaluation-service.ts` lines 98-103, 130-134, 141-148
**Apply to:** `updater.ts` for all `autoUpdater` event handlers that push to renderer

```typescript
// Always guard with isDestroyed() before send
if (!win.isDestroyed()) {
  win.webContents.send('channel:name', payload)
}
```

### subscribe<T> IPC subscription (renderer ← main push)
**Source:** `electron/src/preload/index.ts` lines 8-12
**Apply to:** `onUpdaterStatus` in preload/index.ts — reuse the existing helper, do not create a new one

```typescript
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}
```

### userData file I/O with writeFileAtomic
**Source:** `electron/src/main/services/preferences.ts` lines 1-5, 14-33, 43-44
**Apply to:** `updater.ts` dismiss file read/write — transplant structure exactly, change filename and schema

### zod input validation in IPC handlers
**Source:** `electron/src/main/ipc-handlers.ts` lines 21-41 (schema defs) + lines 68-71 (parse in handler)
**Apply to:** `updater:dismiss` handler — `VersionSchema.parse(raw)` before writing to disk

### Banner component structure
**Source:** `electron/src/renderer/components/VcDropAlertBanner.tsx` lines 19-49
**Apply to:** `UpdateBanner.tsx` — `role="status"`, `aria-live="polite"`, `h-10 w-full px-3`, ctp color palette, dismiss button with `focus-visible:ring-2 focus-visible:ring-ctp-blue`

### isPackaged dev guard
**Source:** `electron/src/main/index.ts` lines 76-78
**Apply to:** `initUpdater()` — wrap entire function body: `if (!app.isPackaged) { ...; return }`

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Open Questions for Planner (must surface to user before execution)

| # | Question | Conflict | Recommendation |
|---|----------|----------|----------------|
| Q3 | Build config file: `electron-builder.yml` (CONTEXT) vs `package.json#build` (existing) | CONTEXT locks YAML; repo has JSON | Extend `package.json#build` — zero merge risk. If YAML preferred, all existing build config must migrate. **Needs user confirmation.** |
| Q4 | IPC channel set: CONTEXT locks `updater:check`/`status`/`install`; research proposes `updater:status`/`install`/`dismiss` (drop check, add dismiss) | CONTEXT locks channels explicitly | Research set is functionally correct; `updater:check` is unnecessary (auto-fires); `updater:dismiss` is required. **Needs user confirmation.** |

---

## Metadata

**Analog search scope:** `electron/src/main/`, `electron/src/preload/`, `electron/src/renderer/`
**Files scanned:** 12 (all key source files read directly)
**Pattern extraction date:** 2026-04-24
