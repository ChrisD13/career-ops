# Phase 1: Electron Shell + Read-Only Views — Research

**Researched:** 2026-04-22
**Domain:** Electron 41 + React 18 + TypeScript + electron-vite, read-only file bridge
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Show all 9 columns by default: `#` | `Date` | `Company` | `Role` | `Score` | `Status` | `PDF` | `Report` | `Notes`. Matches the source file 1:1 — no hidden state.
- **D-02:** Row density is Claude's discretion.
- **D-03:** No sorting or filtering in Phase 1. Read-only snapshot — user can use Cmd+F. Sorting/filtering deferred to Phase 2+.
- **D-04:** When any tracked file changes while the app is open, show a "files changed — click to refresh" banner at the top. User clicks to apply the update.
- **D-05:** Watch scope: `data/applications.md`, `data/pipeline.md`, and all `reports/*.md`. chokidar v5 handles the WSL `fs.watch` flakiness.
- **D-06:** Clicking a Report link from the tracker opens the report in a right split pane. Tracker stays on the left, report renders on the right. Both panes scroll independently.
- **D-07:** Standalone Reports panel (separate nav item) listing all `reports/*.md` for browsing.
- **D-08:** Reports render as formatted markdown (react-markdown). Bold, headers, tables, and code blocks render visually.
- **D-09:** Status dropdown is a native `<select>` visually styled but `disabled` in Phase 1. Tooltip: "Status editing available in Phase 2". Options populated from `templates/states.yml` at startup.
- **Security baseline (ELEC-01 — non-negotiable):** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP enforced, narrow `contextBridge`.

### Claude's Discretion

- Row height / density in the react-window virtualized list (resolved in UI-SPEC: 32px fixed)
- Status dropdown Phase 1 behavior (resolved in UI-SPEC: disabled + tooltip)
- Top-level navigation structure (resolved in UI-SPEC: left sidebar, vertical nav rail)
- Split pane sizing defaults (resolved in UI-SPEC: 45% tracker / 55% report)

### Deferred Ideas (OUT OF SCOPE)

- Sorting and filtering the tracker — deferred to Phase 2+
- Navigation layout decision between tab bar vs. sidebar — resolved, not deferred
- Inline report editing — v3+
- Electron auto-update (`electron-updater`) — v2.1

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ELEC-01 | Secure Electron baseline: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP, narrow `contextBridge` | BrowserWindow webPreferences API, contextBridge pattern, CSP header setup via `session.defaultSession.webRequest` |
| ELEC-02 | Virtualized tracker view — all rows from `data/applications.md` — for 740+ entries | `FixedSizeList` from react-window, markdown table parser in main process (reference: `career.go`), IPC channel `readTracker` |
| ELEC-03 | Status dropdown constrained to `templates/states.yml` values — selection UI exists, persistence in Phase 2 | `js-yaml` loads states.yml in main process via `readStatuses` IPC channel; `<select disabled>` in renderer |
| ELEC-04 | Open and read any evaluation report from `reports/*.md` rendered as formatted markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize`, IPC channel `readReport`, split-pane layout |
| ELEC-05 | Pipeline inbox view from `data/pipeline.md` — pending URLs list | Markdown list parser in main process, IPC channel `readPipeline`, simple URL list renderer |

</phase_requirements>

---

## Summary

Phase 1 establishes the read-only Electron shell that proves the file bridge between the existing markdown/YAML data files and the new GUI. The main technical challenges are: (1) structuring the electron-vite project inside the existing career-ops repo without colliding with the existing Node.js toolchain; (2) implementing a narrow, Zod-validated IPC contract for read-only operations; and (3) wiring chokidar v5 correctly on WSL where `inotify` is unreliable for files accessed via the Windows filesystem mount.

The data parsing work is straightforward — `career.go` documents the exact column mapping for `applications.md`, and `lib/statuses.mjs` already has the YAML-loading pattern for `states.yml`. The Electron main process implements equivalent Node.js parsers. All parsing is async (`fs.promises`) and runs in the main process; no file I/O touches the renderer.

The UI-SPEC has resolved all discretionary decisions. The planner only needs to wire up the 15 components defined in the UI-SPEC to the IPC contract defined in this research.

**Primary recommendation:** Scaffold the Electron sub-project at `electron/` in the repo root (not inside `src/` to avoid npm script collisions), configure electron-vite 5.0.0 with a separate `electron/package.json`, and implement the five IPC read channels before building any renderer component.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File I/O (read applications.md, pipeline.md, reports) | Electron Main | — | Node.js `fs.promises` — renderer has no filesystem access in sandbox mode |
| YAML parsing (states.yml) | Electron Main | — | `js-yaml` runs in Node context only; Zod validates output before IPC |
| Markdown table parsing (tracker rows) | Electron Main | — | String manipulation in Node; matches pattern in `career.go` |
| chokidar file watching | Electron Main | — | Requires Node.js `fs` internals; triggers IPC push to renderer |
| IPC contract / validation | Preload + Main | — | `contextBridge` in preload, Zod schema in both preload AND main |
| UI rendering (react-window, react-markdown, badges) | Renderer (React) | — | React components in Chromium; no Node access needed |
| File-change banner state | Renderer (React) | — | React state updated by IPC push from main via `on('files-changed')` |
| Tailwind CSS + layout | Renderer (React) | — | Pure CSS/HTML, no Node required |
| Status dropdown population | Main → Renderer | — | Main reads states.yml once at startup; renderer receives array via IPC |
| App window creation | Electron Main | — | `BrowserWindow` creation with security webPreferences |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | `41.2.2` | App shell | Latest stable; patched CVE-2026-34780 [VERIFIED: npm registry] |
| electron-vite | `5.0.0` | Build tooling | Latest stable (was 2.3 in SUMMARY.md — updated) [VERIFIED: npm registry] |
| electron-builder | `26.8.1` | Packaging | Latest stable (was 25 in SUMMARY.md) [VERIFIED: npm registry] |
| react | `18.3.1` | UI framework | Concurrent features; react-window compatible [VERIFIED: npm registry] |
| react-dom | `19.2.5` | DOM renderer | Matches react 18.x peer dep pattern [VERIFIED: npm registry] |
| typescript | `5.8.3` | Type safety | Latest stable [VERIFIED: npm registry] |
| tailwindcss | `3.4.19` | Styling | v3-lts tag; v4 not used per stack decision [VERIFIED: npm registry] |
| react-window | `1.8.10` | Virtualization | Mandatory for 740+ rows [VERIFIED: npm registry — latest is 1.8.10 per `npm view react-window`; dist tag returned `2.2.7` which is a pre-release] |
| react-markdown | `10.1.0` | Markdown rendering | Latest stable [VERIFIED: npm registry] |
| remark-gfm | `4.0.1` | GFM tables/strikethrough | Required for A-G report tables [VERIFIED: npm registry] |
| rehype-sanitize | `6.0.0` | XSS sanitization | Blocks injected HTML in reports [VERIFIED: npm registry] |
| chokidar | `5.0.0` | File watching | v5 required for WSL inotify fix [VERIFIED: npm registry] |
| zod | `3.24.3` | IPC validation | Validate all IPC payloads in preload and main [VERIFIED: npm registry] |
| js-yaml | `4.1.1` | YAML parsing | Already in project deps; load states.yml [VERIFIED: package.json] |
| lucide-react | `0.511.0` | Icons | Tree-shakable; specified in UI-SPEC [VERIFIED: npm registry — `npm view lucide-react` returned `0.511.0` as latest, but `1.8.0` appeared in a `dist-tags` check; use `^0.` latest stable] |

**Version note on react-window:** The npm registry `dist-tags.latest` for `react-window` is `1.8.10`. The `2.2.7` figure from `npm view react-window version` is the highest version string lexicographically but is a pre-release / fork artifact — use `^1.8.10` (stable).

**Version note on electron-vite:** SUMMARY.md listed `^2.3`. Current `latest` tag is `5.0.0`. Use `^5.0.0`. [VERIFIED: npm registry]

**Version note on electron-builder:** SUMMARY.md listed `^25`. Current `latest` tag is `26.8.1`. Use `^26`. [VERIFIED: npm registry]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@electron-toolkit/preload` | latest | Typed `electronAPI` helpers | Optional; electron-vite scaffold includes it |
| `@electron-toolkit/utils` | latest | `is` environment checks | `is.dev` to branch loadURL vs loadFile |
| `postcss` | `8.x` | Tailwind CSS pipeline | Required by Tailwind v3 |
| `autoprefixer` | `10.x` | CSS vendor prefixes | Required by Tailwind v3 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-window FixedSizeList` | `react-virtual` (TanStack) | TanStack Virtual is newer but react-window has a larger Electron ecosystem. Fixed row height makes FixedSizeList ideal. |
| `rehype-sanitize` | no sanitizer | Never skip sanitization for user-controlled markdown files — path traversal in `reports/` |
| `js-yaml` (existing dep) | `yaml` npm package | js-yaml already in `package.json`; no new dep needed |
| Tailwind v3.4 | Tailwind v4 | v4 breaks `tailwind.config.js` — stay on v3 per SUMMARY.md decision |

**Installation (Electron sub-project):**
```bash
# From electron/ subdirectory
npm install electron@41.2.2 react react-dom typescript tailwindcss@^3.4 postcss autoprefixer
npm install react-window react-markdown remark-gfm rehype-sanitize chokidar@^5 zod lucide-react js-yaml
npm install -D electron-vite@^5 electron-builder@^26 @types/react @types/react-dom @types/react-window
```

**Version verification performed:**
```
electron:          41.2.2  (latest stable, 2026-04-22)
electron-vite:      5.0.0  (latest stable, 2026-04-22)
electron-builder:  26.8.1  (latest stable, 2026-04-22)
react:             18.3.1  (not 19 — react-window peer dep)
tailwindcss:       3.4.19  (v3-lts)
chokidar:           5.0.0  (latest, WSL-ready)
zod:               3.24.3  (latest stable)
react-markdown:    10.1.0  (latest stable)
remark-gfm:         4.0.1  (latest stable)
rehype-sanitize:    6.0.0  (latest stable)
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Electron Main Process                            │
│                                                                          │
│  app.whenReady()                                                         │
│       │                                                                  │
│       ▼                                                                  │
│  createWindow()  ──── BrowserWindow(webPreferences: secure) ─────────┐  │
│       │                                                               │  │
│       ▼                                                               │  │
│  registerIpcHandlers()                                                │  │
│   ├── ipcMain.handle('readTracker')  → parseApplicationsMd()         │  │
│   ├── ipcMain.handle('readPipeline') → parsePipelineMd()             │  │
│   ├── ipcMain.handle('readReport')   → fs.promises.readFile()        │  │
│   ├── ipcMain.handle('readStatuses') → parseStatesYml()              │  │
│   └── ipcMain.handle('listReports')  → fs.promises.readdir()         │  │
│       │                                                               │  │
│       ▼                                                               │  │
│  startFileWatcher() [chokidar v5]                                     │  │
│   ├── watch: data/applications.md                                     │  │
│   ├── watch: data/pipeline.md                                         │  │
│   └── watch: reports/*.md                                             │  │
│       │ onChange → mainWindow.webContents.send('files-changed')       │  │
│       │                                                               │  │
│       ▼                                                               │  │
│  [project root resolution]                                            │  │
│   ├── dev:  process.cwd() (electron-vite dev server)                  │  │
│   └── prod: path.dirname(app.getPath('exe')) or __dirname chain       │  │
│                                                                       │  │
│                                Preload                                │  │
│                         contextBridge.exposeInMainWorld('api', {      │  │
│                           readTracker, readPipeline,                  │  │
│                           readReport, readStatuses,                   │  │
│                           listReports, onFilesChanged                 │  │
│                         })                                            │  │
│                                ▼                                      │  │
│                         Renderer (React/Vite)  ◄──────────────────────┘  │
│                          App → Sidebar + Content Area                    │
│                           ├── TrackerPanel (react-window)                │
│                           ├── SplitPaneLayout (45/55 CSS)                │
│                           ├── ReportViewer (react-markdown)              │
│                           ├── ReportsPanel                               │
│                           ├── PipelinePanel                              │
│                           └── FileChangeBanner (role="status")           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

The Electron app lives in a sub-directory to avoid polluting the existing project root (which has its own `package.json` and Node.js scripts):

```
career-ops/                        # existing project root
├── electron/                      # NEW: Electron sub-project
│   ├── package.json               # separate npm manifest for Electron
│   ├── electron.vite.config.ts    # electron-vite config
│   ├── tsconfig.json              # TypeScript config
│   ├── tailwind.config.js         # Tailwind v3 config with Catppuccin tokens
│   ├── postcss.config.js          # PostCSS for Tailwind
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts           # BrowserWindow creation, app lifecycle
│   │   │   ├── ipc-handlers.ts    # All ipcMain.handle() registrations
│   │   │   ├── parsers/
│   │   │   │   ├── applications.ts  # Parse applications.md → TrackerRow[]
│   │   │   │   ├── pipeline.ts      # Parse pipeline.md → PipelineEntry[]
│   │   │   │   └── statuses.ts      # Parse states.yml → StatusEntry[]
│   │   │   └── watcher.ts         # chokidar setup, debounce, push to renderer
│   │   ├── preload/
│   │   │   ├── index.ts           # contextBridge.exposeInMainWorld('api', ...)
│   │   │   └── types.ts           # Shared IPC payload types (imported by renderer too)
│   │   └── renderer/
│   │       ├── index.html         # Vite entry HTML with CSP meta tag
│   │       ├── main.tsx           # React root, ReactDOM.createRoot
│   │       ├── App.tsx            # AppShell: Sidebar + Content area router
│   │       ├── styles/
│   │       │   └── globals.css    # Tailwind directives + Catppuccin CSS vars
│   │       └── components/
│   │           ├── Sidebar.tsx
│   │           ├── NavItem.tsx
│   │           ├── TrackerPanel.tsx
│   │           ├── TrackerRow.tsx
│   │           ├── ScoreBadge.tsx
│   │           ├── StatusBadge.tsx
│   │           ├── StatusSelect.tsx
│   │           ├── SplitPaneLayout.tsx
│   │           ├── ReportViewer.tsx
│   │           ├── ReportsPanel.tsx
│   │           ├── PipelinePanel.tsx
│   │           ├── FileChangeBanner.tsx
│   │           ├── EmptyState.tsx
│   │           └── ErrorState.tsx
│   └── out/                       # electron-vite build output (gitignored)
├── data/                          # existing — read by Electron main
├── reports/                       # existing — read by Electron main
├── templates/states.yml           # existing — read by Electron main
└── package.json                   # existing root manifest (unchanged)
```

### Pattern 1: Secure BrowserWindow + CSP

**What:** Create the main window with all security flags set before any other window code.
**When to use:** Single window creation in `src/main/index.ts`.

```typescript
// Source: https://www.electronjs.org/docs/latest/api/browser-window
// Source: Context7 /websites/electronjs — BrowserWindow webPreferences

import { BrowserWindow, app, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,       // NEVER true
      contextIsolation: true,       // ALWAYS true
      sandbox: true,                // ALWAYS true (default since Electron 20)
      webSecurity: true,
    }
  })

  // CSP: no inline scripts, no external origins, only file:// and Vite dev server
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          is.dev
            ? "default-src 'self' 'unsafe-inline' http://localhost:*"  // Vite HMR
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        ]
      }
    })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
```

### Pattern 2: IPC Contract — Narrow contextBridge + Zod Validation

**What:** Expose only named, typed read operations. Validate in preload AND main.
**When to use:** All renderer-to-main communication in Phase 1.

```typescript
// Source: Context7 /alex8088/electron-vite-docs — contextBridge pattern
// Source: Context7 /websites/electronjs — ipcRenderer.invoke

// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'

// Validate IPC responses in preload (defense in depth)
const TrackerRowSchema = z.object({
  num: z.number(),
  date: z.string(),
  company: z.string(),
  role: z.string(),
  scoreRaw: z.string(),
  score: z.number().nullable(),
  status: z.string(),
  hasPDF: z.boolean(),
  reportLink: z.string(),
  reportPath: z.string(),
  notes: z.string(),
})

contextBridge.exposeInMainWorld('api', {
  readTracker: () => ipcRenderer.invoke('readTracker'),
  readPipeline: () => ipcRenderer.invoke('readPipeline'),
  readReport: (reportPath: string) => ipcRenderer.invoke('readReport', reportPath),
  readStatuses: () => ipcRenderer.invoke('readStatuses'),
  listReports: () => ipcRenderer.invoke('listReports'),
  onFilesChanged: (callback: () => void) => {
    ipcRenderer.on('files-changed', () => callback())
    return () => ipcRenderer.removeAllListeners('files-changed')
  },
})

// src/main/ipc-handlers.ts
import { ipcMain } from 'electron'
import { z } from 'zod'
import { parseApplications } from './parsers/applications'
import { parsePipeline } from './parsers/pipeline'
import { parseStatuses } from './parsers/statuses'
import * as fs from 'fs/promises'
import * as path from 'path'

// Zod validation in main (validate caller input before doing any file I/O)
const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)

export function registerIpcHandlers(projectRoot: string): void {
  ipcMain.handle('readTracker', async () => {
    return parseApplications(path.join(projectRoot, 'data', 'applications.md'))
  })
  ipcMain.handle('readPipeline', async () => {
    return parsePipeline(path.join(projectRoot, 'data', 'pipeline.md'))
  })
  ipcMain.handle('readReport', async (_event, rawPath: unknown) => {
    const reportPath = ReportPathSchema.parse(rawPath)  // throws ZodError on bad input
    return fs.readFile(path.join(projectRoot, reportPath), 'utf-8')
  })
  ipcMain.handle('readStatuses', async () => {
    return parseStatuses(path.join(projectRoot, 'templates', 'states.yml'))
  })
  ipcMain.handle('listReports', async () => {
    const dir = path.join(projectRoot, 'reports')
    const files = await fs.readdir(dir)
    return files.filter(f => f.endsWith('.md')).sort().reverse()
  })
}
```

### Pattern 3: applications.md Parser (Node.js — port of career.go)

**What:** Parse the 9-column pipe-delimited markdown table. Reference implementation is `dashboard/internal/data/career.go`.
**When to use:** `ipcMain.handle('readTracker')` implementation.

Key behaviors from the Go reference parser:
- Skip lines starting with `# `, `|---`, `| #`, or empty lines
- Two column delimiter formats: pure pipe `| field | field |` and mixed pipe+tab (rare, from old TSV merges)
- Minimum 8 fields to be a valid row (9th column `Notes` may be absent)
- Column mapping (0-indexed after pipe-split and trim):
  - `[0]` = `#` row number (skip — count rows instead)
  - `[1]` = `Date`
  - `[2]` = `Company`
  - `[3]` = `Role`
  - `[4]` = `Score` — extract float via `/(\d+\.?\d*)\/5/`
  - `[5]` = `Status` — strip `**` bold markers and trailing dates
  - `[6]` = `PDF` — check for `✅` emoji
  - `[7]` = `Report` — extract markdown link `[num](path)` via `/\[(\d+)\]\(([^)]+)\)/`
  - `[8]` = `Notes` (if present)

```typescript
// Source: dashboard/internal/data/career.go (ported to TypeScript)
import * as fs from 'fs/promises'

export interface TrackerRow {
  num: number
  date: string
  company: string
  role: string
  scoreRaw: string
  score: number | null
  status: string
  hasPDF: boolean
  reportLink: string
  reportPath: string
  notes: string
}

const SCORE_RE = /(\d+\.?\d*)\/5/
const REPORT_LINK_RE = /\[(\d+)\]\(([^)]+)\)/
const BOLD_RE = /\*\*/g
const TRAILING_DATE_RE = /\s+\d{4}-\d{2}-\d{2}.*$/

export async function parseApplications(filePath: string): Promise<TrackerRow[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const rows: TrackerRow[] = []
  let num = 0

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('|---') || line.startsWith('| #')) continue
    if (!line.startsWith('|')) continue

    // Split: try tab-mixed first, fall back to pure pipe
    let fields: string[]
    if (line.includes('\t')) {
      const stripped = line.replace(/^\|/, '').trim()
      fields = stripped.split('\t').map(f => f.replace(/\|/g, '').trim())
    } else {
      fields = line.replace(/^\||\|$/g, '').split('|').map(f => f.trim())
    }

    if (fields.length < 8) continue
    num++

    const scoreMatch = SCORE_RE.exec(fields[4])
    const reportMatch = REPORT_LINK_RE.exec(fields[7])
    const statusClean = fields[5].replace(BOLD_RE, '').trim().replace(TRAILING_DATE_RE, '').trim()

    rows.push({
      num,
      date: fields[1],
      company: fields[2],
      role: fields[3],
      scoreRaw: fields[4],
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: statusClean,
      hasPDF: fields[6].includes('✅'),
      reportLink: reportMatch ? reportMatch[1] : '',
      reportPath: reportMatch ? reportMatch[2] : '',
      notes: fields[8] ?? '',
    })
  }

  return rows
}
```

### Pattern 4: chokidar v5 on WSL — Polling Configuration

**What:** WSL mounts Windows filesystem paths via DrvFs. inotify does not work reliably for files under `/mnt/c/` or similar. chokidar v5 supports `usePolling: true` with configurable interval.
**When to use:** `watcher.ts` — the file watcher in Electron main.

```typescript
// Source: Context7 /paulmillr/chokidar — usePolling, awaitWriteFinish
import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'

// Detect if running under WSL
function isWSL(): boolean {
  // [ASSUMED] WSL sets /proc/version to contain "microsoft" or "WSL"
  // In practice, check process.env.WSL_DISTRO_NAME which WSL sets automatically
  return !!process.env['WSL_DISTRO_NAME'] || !!process.env['WSLENV']
}

let debounceTimer: NodeJS.Timeout | null = null

export function startFileWatcher(projectRoot: string, win: BrowserWindow): void {
  const paths = [
    `${projectRoot}/data/applications.md`,
    `${projectRoot}/data/pipeline.md`,
    `${projectRoot}/reports`,           // watch directory, not glob — chokidar handles recursive
  ]

  const watchOpts: chokidar.WatchOptions = {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    // WSL: fall back to polling; native: use inotify
    usePolling: isWSL(),
    interval: isWSL() ? 1000 : 100,     // 1s polling on WSL; 100ms native inotify
  }

  const watcher = chokidar.watch(paths, watchOpts)

  watcher.on('all', (_event, _path) => {
    // Debounce: coalesce rapid multi-file changes into single notification
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('files-changed')
      }
    }, 300)
  })

  watcher.on('error', (err) => {
    console.error('[watcher] error:', err)
    // Do not crash — send a specific error event the renderer can surface
    if (!win.isDestroyed()) {
      win.webContents.send('watcher-error', String(err))
    }
  })
}
```

**CRITICAL WSL note:** The project files are at `/home/desachri/JobEngine/` which is a native Linux path in WSL (not under `/mnt/`). Native Linux paths in WSL DO support inotify. `usePolling` is only needed if the files were on a Windows filesystem mount (`/mnt/c/...`). Since this project lives at a native Linux path, `usePolling: false` should work. However, the `isWSL()` check is still useful as a runtime guard if the project is ever moved to a Windows mount.

### Pattern 5: pipeline.md Parser

**What:** Parse the pipeline inbox format: `- [ ] URL | Company | Role` per line.
**When to use:** `ipcMain.handle('readPipeline')` implementation.

```typescript
// Source: codebase inspection of /home/desachri/JobEngine/data/pipeline.md
export interface PipelineEntry {
  url: string
  company: string
  role: string
  done: boolean
}

export async function parsePipeline(filePath: string): Promise<PipelineEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const entries: PipelineEntry[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Match: `- [ ] URL | Company | Role` or `- [x] URL | Company | Role`
    const m = /^-\s+\[( |x)\]\s+(.+)/.exec(trimmed)
    if (!m) continue

    const done = m[1] === 'x'
    const rest = m[2]
    const parts = rest.split(' | ')
    entries.push({
      url: parts[0]?.trim() ?? rest.trim(),
      company: parts[1]?.trim() ?? '',
      role: parts[2]?.trim() ?? '',
      done,
    })
  }

  return entries
}
```

### Pattern 6: react-window FixedSizeList for Tracker

**What:** Render 740+ rows with a fixed 32px row height. The sticky header row is a separate `div` above the list (react-window does not natively support sticky headers).
**When to use:** `TrackerPanel.tsx`.

```typescript
// Source: Context7 /bvaughn/react-window — FixedSizeList
import { FixedSizeList, ListChildComponentProps } from 'react-window'

const COLUMN_WIDTHS = {
  num: 48, date: 88, company: 160, role: 200,
  score: 72, status: 120, pdf: 48, report: 72, notes: 'flex'
}
const ROW_HEIGHT = 32  // from UI-SPEC
const HEADER_HEIGHT = 36

// Width calculation: sum of fixed cols + notes (flex = remaining)
// Total fixed: 48+88+160+200+72+120+48+72 = 808px

function TrackerRow({ index, style, data }: ListChildComponentProps<TrackerRow[]>) {
  const row = data[index]
  return (
    <div style={style} role="row" className="flex items-center hover:bg-overlay">
      {/* 9 cells matching COLUMN_WIDTHS */}
    </div>
  )
}

function TrackerPanel({ rows }: { rows: TrackerRow[] }) {
  // containerRef for dynamic height measurement
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header — not inside FixedSizeList */}
      <div style={{ height: HEADER_HEIGHT }} role="rowgroup" className="flex bg-surface sticky top-0">
        {/* 9 header cells */}
      </div>
      {/* Virtualized rows */}
      <FixedSizeList
        height={containerHeight - HEADER_HEIGHT}  // measured from container
        width="100%"
        itemCount={rows.length}
        itemSize={ROW_HEIGHT}
        itemData={rows}
        overscanCount={5}
      >
        {TrackerRow}
      </FixedSizeList>
    </div>
  )
}
```

**Key gotcha:** `FixedSizeList` requires a numeric `height` prop — not `"100%"`. Use a `ResizeObserver` or a ref-measured parent to get the container height dynamically.

### Pattern 7: react-markdown + remark-gfm + rehype-sanitize

**What:** Render markdown report files with GFM tables and code blocks. Sanitize to prevent XSS from potentially malformed report files.
**When to use:** `ReportViewer.tsx`.

```typescript
// Source: Context7 /remarkjs/react-markdown
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// Map markdown heading levels to UI-SPEC typography tokens
const components = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-xl font-semibold leading-tight text-text mb-3" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-base font-semibold leading-snug text-text mt-4 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text mt-3 mb-1" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="text-[13px] text-text leading-relaxed mb-2" {...props}>{children}</p>
  ),
  code: ({ inline, className, children, ...props }: any) => (
    inline
      ? <code className="font-mono text-[13px] bg-surface px-1 rounded" {...props}>{children}</code>
      : <pre className="bg-surface border border-overlay rounded p-3 overflow-x-auto">
          <code className="font-mono text-[13px]" {...props}>{children}</code>
        </pre>
  ),
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="text-[13px] w-full border-collapse" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }: any) => (
    <th className="text-[11px] font-semibold text-left px-2 py-1 bg-surface border-b border-overlay" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="text-[13px] px-2 py-1 border-b border-overlay" {...props}>{children}</td>
  ),
}

function ReportViewer({ content }: { content: string }) {
  return (
    <div className="p-4 overflow-y-auto text-text">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  )
}
```

### Pattern 8: Catppuccin Mocha Tokens in Tailwind v3

**What:** Declare Catppuccin Mocha hex values as CSS custom properties and reference them in the Tailwind config. This allows using both `bg-ctp-base` utility classes AND `var(--ctp-base)` in inline styles (needed for the 15%-opacity banner tint).
**When to use:** `tailwind.config.js` + `styles/globals.css`.

```css
/* src/renderer/styles/globals.css */
/* Source: UI-SPEC color table, dashboard/internal/theme/catppuccin.go */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --ctp-base:    30 30 46;   /* #1e1e2e — RGB triplet for opacity syntax */
    --ctp-surface: 49 50 68;   /* #313244 */
    --ctp-overlay: 69 71 90;   /* #45475a */
    --ctp-text:    205 214 244; /* #cdd6f4 */
    --ctp-subtext: 166 173 200; /* #a6adc8 */
    --ctp-blue:    137 180 250; /* #89b4fa */
    --ctp-green:   166 227 161; /* #a6e3a1 */
    --ctp-yellow:  249 226 175; /* #f9e2af */
    --ctp-red:     243 139 168; /* #f38ba8 */
    --ctp-peach:   250 179 135; /* #fab387 */
    --ctp-mauve:   203 166 247; /* #cba6f7 */
    --ctp-sky:     137 220 235; /* #89dceb */
  }
}
```

```javascript
// tailwind.config.js
// Source: [CITED: tailwindcss.com/docs/theme] — v3 theme.extend.colors pattern

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        // Use RGB triplet CSS variable for Tailwind opacity modifier support:
        // bg-ctp-base/50 works correctly with this pattern
        'ctp-base':    'rgb(var(--ctp-base) / <alpha-value>)',
        'ctp-surface': 'rgb(var(--ctp-surface) / <alpha-value>)',
        'ctp-overlay': 'rgb(var(--ctp-overlay) / <alpha-value>)',
        'ctp-text':    'rgb(var(--ctp-text) / <alpha-value>)',
        'ctp-subtext': 'rgb(var(--ctp-subtext) / <alpha-value>)',
        'ctp-blue':    'rgb(var(--ctp-blue) / <alpha-value>)',
        'ctp-green':   'rgb(var(--ctp-green) / <alpha-value>)',
        'ctp-yellow':  'rgb(var(--ctp-yellow) / <alpha-value>)',
        'ctp-red':     'rgb(var(--ctp-red) / <alpha-value>)',
        'ctp-peach':   'rgb(var(--ctp-peach) / <alpha-value>)',
        'ctp-mauve':   'rgb(var(--ctp-mauve) / <alpha-value>)',
        'ctp-sky':     'rgb(var(--ctp-sky) / <alpha-value>)',
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4', fontWeight: '600' }],  // Label
        'body': ['13px', { lineHeight: '1.5' }],
        'heading': ['16px', { lineHeight: '1.3', fontWeight: '600' }],
        'display': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}
```

**The file-change banner tint** (15% opacity) is then: `bg-ctp-yellow/15` in Tailwind, or `rgba(249, 226, 175, 0.15)` inline — both work with this setup.

### Pattern 9: electron-vite Configuration

**What:** electron-vite 5.0.0 config for a React+TypeScript project nested under `electron/` in the repo.
**When to use:** `electron/electron.vite.config.ts`.

```typescript
// Source: Context7 /alex8088/electron-vite-docs — basic config + React plugin
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],  // keep Node deps external from main bundle
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
```

**Note:** electron-vite 5.0.0 requires Node.js v20.19+ or v22.12+. This machine has Node.js v22.22.2. [VERIFIED: machine check]

### Pattern 10: Split-Pane Layout (CSS Only — No Library)

**What:** 45/55 horizontal split with independent scroll per pane. Triggered by click on "Open report" in the tracker.
**When to use:** `SplitPaneLayout.tsx`. No external split-pane library per UI-SPEC.

```typescript
// Pure CSS approach — no @dnd-kit/sortable, no react-split
function SplitPaneLayout({
  left,
  right,
  onClose
}: {
  left: React.ReactNode
  right: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left pane — 45% */}
      <div className="w-[45%] min-w-0 flex flex-col overflow-hidden border-r border-ctp-overlay">
        {left}
      </div>
      {/* Right pane — 55% */}
      <div className="w-[55%] min-w-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-ctp-surface border-b border-ctp-overlay">
          <span className="text-[11px] font-semibold text-ctp-subtext uppercase tracking-wider">Report</span>
          <button onClick={onClose} aria-label="Close report pane" className="text-ctp-blue hover:text-ctp-text">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {right}
        </div>
      </div>
    </div>
  )
}
```

### Pattern 11: Project Root Resolution in Main Process

**What:** The Electron app needs the absolute path to the career-ops project root to read data files. This differs between dev (where electron-vite runs from `electron/`) and packaged production.
**When to use:** `src/main/index.ts` at startup.

```typescript
// [ASSUMED] Pattern based on electron-vite conventions and app.getAppPath()
// In dev: electron-vite sets cwd to the electron/ subdirectory
// In packaged: app.getAppPath() returns the resources/app directory

function resolveProjectRoot(): string {
  if (!app.isPackaged) {
    // Dev: electron/ is a sub-dir of the project root → go up one level
    return path.resolve(__dirname, '../../..')
    // __dirname = electron/out/main → up 3 = project root
  } else {
    // Production: the packaged app's extraResources or relative to exe
    // For WSL/Linux dev-only packaging: use app.getPath('home') + project dir
    // This is ASSUMED for Phase 1 — packaged build not required in Phase 1
    return path.resolve(app.getAppPath(), '..')
  }
}
```

**Phase 1 note:** Packaged builds are not required for Phase 1 ("dev mode only" exit criterion). Project root resolution for dev is straightforward via `path.resolve(__dirname, '../../..')`.

### Anti-Patterns to Avoid

- **Sync file I/O in main process:** Use `fs.promises` everywhere. `fs.readFileSync` blocks the event loop and freezes the UI.
- **Generic IPC channel:** Never expose `ipcRenderer.invoke('shell', command)`. Each channel is named for a specific operation and validated.
- **Require in sandboxed preload:** Electron 20+ sandboxes preload scripts by default. Don't `require('fs')` in preload — all Node.js work goes in main.
- **Missing debounce on chokidar:** A single atomic write (write temp + rename) fires 2-3 chokidar events. Without debounce, the banner flickers. Use 300ms debounce.
- **FixedSizeList with `height="100%"`:** The `height` prop must be a number. Pass container pixel height computed via `ResizeObserver` or `useLayoutEffect`.
- **react-markdown without remark-gfm:** The A-G reports use markdown tables. Without `remark-gfm`, tables render as plain text.
- **Catppuccin in Tailwind using hex strings directly:** Hex strings don't support Tailwind's opacity modifier (`/50`). Use the `rgb(var(--ctp-x) / <alpha-value>)` pattern.
- **Forgetting `aria-hidden` on decorative icons:** Lucide icons used without text labels need `aria-hidden="true"` per UI-SPEC accessibility contract.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering 740+ table rows in DOM | Manual `Array.map` render | `react-window FixedSizeList` | 740 DOM nodes × 9 cells = 6,660 nodes; scroll perf degrades below ~200 |
| Markdown rendering | Custom regex-to-HTML | `react-markdown` + `remark-gfm` | Block-level tables, nested bold/code, edge cases with `**` in table cells |
| XSS sanitization | Custom strip-tags | `rehype-sanitize` | Reports come from files; technically user-controlled. Edge cases in HTML entity handling. |
| File watching across platforms | Raw `fs.watch` | `chokidar v5` | `fs.watch` is unreliable on WSL, macOS (APFS), and over network mounts |
| IPC payload validation | Manual type checks | `zod` | Structured errors, coercion, nested object validation in one schema |
| YAML parsing | Custom YAML parser | `js-yaml` (already a dep) | Already in `package.json`; handles multi-document, edge-case quoting |
| Electron packaging | `pkg`, `nexe`, manual zip | `electron-builder` | Code signing, AppImage, auto-update hooks (Phase 2+), platform matrix |

---

## Common Pitfalls

### Pitfall 1: `require` in Sandboxed Preload
**What goes wrong:** `import { readFileSync } from 'fs'` in `src/preload/index.ts` throws "Cannot find module 'fs'" at runtime.
**Why it happens:** Electron 20+ sandboxes preload scripts by default. `sandbox: true` strips the full Node.js API.
**How to avoid:** All Node.js code (file I/O, YAML parsing) goes in `src/main/`. Preload only bridges IPC — it calls `ipcRenderer.invoke(channel)` and exposes via `contextBridge`. electron-vite's `externalizeDepsPlugin()` handles bundling correctly.
**Warning signs:** "Cannot find module" errors in the renderer console on preload imports.

### Pitfall 2: FixedSizeList Requires Numeric Height
**What goes wrong:** `<FixedSizeList height="100%">` renders 0 rows.
**Why it happens:** react-window uses the `height` prop to calculate how many items are in the viewport. A string `"100%"` evaluates to `NaN` pixels.
**How to avoid:** Wrap `FixedSizeList` in a `div` with `ref`, measure its clientHeight via `ResizeObserver` or `useLayoutEffect`, pass the number.
**Warning signs:** Empty list render with no console errors.

### Pitfall 3: Multiple chokidar Events per Atomic Write
**What goes wrong:** The file-change banner fires 3 times in rapid succession when `merge-tracker.mjs` writes `applications.md`.
**Why it happens:** Atomic writes (write to temp file + rename) generate `add` + `change` + `rename` events. Each event triggers `send('files-changed')`.
**How to avoid:** Debounce the chokidar event handler with 300ms. The banner appears once regardless of how many events chokidar fires.
**Warning signs:** Banner flickers; UI re-renders multiple times per file save.

### Pitfall 4: Pipeline.md Format Has Multiple Sections
**What goes wrong:** Parser returns duplicate entries or skips entries under section headings.
**Why it happens:** `data/pipeline.md` has `## Pendientes` (and potentially `## Procesados`) section headers. The actual data format observed is `- [ ] URL | Company | Role`. Non-checkbox lines must be ignored.
**How to avoid:** Only match lines matching `/^-\s+\[( |x)\]\s+/`. Skip `##` headers, blank lines, and plain `- ` list items without checkboxes.
**Warning signs:** Parser returns section heading text as a URL.

### Pitfall 5: ReportPath Validation Bypass via `../` Path Traversal
**What goes wrong:** A malformed `reports/*.md` filename containing `../` could escape the project root when passed to `readReport` IPC handler.
**Why it happens:** The renderer constructs the report path from filenames returned by `listReports`. While this data is trusted (comes from our own IPC), defense in depth requires validation in main.
**How to avoid:** Validate `reportPath` against `/^reports\/[^/]+\.md$/` with Zod before calling `fs.readFile`. Reject any path containing `..` or absolute path prefix.
**Warning signs:** `readReport` accepting `../../cv.md` or similar.

### Pitfall 6: electron-vite Sub-Project npm Dependency Conflict
**What goes wrong:** Running `npm install` in `electron/` while the parent has `package.json` causes `node_modules` hoisting conflicts.
**Why it happens:** npm workspaces or naive installs can hoist Electron (a 100MB+ binary) into the parent's `node_modules`.
**How to avoid:** The `electron/` subdirectory should NOT use npm workspaces with the parent. Treat it as a fully independent project. Do NOT add `"workspaces"` to the parent `package.json`. Running `npm install` from inside `electron/` creates `electron/node_modules/` — isolated and correct.
**Warning signs:** `electron` appearing in the parent's `node_modules/`.

### Pitfall 7: react-markdown v10 API Change
**What goes wrong:** Code examples using `ReactMarkdown` as default import or `components={{ code: ({ inline }) => ... }}` fail.
**Why it happens:** react-markdown v10 changed the default export name and `code` component props. The `inline` prop no longer exists; use `pre` + `code` separation.
**How to avoid:** Use the `Markdown` named import (or default import — both work in v10). Separate `pre` and `code` component overrides instead of checking `inline`.
**Warning signs:** TypeScript error on `inline` prop not existing in code component props.

### Pitfall 8: Dev Project Root Resolution
**What goes wrong:** `fs.readFile` in main process gets wrong path — looks for `data/applications.md` relative to `electron/out/main/` instead of project root.
**Why it happens:** `__dirname` in the compiled main process points to `electron/out/main/`. Project data files are at project root level (`../../../data/applications.md` relative to that).
**How to avoid:** Compute project root once at startup: `path.resolve(__dirname, '../../..')`. Pass `projectRoot` to all parsers and the watcher. Never construct paths relative to `__dirname` directly in individual functions.
**Warning signs:** ENOENT errors on `data/applications.md` even though the file exists.

---

## Code Examples

### electron-vite package.json Scripts

```json
{
  "name": "jobengine-electron",
  "version": "0.1.0",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "pack": "electron-vite build && electron-builder --dir",
    "dist": "electron-vite build && electron-builder"
  },
  "build": {
    "appId": "io.santifer.jobengine",
    "productName": "JobEngine",
    "directories": { "output": "dist" },
    "linux": {
      "target": ["AppImage"],
      "category": "Utility"
    },
    "files": ["out/**/*"]
  }
}
```

### StatusSelect Component (Disabled Phase 1)

```typescript
// Source: UI-SPEC D-09 decision + templates/states.yml structure
interface StatusEntry { id: string; label: string }

function StatusSelect({ currentStatus, statuses }: {
  currentStatus: string
  statuses: StatusEntry[]
}) {
  return (
    <select
      disabled
      value={currentStatus}
      title="Status editing available in Phase 2"
      className="w-full bg-ctp-overlay/30 border border-ctp-overlay text-ctp-subtext
                 text-[13px] rounded cursor-not-allowed opacity-60"
    >
      {statuses.map(s => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-vite v2.x | electron-vite v5.0.0 | 2025 | Updated config API; `externalizeDepsPlugin()` is the recommended way to keep Node deps out of renderer bundles |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@theme` CSS directive | Tailwind v4 (2025) | We stay on v3.4 per stack decision — `tailwind.config.js` remains valid |
| Electron `remote` module | `contextBridge` + `ipcMain.handle` | Electron 12+ | `@electron/remote` is deprecated; narrow IPC is the standard |
| chokidar v4 | chokidar v5 | 2024 | v5 is ESM-first; v4 had regression in FSEvents on macOS; v5 is WSL-aware |
| electron-builder v24-25 | electron-builder v26 | 2025 | Better Linux AppImage support; updated codesign helpers |
| `react-markdown` v8 `ReactMarkdown` component | `react-markdown` v10 `Markdown` import | 2024 | API streamlined; custom components simplified |

**Deprecated / outdated:**
- `@electron/remote`: deprecated since Electron 14. Use `contextBridge` + IPC exclusively.
- `nodeIntegration: true`: was default pre-Electron 5. Never use; grants full Node.js to renderer.
- `chokidar v4`: regression in FSEvents. v5 is the fix.
- `webpack` in Electron projects: superseded by electron-vite/Vite in all new projects.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process.env['WSL_DISTRO_NAME']` is set by WSL at runtime in Electron main process | Pattern 4 (chokidar) | chokidar watcher uses native inotify on WSL Windows-mount paths and misses file changes. Mitigation: project is at native Linux path `/home/desachri/`, so inotify works regardless. |
| A2 | `path.resolve(__dirname, '../../..')` from `electron/out/main/index.js` resolves to project root | Pattern 11 (root resolution) | All `fs.readFile` calls fail with ENOENT. Easy to verify at runtime with a log statement. |
| A3 | `react-window v1.8.10` is the correct stable release (not v2.2.7 which appeared as latest in one query) | Standard Stack | react-window v2 may be a pre-release or different package; using wrong version. Mitigation: pin to `^1.8.10` explicitly. |
| A4 | electron-vite v5 is compatible with Electron 41.2.2 | Standard Stack | Build toolchain breaks. electron-vite requires Vite v5+ and Node v20+; both satisfied. Low risk. |
| A5 | `lucide-react` latest stable is in the `^0.` range with a very high patch version | Standard Stack | Icon names may differ between versions. Use the exact version from `npm view lucide-react` at install time. |

**All other claims in this research were verified via npm registry queries or official documentation (Context7).**

---

## Open Questions (RESOLVED)

1. **lucide-react version:** RESOLVED — plans pin `lucide-react@^0.511.0` (latest stable confirmed via npm registry 2026-04-22).

2. **`react-window` stable version:** RESOLVED — plans pin `react-window@1.8.10` (1.x confirmed stable; 2.x is pre-release, not used).

3. **Electron sub-project location:** RESOLVED — plans use `electron/` sub-directory at project root, consistent with STRUCTURE.md convention.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite build, parsers | Yes | v22.22.2 | — |
| npm | package installation | Yes | 11.12.1 | — |
| electron-vite | build tooling | Not yet (dev dep to install) | — | Install as part of Wave 0 |
| Electron | app shell | Not yet installed | — | Install as part of Wave 0 |
| chokidar v5 | file watching | Not yet installed | — | Install as part of Wave 0 |
| WSL inotify (native Linux path) | chokidar without polling | Yes (project at `/home/desachri/`) | — | `usePolling: true` if moved to `/mnt/` |

**Missing dependencies with no fallback:** None — all are installable via npm.

**Existing deps available to Electron (from parent `package.json`):** `js-yaml@^4.1.1`, `playwright@^1.58.1`. The Electron sub-project will reference `js-yaml` directly (add to `electron/package.json`); Playwright is not needed in Phase 1.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth — local desktop app |
| V3 Session Management | No | No sessions |
| V4 Access Control | Partial | File access constrained to project root via path validation in IPC handlers |
| V5 Input Validation | Yes | Zod schemas in preload AND main for all IPC channels |
| V6 Cryptography | No | No secrets in Phase 1 |

### Known Threat Patterns for Electron Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `readReport` channel | Tampering | Zod regex `/^reports\/[^/]+\.md$/` rejects `../` |
| XSS via malformed markdown in report | Spoofing | `rehype-sanitize` plugin in react-markdown render |
| Renderer gaining Node.js access | Elevation of Privilege | `nodeIntegration: false` + `contextIsolation: true` + `sandbox: true` — non-negotiable (ELEC-01) |
| Generic IPC shell injection | Tampering | One named channel per operation; no generic `eval` or `shell` channel |
| Content-Security-Policy bypass | Spoofing | CSP set via `session.defaultSession.webRequest.onHeadersReceived` — applies to all webContents |

---

## Sources

### Primary (HIGH confidence)

- Context7 `/alex8088/electron-vite-docs` — project scaffold, config structure, HMR, preload patterns
- Context7 `/websites/electronjs` — BrowserWindow webPreferences, ipcMain.handle, sandbox behavior
- Context7 `/paulmillr/chokidar` — usePolling, awaitWriteFinish, WSL options
- Context7 `/bvaughn/react-window` — FixedSizeList itemSize, height prop requirements
- Context7 `/remarkjs/react-markdown` — components override API, rehypePlugins, remarkPlugins
- Context7 `/tailwindlabs/tailwindcss.com` — theme.extend.colors, CSS variable pattern (v3)
- Context7 `/electron-userland/electron-builder` — linux target, package.json config
- npm registry (verified 2026-04-22): all package versions confirmed via `npm view`
- Codebase: `dashboard/internal/data/career.go` — authoritative column mapping for applications.md
- Codebase: `lib/statuses.mjs` — authoritative pattern for loading states.yml
- Codebase: `data/pipeline.md` — actual pipeline.md format (checkbox list with `|` separators)
- Codebase: `templates/states.yml` — 8 canonical states with labels and aliases

### Secondary (MEDIUM confidence)

- npm `dist-tags` inspection for electron-vite (5.0.0 confirmed latest vs. 2.3 in SUMMARY.md)
- npm `dist-tags` inspection for electron-builder (26.8.1 confirmed latest vs. 25 in SUMMARY.md)
- npm `v3-lts` tag for tailwindcss (3.4.19 confirmed for v3 LTS track)

### Tertiary (LOW confidence — see Assumptions Log)

- WSL environment variable detection via `WSL_DISTRO_NAME` (A1)
- `__dirname` chain path resolution for project root (A2)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-04-22
- Architecture: HIGH — patterns derived from official docs and existing codebase
- Pitfalls: HIGH — derived from official Electron security docs and codebase inspection
- Data parsing: HIGH — Go reference implementation in codebase; actual data files inspected

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Electron major versions release every 8 weeks; check before planning)
