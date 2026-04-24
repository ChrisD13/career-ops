# Phase 5: Electron Auto-Update — Research

**Researched:** 2026-04-23
**Domain:** Electron, electron-updater, electron-builder, GitHub Releases, React IPC patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Update Mechanism:**
- Use `electron-updater` (full ASAR update) — enables true one-click install per UPD-03
- Trigger check 5 seconds after `mainWindow` is shown (non-blocking startup)
- Check once per launch only — no background polling
- `electron-builder.yml`: `provider: github` with `owner/repo` — public releases, no token needed for checking

**UI Presentation:**
- Banner component matching existing `ApiKeyBanner` / `FileChangeBanner` pattern — top of renderer, above nav, non-blocking
- Show: version number + first 3 lines of release notes + "Install Now" + "Later" buttons
- IPC channels: `updater:check`, `updater:status`, `updater:install` — matches existing `ipcMain.handle` pattern

**Dismiss & Install Behavior:**
- "Later" stores dismissed version (e.g., in `app.getPath('userData')/dismissed-update.json`) — never re-prompts for same version; re-prompts automatically for a newer version
- "Install Now" calls `autoUpdater.quitAndInstall()` — electron-updater handles download + install on quit
- Dev mode guard: skip check entirely when `!app.isPackaged`
- Network errors: fail silently — log to console, no error banner shown to user

### Claude's Discretion

None — discussion stayed within phase scope.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPD-01 | App checks GitHub Releases for a newer version on startup (background, non-blocking) | `autoUpdater.checkForUpdates()` called via `setTimeout(5000)` after window shown; `!app.isPackaged` guard prevents check in dev |
| UPD-02 | User sees an in-app banner/dialog showing version and release notes when update is available | `update-available` + `update-downloaded` events pushed via `win.webContents.send('updater:status', payload)` to renderer; `UpdateBanner` component renders from `UpdaterStatus` state |
| UPD-03 | User can trigger download + install with one click, or dismiss and be reminded on next launch | "Install Now" → `ipcMain.handle('updater:install')` → `autoUpdater.quitAndInstall()`; "Later" → persists dismissed version to `userData/dismissed-update.json` |
</phase_requirements>

---

## Summary

Phase 5 wires `electron-updater` (the standard electron-builder companion library) to GitHub Releases so the app can self-update with one click. The integration has three distinct layers: the main-process updater service (`services/updater.ts`) that configures and drives `autoUpdater`; an IPC bridge exposing three channels to the renderer; and a `UpdateBanner` React component that mirrors the existing `FileChangeBanner`/`ApiKeyBanner` pattern.

The core flow is: on startup (after 5s delay, packaged builds only) → `autoUpdater.checkForUpdates()` → if update found, download begins automatically → push `updater:status` events to renderer → banner appears → user clicks "Install Now" → `quitAndInstall()`. The "Later" path persists the dismissed version to a JSON file in `userData` so the same version never re-prompts.

Several non-obvious constraints govern the implementation: the build config lives in `package.json#build` (not a separate YAML), `releaseType` must be `release` (not the default `draft`) for public runtime checks to find releases, and the "Install Now" button must be gated on `update-downloaded` (not just `update-available`) to avoid a no-op when the download is still in progress.

**Primary recommendation:** Add `electron-updater` as a runtime dependency; extend `package.json#build` with `publish.github`; wire updater events in a new `services/updater.ts` using `win.webContents.send` push pattern; gate "Install Now" on `update-downloaded` event.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Update check & download | Main process | — | Network requests, file writes — must stay in main; renderer has no Node.js access |
| Event → renderer push | Main process (IPC) | Renderer (subscription) | `win.webContents.send` is the established push pattern in this codebase |
| Install trigger (quitAndInstall) | Main process | — | OS-level restart — renderer can only request via `ipcMain.handle` |
| Dismiss state persistence | Main process | — | File I/O in `userData` — same pattern as `preferences.ts` |
| Banner UI | Renderer | — | React component, matches existing `FileChangeBanner` pattern |
| Preload bridge | Preload | — | Type-safe IPC bridge, same pattern as all existing channels |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-updater | **6.8.3** | Full ASAR auto-update via GitHub Releases | Companion to electron-builder; same maintainer; handles YAML metadata, delta downloads, signature verification |
| electron-builder | 26.8.1 (installed) | Build + publish config; generates `app-update.yml` and `latest-linux.yml` | Already present in devDependencies |

[VERIFIED: npm registry] — `npm view electron-updater version` returned `6.8.3`. `electron-builder` `26.8.1` already in `devDependencies`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-log | optional | Structured logging for updater events | Useful if project needs file-based log; not required — project uses `console.log` which is sufficient |
| write-file-atomic | 7.x (installed) | Safe JSON write for dismissed-update.json | Already in `dependencies`; same pattern as `preferences.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-updater | update-electron-app | `update-electron-app` requires update.electronjs.org server; no custom GitHub provider — not suitable |
| electron-updater | Built-in Electron autoUpdater | Built-in requires Squirrel on macOS/Windows; no Linux AppImage support — not suitable |
| write-file-atomic | fs.writeFile | Risk of partial write on crash — not acceptable for preferences |

**Installation:**
```bash
cd electron && npm install electron-updater
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Startup: app.whenReady()]
       |
       +-- setTimeout(5000) ──────────────────────────────────────────────────+
                                                                              |
                                                                    [updater.ts: initUpdater(win)]
                                                                              |
                                                                    guard: !app.isPackaged → skip
                                                                              |
                                                                    autoUpdater.checkForUpdates()
                                                                              |
                             +────────────────────────────────────────────────+
                             |                    |                           |
                    update-not-available      error event              update-available
                         (ignore)          log, no banner                     |
                                                                    [download begins: autoDownload=true]
                                                                              |
                                                                    update-downloaded
                                                                              |
                                                            win.webContents.send('updater:status', {
                                                              phase: 'downloaded',
                                                              version, releaseNotes
                                                            })
                                                                              |
                                                                     [Renderer: UpdateBanner]
                                                                    "v1.0.1 available" banner
                                                                              |
                                          +────────────────────────────────────+
                                          |                                    |
                                     "Install Now"                         "Later"
                                          |                                    |
                              ipcRenderer.invoke('updater:install')   ipcRenderer.invoke('updater:dismiss', version)
                                          |                                    |
                              ipcMain → autoUpdater.quitAndInstall()  write dismissed-update.json
```

### Recommended Project Structure (new files only)

```
electron/src/
├── main/
│   └── services/
│       └── updater.ts          # new — autoUpdater config, event wiring, dismiss store
├── preload/
│   ├── index.ts                # extend — add updater namespace
│   └── types.ts                # extend — add UpdaterStatus interface
└── renderer/
    └── components/
        └── UpdateBanner.tsx    # new — mirrors FileChangeBanner style
```

App.tsx mounts `<UpdateBanner />` above `<FileChangeBanner />` inside `<main>`.

### Pattern 1: Main-process Updater Service

**What:** `services/updater.ts` configures `autoUpdater`, wires events to IPC push, and manages the dismissed-version store.

**When to use:** Called once from `index.ts` via `setTimeout(() => initUpdater(mainWindow), 5000)` after `mainWindow.show()`.

**Example:**
```typescript
// Source: Context7 /electron-userland/electron-builder + project preference.ts pattern
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

const DISMISS_FILE = () => path.join(app.getPath('userData'), 'dismissed-update.json')

async function getDismissedVersion(): Promise<string | null> {
  try {
    const raw = await fs.readFile(DISMISS_FILE(), 'utf-8')
    return JSON.parse(raw).version ?? null
  } catch { return null }
}

async function setDismissedVersion(version: string): Promise<void> {
  await writeFileAtomic(DISMISS_FILE(), JSON.stringify({ version }))
}

export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return  // dev mode guard

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false  // see note below — "Later" semantics

  autoUpdater.on('update-available', (_info: UpdateInfo) => {
    // Download started automatically; send 'checking' status
    win.webContents.send('updater:status', { phase: 'downloading' })
  })

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    const dismissed = await getDismissedVersion()
    if (dismissed === info.version) return  // already dismissed this version
    const notes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes.split('\n').slice(0, 3).join('\n')
      : null
    win.webContents.send('updater:status', {
      phase: 'downloaded',
      version: info.version,
      releaseNotes: notes,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    console.warn('[updater] error (silent):', err.message)
    // No banner — fail silently per CONTEXT
  })

  void autoUpdater.checkForUpdates()
}

// Called from ipc-handlers.ts
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}

export { setDismissedVersion }
```

### Pattern 2: IPC Handler Registration

**What:** Add three channels to `ipc-handlers.ts`. Updater channels use `ipcMain.handle` (request-response) for `install` and `dismiss`; the `status` push uses `win.webContents.send` (fire-and-forget from main).

**When to use:** Add to `registerIpcHandlers` alongside existing handlers — same file, same pattern.

```typescript
// Source: existing ipc-handlers.ts pattern (project-verified)
import { initUpdater, installUpdate, setDismissedVersion } from './services/updater'

// Inside registerIpcHandlers():
ipcMain.handle('updater:install', async () => {
  installUpdate()
})

ipcMain.handle('updater:dismiss', async (_e, raw: unknown) => {
  const version = z.string().parse(raw)
  await setDismissedVersion(version)
})

// initUpdater(win) called from index.ts via setTimeout
```

**Note:** `updater:status` is a push channel (main → renderer), not a handle. The renderer subscribes via `ipcRenderer.on('updater:status', ...)` exposed through the preload bridge.

### Pattern 3: Preload Bridge Extension

```typescript
// Source: existing preload/index.ts pattern (project-verified)
// Add to preload/types.ts:
export interface UpdaterStatus {
  phase: 'downloading' | 'downloaded'
  version?: string
  releaseNotes?: string | null
}

// Add to ElectronAPI interface:
onUpdaterStatus: (cb: (status: UpdaterStatus) => void) => () => void
updaterInstall: () => Promise<void>
updaterDismiss: (version: string) => Promise<void>

// Add to preload/index.ts api object:
onUpdaterStatus: (cb) => subscribe<UpdaterStatus>('updater:status', cb),
updaterInstall: () => ipcRenderer.invoke('updater:install'),
updaterDismiss: (version) => ipcRenderer.invoke('updater:dismiss', version),
```

### Pattern 4: UpdateBanner Component

```typescript
// Source: FileChangeBanner.tsx pattern (project-verified)
import { useEffect, useState } from 'react'
import type { UpdaterStatus } from '../../preload/types'

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)

  useEffect(() => {
    return window.api.onUpdaterStatus(setStatus)
  }, [])

  if (!status || status.phase !== 'downloaded') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-4 h-10 px-4 w-full bg-ctp-green/15 text-ctp-green text-body"
    >
      <span>Update available: v{status.version}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.api.updaterInstall()}
          className="..."
        >
          Install Now
        </button>
        <button
          type="button"
          onClick={() => { void window.api.updaterDismiss(status.version!); setStatus(null) }}
          className="..."
        >
          Later
        </button>
      </div>
    </div>
  )
}
```

### Pattern 5: electron-builder publish config (package.json extension)

```json
// Source: Context7 /electron-userland/electron-builder + official publish docs
// Extend existing electron/package.json#build:
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

**Critical:** `releaseType` must be `"release"`, not the default `"draft"`. Draft releases are invisible to the unauthenticated runtime update check on public repos.

**Build config location (CONTEXT DEVIATION — see Open Question #3):** CONTEXT.md specifies `electron-builder.yml` as the config file. However, the repo already has build config in `electron/package.json#build`. Creating a separate `electron-builder.yml` alongside an existing `package.json#build` will conflict — electron-builder merges both, with unpredictable precedence. Research recommendation: extend `package.json#build` in place. This is a deviation from the locked decision; the planner must surface it for user confirmation.

### Anti-Patterns to Avoid

- **Importing `autoUpdater` from `electron` instead of `electron-updater`:** Electron's built-in `autoUpdater` doesn't support Linux AppImage and has a different API. Always: `import { autoUpdater } from 'electron-updater'`
- **Calling `quitAndInstall()` before `update-downloaded` fires:** Results in a no-op. Gate the "Install Now" button on `phase === 'downloaded'` in the banner state.
- **Setting `releaseType: draft` (or omitting it):** Draft releases are private — the unauthenticated GitHub API check finds nothing. Always set `releaseType: release`.
- **Re-registering IPC handlers across windows:** `ipc-handlers.ts` has a comment warning against this (`registerIpcHandlers is idempotent-unsafe`). The updater is single-window and initialized once — do not add re-register logic.
- **Showing download progress:** CONTEXT specifies only two states matter to the user — "available and downloaded" (show banner) and "error" (fail silently). Don't add download-progress polling UI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fetching `latest-linux.yml` from GitHub | Custom HTTP fetch + version parse | `electron-updater` | Version comparison, SHA512 verification, delta download all built in |
| Spawning external installer / untar | Shell commands to replace binary | `autoUpdater.quitAndInstall()` | electron-updater atomically replaces the AppImage, handles process restart |
| Polling for updates | `setInterval` | Single `checkForUpdates()` call on startup | Rate limit: 3 requests per check; 5000/hour GitHub API limit |
| Custom update metadata format | JSON endpoint | `latest-linux.yml` (generated by electron-builder) | electron-updater only reads its own YAML format |

**Key insight:** electron-updater's value is not just the HTTP request — it's atomic file replacement, checksum verification, and platform-specific install logic. All three are non-trivial to replicate safely.

---

## Common Pitfalls

### Pitfall 1: AppImage `APPIMAGE` Env Var Missing
**What goes wrong:** On Linux, `autoUpdater.checkForUpdates()` either throws silently or returns without doing anything. No update is ever found or downloaded.
**Why it happens:** electron-updater requires `process.env.APPIMAGE` to know the path of the current AppImage to replace. This env var is set automatically only when the app is launched as a real installed `.AppImage` file. It is NOT set when running the unpacked `--dir` build or the extracted binary from `npm run pack`.
**How to avoid:** Always test update behavior by installing the full `.AppImage` artifact (from `npm run dist`), not by running the directory output. In CI, set `APPIMAGE` manually only for integration tests — never in production code.
**Warning signs:** Updater `error` event fires with "Cannot find AppImage file" or "APPIMAGE is not defined"; or the check completes silently with no event at all.

### Pitfall 2: Draft Releases Are Invisible at Runtime
**What goes wrong:** `checkForUpdates()` returns `null` — "no update available" — even when a release exists on GitHub.
**Why it happens:** electron-builder's default `releaseType` is `"draft"`. Draft releases are not accessible via the GitHub unauthenticated releases API that electron-updater uses for public repos.
**How to avoid:** Set `"releaseType": "release"` in the `publish` config. After publishing, verify the release is public (not draft) in the GitHub UI.
**Warning signs:** `update-not-available` fires immediately with no error; GitHub releases page shows a "Draft" badge on the release.

### Pitfall 3: "Install Now" Before `update-downloaded`
**What goes wrong:** User clicks "Install Now" but nothing happens — the app doesn't restart.
**Why it happens:** `quitAndInstall()` is only valid after `update-downloaded` fires. If `update-available` fires and the UI immediately enables "Install Now", the download may still be in progress.
**How to avoid:** The banner should only render (and "Install Now" should only be enabled) after `phase === 'downloaded'` is received. The `update-available` event should not surface a user-facing button — it can optionally show a silent download indicator if desired.
**Warning signs:** Clicking "Install Now" has no effect; no `before-quit` event fires.

### Pitfall 4: Double Import (electron vs electron-updater)
**What goes wrong:** TypeScript compiles fine but Linux AppImage update never works; or macOS throws "Cannot update a Squirrel-based app" error.
**Why it happens:** `import { autoUpdater } from 'electron'` imports Electron's built-in, which uses Squirrel (not supported on Linux AppImage). `import { autoUpdater } from 'electron-updater'` imports the correct module.
**How to avoid:** Always import from `'electron-updater'`. Add a linting rule or comment at the top of `updater.ts`.
**Warning signs:** `autoUpdater` has no `forceDevUpdateConfig` property; TypeScript types differ from expected.

### Pitfall 5: `autoInstallOnAppQuit` Semantics with "Later"
**What goes wrong:** User clicks "Later" expecting the update to be deferred until they explicitly click "Install Now" next time. Instead, on the very next normal quit, the app installs the update without warning.
**Why it happens:** `autoInstallOnAppQuit: true` (the default) causes electron-updater to install any downloaded update on every `app.quit()` call — including quits caused by the user closing the window normally.
**How to avoid:** Set `autoUpdater.autoInstallOnAppQuit = false`. With this setting, "Install Now" is the only install path. The dismissed version stored in `dismissed-update.json` controls re-prompting, not the OS quit. **Recommendation for this project:** set `false` — CONTEXT's "never re-prompts for same version" language implies the user has deliberate control.
**Warning signs:** Update installs unexpectedly after user clicks the close button; user never sees the banner on subsequent launches because the update installed silently.

### Pitfall 6: First-Release Bootstrapping Gap
**What goes wrong:** After implementing all the code, `checkForUpdates()` fires but nothing happens — `update-not-available` every time.
**Why it happens:** There is no prior GitHub release to check against. electron-updater compares `app.getVersion()` (currently `0.1.0`) against the `version` field in `latest-linux.yml` on GitHub. If no release exists, or if the only release matches the current version, there is nothing to update to.
**How to avoid:** To verify update flow end-to-end: (1) publish `v0.1.0` as a real Release with `latest-linux.yml`; (2) bump `package.json` version to `0.1.1`; (3) build and install the `v0.1.0` AppImage; (4) launch it — update check should find `v0.1.1`.
**Warning signs:** `update-not-available` always fires during testing; banner never appears.

### Pitfall 7: CSP Blocks Updater (Non-Issue — Document to Prevent Confusion)
**What goes wrong:** Developer worries that `connect-src 'self'` in the CSP (set in `index.ts:installCspHeader()`) will block GitHub API calls.
**Why it happens:** Misunderstanding of CSP scope.
**How to avoid:** CSP applies to the renderer process only (browser context). electron-updater runs in the main process, which uses Node.js networking and is completely unaffected by renderer CSP. No CSP changes needed.

---

## Code Examples

### Full updater.ts Service
```typescript
// Source: Context7 /electron-userland/electron-builder + verified against electron-updater 6.8.3 API
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, type BrowserWindow } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

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

export function installUpdate(): void {
  // isSilent=false, isForceRunAfter=true: show update dialog on macOS, relaunch after install
  autoUpdater.quitAndInstall(false, true)
}

export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) {
    console.log('[updater] skipped — not packaged')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false  // "Later" does NOT install on quit

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] up to date')
  })

  autoUpdater.on('update-available', (_info: UpdateInfo) => {
    console.log('[updater] update available, downloading...')
    // Do NOT show UI yet — wait for update-downloaded
  })

  autoUpdater.on('update-downloaded', async (info: UpdateInfo) => {
    const dismissed = await getDismissedVersion()
    if (dismissed === info.version) {
      console.log('[updater] version', info.version, 'was dismissed — skipping banner')
      return
    }

    // releaseNotes is string | ReleaseNoteInfo[] | null when fullChangelog=false (default)
    const releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes.split('\n').slice(0, 3).join('\n')
      : null

    win.webContents.send('updater:status', {
      phase: 'downloaded',
      version: info.version,
      releaseNotes,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    // Fail silently — log only, no user-facing banner
    console.warn('[updater] error:', err.message)
  })

  void autoUpdater.checkForUpdates()
}
```

### index.ts Integration Point
```typescript
// Source: existing index.ts pattern (project-verified)
// Add after mainWindow is created and shown:
import { initUpdater } from './services/updater'
import { installUpdate, setDismissedVersion } from './services/updater'

// In app.whenReady():
mainWindow.once('ready-to-show', () => {
  mainWindow.show()
  // Existing code continues...
})

// After registerIpcHandlers():
setTimeout(() => initUpdater(mainWindow), 5000)
```

### ipc-handlers.ts Additions
```typescript
// Source: existing ipcMain.handle pattern (project-verified)
import { installUpdate, setDismissedVersion } from './services/updater'
import { z } from 'zod'

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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Squirrel (built-in Electron autoUpdater) | electron-updater | 2016 | Cross-platform (including Linux AppImage); no Squirrel server required |
| Separate electron-updater import | Same | — | Still the standard; no change |
| `checkForUpdatesAndNotify()` | `checkForUpdates()` + manual event handling | Always supported | `checkForUpdatesAndNotify()` emits OS notifications (not suitable for in-app banner) |

**Deprecated/outdated:**
- `autoUpdater.setFeedURL()` pattern: Still works but not needed when publish config is in `package.json#build` — electron-builder embeds `app-update.yml` automatically at build time.
- `electron-is-dev` package: Use `app.isPackaged` instead (built into Electron, no extra dep).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The GitHub repo for JobEngine is public — no `GH_TOKEN` needed at runtime for update checks | Standard Stack | If private, users need `GH_TOKEN` set at runtime; update check fails silently without it |
| A2 | `owner` and `repo` values for the publish config are known at plan/build time | Standard Stack / Code Examples | If not yet determined, the publish config will have placeholder values and CI release step cannot run |
| A3 | Linux (AppImage) is the only target platform for this release | Architecture | If macOS or Windows targets are added, code signing requirements apply (macOS: required; Windows: recommended) |
| A4 | Extending `package.json#build` (not creating `electron-builder.yml`) is the correct approach | Pattern 5 | If user wanted a separate YAML, all existing build config must move there and be removed from package.json — see Open Question #3 |

---

## Open Questions

1. **`owner` and `repo` values for publish config**
   - What we know: Config requires `provider: github` + `owner` + `repo`
   - What's unclear: The actual GitHub org/username and repository name for the project
   - Recommendation: Planner should insert `YOUR_GITHUB_ORG` / `YOUR_REPO` as placeholders; user fills in before first publish

2. **`autoInstallOnAppQuit` recommendation confirmed**
   - What we know: Research recommends `false` (user has deliberate control); CONTEXT says "Later" = dismiss banner, "Install Now" = only path to install
   - What's unclear: CONTEXT doesn't explicitly state `autoInstallOnAppQuit` preference
   - Recommendation: Set `false` — aligns with CONTEXT's deliberate-control framing. If user wants quit-time auto-install, it's a one-line config change.

3. **CONTEXT specifies `electron-builder.yml`; repo already has `package.json#build` — which wins?**
   - What we know: CONTEXT.md locks `electron-builder.yml: provider: github with owner/repo`. The existing `electron/package.json#build` already contains `appId`, `linux.target`, `files`, and `directories`. electron-builder merges both files if both exist, with unpredictable precedence.
   - What's unclear: Whether the user intended to migrate all build config to `electron-builder.yml` (and remove from `package.json`) or to extend the existing `package.json#build`.
   - Recommendation: Extend `package.json#build` only (no new YAML file) — this is the minimal-change path with no merge risk. If user wants `electron-builder.yml`, all existing `build` config must move there and be removed from `package.json`. **User must confirm which approach before plan execution.**

4. **IPC channel set differs from CONTEXT — confirm deviation**
   - What we know: CONTEXT locks channels `updater:check`, `updater:status`, `updater:install`. Research proposes `updater:status` (push), `updater:install` (handle), and `updater:dismiss` (handle, new) — dropping `updater:check` and adding `updater:dismiss`.
   - Rationale for deviation: `updater:check` is unnecessary — the check fires automatically on startup via `setTimeout`. `updater:dismiss` is required for the "Later" behavior that persists the dismissed version; without it, the dismissed version cannot be stored from the renderer.
   - Recommendation: Adopt the research channel set (`updater:status`, `updater:install`, `updater:dismiss`). If the user wants a manual re-check trigger in future, `updater:check` can be added without breaking changes. **Planner should note the deviation from CONTEXT in the plan.**

---

## Verification Preconditions

> These are prerequisites the planner must include as tasks, not just pitfalls to avoid.

1. **Publish a real GitHub Release before end-to-end verification.** The app currently has no GitHub Release at any version. To verify the update check works: publish `v0.1.0` as a public GitHub Release (not draft) with `latest-linux.yml` included. Then bump `version` to `v0.1.1` in `electron/package.json` and build. Install the `v0.1.0` AppImage; launch it; verify the banner appears.

2. **`GH_TOKEN` required at build/publish time, not at runtime.** To publish the AppImage and `latest-linux.yml` to GitHub Releases, set `GH_TOKEN` in the CI environment (or locally during the first manual release). The token is not needed at runtime for update checks on public repos.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build scripts | ✓ | (project in active use) | — |
| electron-builder | Packaging + publish config | ✓ | 26.8.1 (in devDeps) | — |
| electron-updater | Runtime update check | ✗ (not yet installed) | 6.8.3 available | — |
| GitHub repo + release | Runtime update source | [ASSUMED] ✓ | — | No fallback — required for UPD-01 |

**Missing dependencies with no fallback:**
- `electron-updater` must be installed (`npm install electron-updater` in `electron/`). It must be in `dependencies` (not `devDependencies`) — it runs at runtime inside the packaged app.

**Missing dependencies with fallback:**
- None.

---

## Security Domain

> Phase adds outbound network request from main process to `api.github.com`. No new user-controlled inputs enter the system.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minor) | `VersionSchema` (zod) validates version string from renderer before writing to disk |
| V6 Cryptography | no | electron-updater handles SHA512 verification of downloaded artifacts internally |

### Known Threat Patterns for Electron Auto-Update

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious update server (MITM on update check) | Tampering | HTTPS enforced by electron-updater GitHub provider; SHA512 checksum verified before install |
| Renderer-side install trigger injection | Elevation of privilege | `ipcMain.handle('updater:install')` has no payload — renderer cannot pass arbitrary install paths |
| Version string injection via dismiss IPC | Tampering | `VersionSchema` (zod semver regex) validates version before writing `dismissed-update.json` |
| Arbitrary file write via dismissed-update.json | Tampering | Path is hardcoded to `app.getPath('userData')/dismissed-update.json` — not user-controlled |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/electron-userland/electron-builder` — autoUpdater events, UpdateInfo type, publish config fields, code signing config
- `electron/package.json` — verified installed versions, existing build config structure
- `electron/src/main/services/preferences.ts` — userData path pattern, writeFileAtomic usage
- `electron/src/main/ipc-handlers.ts` — ipcMain.handle pattern, zod validation style
- `electron/src/preload/index.ts` + `types.ts` — preload bridge subscription pattern, ElectronAPI extension points
- `electron/src/renderer/App.tsx` + `FileChangeBanner.tsx` — banner mounting location, banner component pattern

### Secondary (MEDIUM confidence)
- [electron-builder Auto Update docs](https://www.electron.build/auto-update.html) — event list, Linux notes, app-update.yml, forceDevUpdateConfig
- [electron-builder Publish docs](https://www.electron.build/publish.html) — GitHub provider fields, releaseType default (`draft`), token behavior
- [electron-builder AppUpdater class](https://www.electron.build/electron-updater.Class.AppUpdater.html) — autoDownload, autoInstallOnAppQuit, quitAndInstall signatures
- [electron-builder UpdateInfo interface](https://www.electron.build/electron-updater.interface.updateinfo) — releaseNotes, version, releaseDate types

### Tertiary (LOW confidence / cross-verified)
- Multiple GitHub issues on `electron-userland/electron-builder` — APPIMAGE env var requirement (#3167, #4349), draft vs release behavior — cross-verified against primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, Context7 confirmed API
- Architecture: HIGH — project patterns read directly from source files
- Pitfalls: HIGH for most; MEDIUM for Linux AppImage behavior (multiple GitHub issues, cross-verified)
- Build config location: HIGH — `electron/package.json#build` read directly

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (electron-updater releases frequently; verify `6.8.3` is still latest before installing)
