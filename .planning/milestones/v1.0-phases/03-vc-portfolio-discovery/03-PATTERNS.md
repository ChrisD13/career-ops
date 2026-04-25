# Phase 3: VC Portfolio Discovery - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 29 new/modified (8 scraper, 3 data, 10 components, 5 Electron main/preload, 3 services)
**Analogs found:** 29 / 29

## File Classification

### Scraper layer (CLI + libraries)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scrape-vcs.mjs` | CLI entry-point | batch / file I/O | `scan.mjs` | exact (both: root ESM CLI, YAML config → HTTP scrape → TSV write) |
| `scrapers/adapters/*.mjs` (10 adapters + `index.mjs`) | utility / parser | transform | `scan.mjs` parsers (`parseGreenhouse`, `parseAshby`, `parseLever` — lines 82-112) | role-match (parser-per-source) |
| `scrapers/funding-detector.mjs` | utility | request-response | `scan.mjs` `fetchJson` (lines 116-126) | role-match |
| `scrapers/role-matcher.mjs` | utility | transform | `scan.mjs` `buildTitleFilter` + `detectApi` (lines 42-78, 130-140) | exact (research explicitly says "reuse verbatim") |
| `scrapers/robots.mjs` | utility | request-response | `scan.mjs` `fetchJson` + `lib/statuses.mjs` `catalogCache` Map cache | role-match |
| `scrapers/tsv-writer.mjs` | utility | file I/O | `scan.mjs` `appendToScanHistory` + `appendToPipeline` (lines 233-277) | exact |
| `scrapers/health.mjs` | utility | file I/O | `electron/src/main/services/mtime-cache.ts` (JSON sidecar) | role-match (same sidecar-JSON pattern) |

### Config + data files (new)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `config/vc-firms.yml` | config | static | `portals.yml` (`tracked_companies` shape) + `config/profile.yml` | exact |
| `data/vc-companies.tsv` | data | append-only | `data/scan-history.tsv` (header on row 1, tab-separated) | exact |
| `data/vc-health.json` | data | snapshot | `data/.mtime-cache.json` (sidecar JSON via `write-file-atomic`) | exact |

### Electron main process (extend + new)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/main/ipc-handlers.ts` (extend) | controller | request-response | itself (lines 111-120 `runScan` + 50-53 `updateStatus`) | exact (add sibling handlers) |
| `electron/src/main/services/scheduler.ts` (new) | service | event-driven (cron) | `electron/src/main/services/process-runner.ts` + `preferences.ts` | role-match (lifecycle + prefs-backed) |
| `electron/src/main/services/preferences.ts` (extend) | service | CRUD (JSON file) | itself (lines 14-41 `getModel`/`setModel`) | exact (add `getVcScrapeInterval`/`setVcScrapeInterval`) |
| `electron/src/main/services/url-probe.ts` (new) | service | request-response | `electron/src/main/services/evaluation-service.ts` (fetch pattern) | role-match |
| `electron/src/main/services/vc-firms.ts` (new) | service | CRUD (YAML file) | `electron/src/main/services/status-writer.ts` (lockfile + atomic write) | exact (same write contract) |
| `electron/src/main/services/promote.ts` (new) | service | file I/O (append) | `scan.mjs` `appendToPipeline` + `status-writer.ts` (lockfile) | exact |
| `electron/src/main/watcher.ts` (extend) | service | event-driven | itself (lines 13-17 `paths` array) | exact (append 2 paths) |

### Electron preload

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/preload/types.ts` (extend) | config / types | — | itself (lines 91-125 `ElectronAPI`) | exact |
| `electron/src/preload/index.ts` (extend) | config | — | itself (lines 34-44 preferences bridge) | exact |

### Renderer components (new + extend)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `electron/src/renderer/components/DiscoverPanel.tsx` (new) | component | request-response + event-driven | `TrackerPanel.tsx` (virtualized + onFilesChanged subscribe) | exact |
| `electron/src/renderer/components/CompanyTable.tsx` (new) | component | — | `TrackerPanel.tsx` (FixedSizeList + sticky header) | exact |
| `electron/src/renderer/components/CompanyRow.tsx` (new) | component | — | `TrackerRow.tsx` (ListChildComponentProps + role=row/gridcell) | exact |
| `electron/src/renderer/components/VcDropAlertBanner.tsx` (new) | component | — | `FileChangeBanner.tsx` | exact (same banner pattern) |
| `electron/src/renderer/components/ScraperHealthPanel.tsx` (new) | component | request-response | `CvPanel.tsx` / `ReportsPanel.tsx` (load-then-render) | role-match |
| `electron/src/renderer/components/FundingSignalBadge.tsx` (new) | component | — | `ScoreBadge.tsx` / `StatusBadge.tsx` | exact (small stateless pill) |
| `electron/src/renderer/components/RoleMatchBadge.tsx` (new) | component | — | `ScoreBadge.tsx` / `StatusBadge.tsx` | exact |
| `electron/src/renderer/components/PromoteButton.tsx` (new) | component | request-response | `VerifyButton.tsx` | role-match (button + async IPC + result state) |
| `electron/src/renderer/components/PromotedBadge.tsx` (new) | component | — | `StatusBadge.tsx` | exact |
| `electron/src/renderer/components/AddFirmButton.tsx` (new) | component | — | `GearIcon.tsx` / `PipelinePanel.tsx` action buttons | exact |
| `electron/src/renderer/components/AddFirmModal.tsx` (new) | component | request-response | `SettingsSlideOver.tsx` (modal/dialog pattern) | exact |
| `electron/src/renderer/components/VcScraperSection.tsx` (new, inside SettingsSlideOver) | component | request-response | `ModelSelect.tsx` | role-match |
| `electron/src/renderer/components/DiscoverFilterToggle.tsx` (new) | component | — | `StatusSelect.tsx` buttons | role-match |
| `electron/src/renderer/components/HealthStatusDot.tsx` (new) | component | — | `StatusBadge.tsx` | exact |
| `electron/src/renderer/components/Sidebar.tsx` (extend) | component | — | itself (lines 15-21 `ITEMS` array, line 5 `PanelId`) | exact (add 6th entry) |
| `electron/src/renderer/components/OpBadge.tsx` (extend) | component | — | itself (line 1-7 `kind` union + `LABELS`) | exact (add `'scrape'`) |
| `electron/src/renderer/App.tsx` (extend) | component | — | itself (lines 76-120 `renderPanel` switch) | exact (add `case 'discover'`) |

## Pattern Assignments

---

### `scrape-vcs.mjs` (CLI entry-point, batch/file-I/O)

**Analog:** `/home/desachri/JobEngine/scan.mjs`

**Shebang + header pattern** (scan.mjs lines 1-25):
```javascript
#!/usr/bin/env node

/**
 * scrape-vcs.mjs — VC portfolio discovery scraper
 *
 * Loads config/vc-firms.yml, iterates 10 firms via per-firm adapters
 * (Playwright), applies funding + role-match filters, and writes
 * data/vc-companies.tsv + data/vc-health.json atomically.
 *
 * Usage:
 *   node scrape-vcs.mjs                  # scrape all enabled firms
 *   node scrape-vcs.mjs --dry-run        # preview without writing
 *   node scrape-vcs.mjs --firm a16z      # scrape a single firm
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import yaml from 'js-yaml';
```

**Directory bootstrap** (scan.mjs line 34-35):
```javascript
// Ensure required directories exist (fresh setup)
mkdirSync('data', { recursive: true });
```

**Arg parsing + dry-run flag** (scan.mjs lines 314-323):
```javascript
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const firmFlag = args.indexOf('--firm');
  const filterFirm = firmFlag !== -1 ? args[firmFlag + 1]?.toLowerCase() : null;

  if (!existsSync(CONFIG_PATH)) {
    console.error('Error: config/vc-firms.yml not found. Copy from config/vc-firms.example.yml first.');
    process.exit(1);
  }
```

**Console summary block** (scan.mjs lines 391-420):
```javascript
  console.log(`\n${'━'.repeat(45)}`);
  console.log(`VC Scrape — ${date}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Firms scanned:       ${firms.length}`);
  console.log(`Companies found:     ${allCompanies.length}`);
  console.log(`With funding signal: ${withSignal}`);
  console.log(`Role-matched:        ${withRoleMatch}`);
```

**Direct-run guard** (scan.mjs lines 423-430):
```javascript
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
```

---

### `scrapers/adapters/*.mjs` (parsers, transform)

**Analog:** `scan.mjs` lines 82-112 (per-ATS parsers)

**Parser-per-source pattern** (scan.mjs lines 82-112):
```javascript
function parseGreenhouse(json, companyName) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    company: companyName,
    location: j.location?.name || '',
  }));
}
// ...
const PARSERS = { greenhouse: parseGreenhouse, ashby: parseAshby, lever: parseLever };
```

**Apply to:** Each `scrapers/adapters/{firm}.mjs` exports `default async function scrape(context, { log, firm })` returning `Company[]`. `scrapers/adapters/index.mjs` builds the registry `{ a16z, sequoia, ... }` mapping firm name → adapter, analogous to `PARSERS`.

---

### `scrapers/robots.mjs` (utility, request-response with in-memory cache)

**Analog:** `/home/desachri/JobEngine/lib/statuses.mjs` (catalog cache pattern) + `scan.mjs` `fetchJson` (lines 116-126)

**In-memory Map cache** (lib/statuses.mjs lines 24, 78-83):
```javascript
const catalogCache = new Map();

export function getStatusCatalog(baseDir) {
  if (!catalogCache.has(baseDir)) {
    catalogCache.set(baseDir, buildCatalog(loadStates(baseDir)));
  }
  return catalogCache.get(baseDir);
}
```

**Fetch-with-timeout pattern** (scan.mjs lines 116-126):
```javascript
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
```

---

### `scrapers/role-matcher.mjs` (utility, transform)

**Analog:** `scan.mjs` lines 42-78 (`detectApi`) + lines 130-140 (`buildTitleFilter`)

**Import + reuse exports from scan.mjs directly** — these are already `export`ed:
```javascript
// scrapers/role-matcher.mjs
import { detectApi, buildTitleFilter } from '../scan.mjs';
```

**`buildTitleFilter` logic** (scan.mjs lines 130-140):
```javascript
export function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}
```

---

### `scrapers/tsv-writer.mjs` (utility, file I/O with header-on-first-create)

**Analog:** `scan.mjs` lines 265-277 (`appendToScanHistory`)

**Header-on-first-create pattern** (scan.mjs lines 265-277):
```javascript
export function appendToScanHistory(offers, date, { scanHistoryPath = SCAN_HISTORY_PATH } = {}) {
  // Ensure file + header exist
  if (!existsSync(scanHistoryPath)) {
    ensureParentDir(scanHistoryPath);
    writeFileSync(scanHistoryPath, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf-8');
  }

  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\tadded`
  ).join('\n') + '\n';

  appendFileSync(scanHistoryPath, lines, 'utf-8');
}
```

**Apply to:** `scrapers/tsv-writer.mjs` uses the same header-if-missing + tab-joined pattern but writes full (not append) via `writeFileAtomic` to allow dedup-and-rewrite. Columns per CONTEXT.md §Specifics: `firm\tcompany\tcareers_url\tfunding_signal\tfunding_date\trole_matches\tdiscovered_at\tpromoted\n`.

---

### `scrapers/health.mjs` (utility, JSON sidecar)

**Analog:** `/home/desachri/JobEngine/electron/src/main/services/mtime-cache.ts`

**Read-parse-snapshot pattern** (mtime-cache.ts lines 15-27, 40-44):
```typescript
async init(): Promise<void> {
  try {
    const raw = await fs.readFile(this.sidecarPath, 'utf-8')
    const json = JSON.parse(raw) as Record<string, unknown>
    for (const [p, mtimeMs] of Object.entries(json)) {
      if (typeof mtimeMs === 'number') {
        this.cache.set(p, { mtimeMs, content: '' })
      }
    }
  } catch {
    // Missing or corrupt — start fresh
  }
}

async persist(): Promise<void> {
  const snapshot: Record<string, number> = {}
  for (const [p, entry] of this.cache) snapshot[p] = entry.mtimeMs
  await writeFileAtomic(this.sidecarPath, JSON.stringify(snapshot, null, 2))
}
```

**Apply to:** `scrapers/health.mjs` exports `readHealth(path)` and `writeHealth(path, firmUpdates)`, merging per-firm records; always uses `write-file-atomic`; tolerates missing/corrupt file by starting fresh.

---

### `electron/src/main/ipc-handlers.ts` (extend, controller)

**Analog:** itself — same file has 3 direct examples.

**Imports + Zod schemas** (lines 1-22):
```typescript
import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'

const UpdateStatusSchema = z.object({
  num: z.number().int().positive(),
  newStatus: z.string().min(1).max(50),
})
const UrlSchema = z.string().url()
```

**Handler body pattern** for `runVcScrape` (lines 111-120 — exact copy):
```typescript
  ipcMain.handle('runVcScrape', async () => {
    const runId = startOp({
      kind: 'scrape',             // extend OpKind union — see process-runner.ts change
      command: 'node',
      args: ['scrape-vcs.mjs'],
      cwd: projectRoot,
      win,
    })
    return { runId }
  })
```

**Handler body pattern** for `promoteToPipeline` — zod-validated input + success/error shape (lines 50-53 + lines 60-68):
```typescript
  const PromoteSchema = z.object({
    company: z.string().min(1).max(200),
    careersUrl: z.string().url(),
  })

  ipcMain.handle('promoteToPipeline', async (_e, raw: unknown) => {
    try {
      const { company, careersUrl } = PromoteSchema.parse(raw)
      return await promoteToPipeline(pipelinePath, company, careersUrl, pendingGuiWrites)
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Invalid payload' }
    }
  })
```

**Handler for readVcCompanies / readVcHealth** — read-only file loader (lines 36-37):
```typescript
  ipcMain.handle('readVcCompanies', async () => parseVcTsv(path.join(projectRoot, 'data', 'vc-companies.tsv')))
  ipcMain.handle('readVcHealth', async () => readJsonFile(path.join(projectRoot, 'data', 'vc-health.json')))
```

**Handler for setVcScrapeInterval** — zod enum + reconfigure call (lines 79-83):
```typescript
  const IntervalSchema = z.enum(['weekly', 'monthly', 'manual-only'])

  ipcMain.handle('setVcScrapeInterval', async (_e, raw: unknown) => {
    const interval = IntervalSchema.parse(raw)
    await reconfigureScheduler(projectRoot, win, interval)
  })
```

---

### `electron/src/main/services/scheduler.ts` (new, service, event-driven)

**Analog (lifecycle):** `electron/src/main/services/process-runner.ts` + `preferences.ts`

**Module-level active task + init function pattern** (process-runner.ts lines 13, 24-74):
```typescript
const activeOps = new Map<string, OpRun>()
// ...
export function startOp(opts: StartOpOpts): string {
  // ...spawn...
  activeOps.set(runId, { kind: opts.kind, runId, child })
  return runId
}
```

**Preference-backed config read** (preferences.ts lines 14-25):
```typescript
async function load(): Promise<{ model: AllowedModel }> {
  const p = prefsPath()
  if (!existsSync(p)) return { model: DEFAULT_MODEL }
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const json = JSON.parse(raw)
    // ...validate...
    return { model }
  } catch {
    return { model: DEFAULT_MODEL }
  }
}
```

**Full scheduler.ts skeleton (from RESEARCH.md Pattern 2):**
```typescript
import cron, { type ScheduledTask } from 'node-cron'
import { preferences } from './preferences'
import { startOp } from './process-runner'
import type { BrowserWindow } from 'electron'

const EXPRESSIONS = {
  weekly:  '0 3 * * 1',   // Monday 03:00
  monthly: '0 3 1 * *',   // 1st of month 03:00
} as const

let activeTask: ScheduledTask | null = null

export async function initScheduler(
  projectRoot: string,
  win: BrowserWindow,
): Promise<void> {
  const interval = await preferences.getVcScrapeInterval()
  if (interval === 'manual-only') return

  activeTask = cron.schedule(EXPRESSIONS[interval], () => {
    startOp({ kind: 'scrape', command: 'node', args: ['scrape-vcs.mjs'], cwd: projectRoot, win })
  })
}

export async function reconfigureScheduler(
  projectRoot: string,
  win: BrowserWindow,
  newInterval: 'weekly' | 'monthly' | 'manual-only',
): Promise<void> {
  if (activeTask) { activeTask.stop(); activeTask = null }
  await preferences.setVcScrapeInterval(newInterval)
  if (newInterval !== 'manual-only') {
    activeTask = cron.schedule(EXPRESSIONS[newInterval], () => {
      startOp({ kind: 'scrape', command: 'node', args: ['scrape-vcs.mjs'], cwd: projectRoot, win })
    })
  }
}

export function stopScheduler(): void {
  if (activeTask) { activeTask.stop(); activeTask = null }
}
```

---

### `electron/src/main/services/preferences.ts` (extend)

**Analog:** itself (lines 27-41)

**Existing getter/setter pair pattern** (preferences.ts lines 27-41):
```typescript
export const preferences = {
  async getModel(): Promise<AllowedModel> {
    return (await load()).model
  },
  async setModel(model: string): Promise<void> {
    if (!ALLOWED_MODELS.includes(model as AllowedModel)) {
      throw new Error(`Unsupported model: ${model}`)
    }
    const current = await load()
    const next = { ...current, model }
    await writeFileAtomic(prefsPath(), JSON.stringify(next, null, 2))
  },
  // ADD THESE:
  async getVcScrapeInterval(): Promise<'weekly' | 'monthly' | 'manual-only'> {
    return (await load()).vcScrapeInterval ?? 'monthly'
  },
  async setVcScrapeInterval(interval: 'weekly' | 'monthly' | 'manual-only'): Promise<void> {
    const current = await load()
    const next = { ...current, vcScrapeInterval: interval }
    await writeFileAtomic(prefsPath(), JSON.stringify(next, null, 2))
  },
}
```

Extend the `load()` return type and the `ALLOWED_MODELS`-style validation with `const ALLOWED_INTERVALS = ['weekly', 'monthly', 'manual-only'] as const`.

---

### `electron/src/main/services/vc-firms.ts` (new, service, CRUD on YAML)

**Analog:** `electron/src/main/services/status-writer.ts` (lockfile + atomic write pattern)

**Lockfile-acquire + transform + atomic write** (status-writer.ts lines 14-72):
```typescript
import lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'
import { promises as fs } from 'fs'
import { GUI_WRITE_SUPPRESSION_MS } from './write-queue'

export async function addVcFirm(
  filePath: string,
  newFirm: { name: string; portfolio_url: string; keywords?: string[] },
  pendingGuiWrites: Set<string>,
): Promise<{ success: boolean; error?: string }> {
  let release: (() => Promise<void>) | null = null
  try {
    release = await lockfile.lock(filePath, {
      stale: 10_000,
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000, factor: 2 },
    })
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Lock acquisition timed out' }
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = yaml.load(content) as { firms?: any[] } ?? { firms: [] }
    parsed.firms = [...(parsed.firms ?? []), newFirm]
    const next = yaml.dump(parsed, { lineWidth: 120 })

    pendingGuiWrites.add(filePath)
    setTimeout(() => pendingGuiWrites.delete(filePath), GUI_WRITE_SUPPRESSION_MS)
    await writeFileAtomic(filePath, next)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'File system error' }
  } finally {
    if (release) await release()
  }
}
```

**Alternative — use the `lockAndWrite` helper** from `write-queue.ts` (simpler):
```typescript
import { lockAndWrite } from './write-queue'

export async function addVcFirm(filePath: string, newFirm: VcFirm, pendingGuiWrites: Set<string>) {
  await lockAndWrite(filePath, (current) => {
    const parsed = yaml.load(current) as { firms?: any[] } ?? { firms: [] }
    parsed.firms = [...(parsed.firms ?? []), newFirm]
    return yaml.dump(parsed, { lineWidth: 120 })
  }, pendingGuiWrites)
  return { success: true }
}
```

---

### `electron/src/main/services/promote.ts` (new, file I/O append)

**Analog:** `scan.mjs` `appendToPipeline` (lines 233-263) + `write-queue.ts` `lockAndWrite`

**Use `lockAndWrite` to wrap the scan.mjs logic** (write-queue.ts lines 11-31):
```typescript
import { lockAndWrite } from './write-queue'

export async function promoteToPipeline(
  pipelinePath: string,
  company: string,
  careersUrl: string,
  pendingGuiWrites: Set<string>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await lockAndWrite(pipelinePath, (current) => {
      const marker = '## Pendientes'
      const idx = current.indexOf(marker)
      const line = `- [ ] ${careersUrl} | ${company} | `
      if (idx === -1) {
        const procIdx = current.indexOf('## Procesadas')
        const insertAt = procIdx === -1 ? current.length : procIdx
        return current.slice(0, insertAt) + `\n${marker}\n\n${line}\n\n` + current.slice(insertAt)
      }
      const afterMarker = idx + marker.length
      const nextSection = current.indexOf('\n## ', afterMarker)
      const insertAt = nextSection === -1 ? current.length : nextSection
      return current.slice(0, insertAt) + '\n' + line + '\n' + current.slice(insertAt)
    }, pendingGuiWrites)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Write failed' }
  }
}
```

Note: the scan.mjs append format is `- [ ] ${url} | ${company} | ${title}` (3 pipe-separated fields). For promote, `title` is empty — preserves parser contract.

---

### `electron/src/main/watcher.ts` (extend)

**Analog:** itself (lines 13-17)

**`paths` array extension** (lines 13-17):
```typescript
const paths = [
  `${projectRoot}/data/applications.md`,
  `${projectRoot}/data/pipeline.md`,
  `${projectRoot}/reports`,
  // ADD:
  `${projectRoot}/data/vc-companies.tsv`,
  `${projectRoot}/data/vc-health.json`,
]
```

The existing debounce + `pendingGuiWrites` gate (lines 30-39) already covers the new paths.

---

### `electron/src/preload/types.ts` (extend)

**Analog:** itself (lines 91-125 `ElectronAPI` interface)

**Union-type extension for OpKind** (lines 49-62):
```typescript
export interface OpOutputPayload {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | 'scrape'  // ADD 'scrape'
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface OpDonePayload {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | 'scrape'  // ADD 'scrape'
  code: number | null
  signal: string | null
}
```

**New interface types for VC domain:**
```typescript
export interface VcCompany {
  firm: string
  company: string
  careers_url: string
  funding_signal: string
  funding_date: string
  role_matches: string
  discovered_at: string
  promoted: boolean
}
export interface VcFirmHealth {
  name: string
  last_run: string
  company_count: number
  baseline_count: number
  status: 'OK' | 'Stale' | 'Error'
  reason?: string
}
export interface VcFirmConfig {
  name: string
  portfolio_url: string
  keywords?: string[]
  enabled?: boolean
}
```

**ElectronAPI additions** (append to interface at lines 91-125):
```typescript
  // Phase 3 — VC discovery
  runVcScrape: () => Promise<{ runId: string }>
  readVcCompanies: () => Promise<VcCompany[]>
  readVcHealth: () => Promise<{ firms: VcFirmHealth[] }>
  promoteToPipeline: (company: string, careersUrl: string) => Promise<{ success: boolean; error?: string }>
  listVcFirms: () => Promise<VcFirmConfig[]>
  addVcFirm: (firm: { name: string; portfolioUrl: string; keywords?: string[] }) =>
    Promise<{ success: boolean; reachable: boolean; error?: string }>
  getVcScrapeInterval: () => Promise<{ interval: 'weekly' | 'monthly' | 'manual-only' }>
  setVcScrapeInterval: (interval: 'weekly' | 'monthly' | 'manual-only') => Promise<void>
```

---

### `electron/src/preload/index.ts` (extend)

**Analog:** itself (lines 13-47)

**Invoke-bridge pattern** (lines 34-38):
```typescript
  // Phase 3 — VC discovery
  runVcScrape: () => ipcRenderer.invoke('runVcScrape'),
  readVcCompanies: () => ipcRenderer.invoke('readVcCompanies'),
  readVcHealth: () => ipcRenderer.invoke('readVcHealth'),
  promoteToPipeline: (company, careersUrl) =>
    ipcRenderer.invoke('promoteToPipeline', { company, careersUrl }),
  listVcFirms: () => ipcRenderer.invoke('listVcFirms'),
  addVcFirm: (firm) => ipcRenderer.invoke('addVcFirm', firm),
  getVcScrapeInterval: () => ipcRenderer.invoke('getVcScrapeInterval'),
  setVcScrapeInterval: (interval) => ipcRenderer.invoke('setVcScrapeInterval', interval),
```

---

### `DiscoverPanel.tsx` (new, component)

**Analog:** `TrackerPanel.tsx`

**LoadState discriminated-union + fetch-with-cancel** (TrackerPanel.tsx lines 30-58):
```typescript
type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; companies: VcCompany[]; health: VcFirmHealth[] }

export function DiscoverPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const fetchData = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [companies, health] = await Promise.all([
        window.api.readVcCompanies(),
        window.api.readVcHealth(),
      ])
      setState({ kind: 'ready', companies, health: health.firms })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])
```

**Subscribe-to-filesChanged** (TrackerPanel.tsx lines 65-70):
```typescript
  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => { void fetchData() })
    return () => unsub()
  }, [fetchData])
```

**Loading / error / empty guards** (TrackerPanel.tsx lines 114-133):
```typescript
  if (state.kind === 'loading') return <EmptyState heading="Loading discoveries..." />
  if (state.kind === 'error') {
    return <ErrorState heading="Could not load discoveries" body={state.message} onRetry={() => void fetchData()} />
  }
  if (state.companies.length === 0) {
    return <EmptyState heading="No companies discovered yet" body="Click Run scan now in Settings to start the first VC scrape." />
  }
```

---

### `CompanyTable.tsx` + `CompanyRow.tsx` (new, virtualized table)

**Analog:** `TrackerPanel.tsx` lines 135-166 + `TrackerRow.tsx`

**Sticky header + FixedSizeList** (TrackerPanel.tsx lines 135-166):
```typescript
const ROW_HEIGHT = 32
const HEADER_HEIGHT = 36

return (
  <div className="flex flex-col h-full relative" role="grid" aria-rowcount={state.companies.length}>
    <div
      role="row"
      style={{ height: HEADER_HEIGHT }}
      className="flex items-center gap-2 px-2 bg-ctp-surface border-b border-ctp-overlay text-label text-ctp-subtext uppercase tracking-wider shrink-0"
    >
      <div role="columnheader" className="w-40">Company</div>
      <div role="columnheader" className="w-32">Firm</div>
      <div role="columnheader" className="w-[120px]">Funding Signal</div>
      <div role="columnheader" className="w-[120px]">Role Match</div>
      <div role="columnheader" className="w-[120px] text-center">Actions</div>
    </div>
    <div ref={listContainerRef} className="flex-1 min-h-0">
      <FixedSizeList
        height={listHeight} width="100%"
        itemCount={filtered.length}
        itemSize={ROW_HEIGHT}
        itemData={itemData}
        overscanCount={5}
      >
        {CompanyRow}
      </FixedSizeList>
    </div>
  </div>
)
```

**ResizeObserver for numeric height** (TrackerPanel.tsx lines 73-81):
```typescript
useLayoutEffect(() => {
  const el = listContainerRef.current
  if (!el) return
  const update = () => setListHeight(Math.max(0, el.clientHeight))
  update()
  const ro = new ResizeObserver(update)
  ro.observe(el)
  return () => ro.disconnect()
}, [state.kind])
```

**Row pattern** (TrackerRow.tsx lines 31-95):
```typescript
export function CompanyRow({ index, style, data }: ListChildComponentProps<CompanyRowItemData>) {
  const row = data.companies[index]
  if (!row) return null
  return (
    <div
      style={style}
      role="row"
      className="flex items-center gap-2 px-2 text-body text-ctp-text hover:bg-ctp-overlay border-b border-ctp-overlay/30"
    >
      <div role="gridcell" className="w-40 truncate" title={row.company}>{row.company}</div>
      <div role="gridcell" className="w-32 truncate text-ctp-subtext">{row.firm}</div>
      <div role="gridcell" className="w-[120px]"><FundingSignalBadge signal={row.funding_signal} /></div>
      <div role="gridcell" className="w-[120px]"><RoleMatchBadge matches={row.role_matches} /></div>
      <div role="gridcell" className="w-[120px] flex justify-center">
        {row.promoted
          ? <PromotedBadge />
          : <PromoteButton company={row.company} careersUrl={row.careers_url} onPromoted={data.onPromoted} />}
      </div>
    </div>
  )
}
```

---

### `VcDropAlertBanner.tsx` (new, banner)

**Analog:** `FileChangeBanner.tsx` (complete file, 22 lines)

**Full file to copy + modify** (FileChangeBanner.tsx lines 1-22):
```typescript
import { AlertTriangle } from 'lucide-react'

interface Props {
  visible: boolean
  affectedFirms: Array<{ firm: string; delta: number }>
  onDismiss: () => void
}

export function VcDropAlertBanner({ visible, affectedFirms, onDismiss }: Props) {
  if (!visible) return null
  const summary = affectedFirms.map(f => `${f.firm} (${f.delta > 0 ? '+' : ''}${f.delta}%)`).join(', ')
  return (
    <button
      type="button"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 h-10 w-full bg-ctp-peach/15 text-ctp-peach text-body cursor-pointer hover:bg-ctp-peach/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset"
    >
      <AlertTriangle size={14} aria-hidden="true" />
      <span>Firm counts dropped {'>'}20% vs. baseline: {summary} — click to dismiss</span>
    </button>
  )
}
```

Use `ctp-peach` (warning) per UI-SPEC rather than `ctp-yellow` so it's visually distinct from FileChangeBanner.

---

### `PromoteButton.tsx` (new, action button)

**Analog:** `VerifyButton.tsx`

Read VerifyButton.tsx pattern:

```typescript
// PromoteButton.tsx
import { useState } from 'react'
import { Send, Check, Loader2 } from 'lucide-react'

interface Props {
  company: string
  careersUrl: string
  onPromoted: (company: string) => void
}

export function PromoteButton({ company, careersUrl, onPromoted }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setState('working')
    setError(null)
    const result = await window.api.promoteToPipeline(company, careersUrl)
    if (result.success) {
      setState('idle')
      onPromoted(company)
    } else {
      setState('error')
      setError(result.error ?? 'Promote failed')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'working' || !careersUrl}
      className="text-ctp-blue hover:underline text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue rounded disabled:opacity-50"
      title={!careersUrl ? 'No careers URL' : error ?? 'Append to pipeline'}
    >
      {state === 'working' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      <span className="ml-1">Promote</span>
    </button>
  )
}
```

---

### `AddFirmModal.tsx` (new, modal dialog)

**Analog:** `SettingsSlideOver.tsx`

**Modal dialog scaffolding** (SettingsSlideOver.tsx lines 13-71):
```typescript
interface Props { open: boolean; onClose: () => void }

export function AddFirmModal({ open, onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [saving, setSaving] = useState(false)
  const [reachableWarning, setReachableWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSave = async (force = false) => {
    setSaving(true)
    const result = await window.api.addVcFirm({
      name,
      portfolioUrl,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
    })
    setSaving(false)
    if (!result.reachable && !force) {
      setReachableWarning(`Could not reach ${portfolioUrl}. Save anyway?`)
      return
    }
    if (result.success) { onAdded(); onClose() }
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Add VC Firm"
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="settings-panel">
        <header className="settings-panel__header">
          <h2 className="settings-panel__title">Add VC Firm</h2>
          <button type="button" className="settings-panel__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="settings-panel__body">
          {/* firm-name input, portfolio-URL input, keywords input, reachable-warning, Save + Cancel */}
        </div>
      </div>
    </div>
  )
}
```

---

### `Sidebar.tsx` (extend)

**Analog:** itself (lines 5, 15-21)

**Add 'discover' to PanelId + ITEMS** (lines 1-21):
```typescript
import { Table, FileText, Inbox, Zap, User, Compass, ChevronLeft, ChevronRight } from 'lucide-react'

export type PanelId = 'tracker' | 'pipeline' | 'reports' | 'evaluate' | 'cv' | 'discover'  // ADD

const ITEMS: Array<{ id: PanelId; label: string; icon: typeof Table }> = [
  { id: 'tracker', label: 'Tracker', icon: Table },
  { id: 'pipeline', label: 'Pipeline', icon: Inbox },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'evaluate', label: 'Evaluate', icon: Zap },
  { id: 'cv', label: 'CV', icon: User },
  { id: 'discover', label: 'Discover', icon: Compass },  // ADD — 6th entry
]
```

---

### `OpBadge.tsx` (extend)

**Analog:** itself (lines 1-7)

**Extend kind union + LABELS map** (lines 1-7):
```typescript
interface Props {
  kind: 'scan' | 'batch' | 'pdf' | 'scrape'  // ADD 'scrape'
  active: boolean
  code?: number | null
}
const LABELS: Record<string, string> = { scan: 'Scan', batch: 'Batch', pdf: 'PDF', scrape: 'Scrape' }
```

Add `op-badge--scrape` CSS class (same blue tint as scan per UI-SPEC).

---

### `App.tsx` (extend)

**Analog:** itself (lines 75-120)

**Add `discover` case to renderPanel switch** (lines 75-120):
```typescript
  case 'discover':
    return (
      <DiscoverPanel
        refreshKey={refreshKey}
        scrapeActive={scrapeActive}
        onRunScrape={handleRunScrape}
        onOpenAddFirm={() => setAddFirmOpen(true)}
      />
    )
```

**Add scrapeActive useMemo (lines 42-49 pattern):**
```typescript
const scrapeActive = useMemo(
  () => ops.ops.some((o) => o.kind === 'scrape' && o.endedAt === null),
  [ops.ops],
)
```

**Add handleRunScrape (lines 59-61 pattern):**
```typescript
const handleRunScrape = useCallback(async () => {
  await window.api.runVcScrape()
}, [])
```

---

### `VcScraperSection.tsx` (new, inside SettingsSlideOver)

**Analog:** `ModelSelect.tsx`

**Pattern:** Read `<select>` for interval (weekly/monthly/manual-only), `<button>` for "Run scan now" triggering `window.api.runVcScrape()`. Wired into `SettingsSlideOver.tsx` just below `<ModelSelect />` on line 66.

---

### `config/vc-firms.yml` (new, config)

**Analog:** `portals.yml` (tracked_companies shape) + `config/profile.example.yml`

**Shape from CONTEXT.md §Specifics + RESEARCH.md §Data Model:**
```yaml
# VC Portfolio Firms Configuration
# Used by scrape-vcs.mjs to discover portfolio companies across top VCs.
# Extend via the "Add Firm" button in the Discover panel, or edit manually here.

firms:
  - name: a16z
    portfolio_url: https://a16z.com/portfolio/
    keywords: []
  - name: Sequoia
    portfolio_url: https://www.sequoiacap.com/our-companies/
    keywords: []
  - name: Benchmark
    portfolio_url: ""        # no public portfolio page; add mirror URL or leave disabled
    keywords: []
    enabled: false
  # ...7 more defaults...
```

---

### `data/vc-companies.tsv` (new, data)

**Analog:** `data/scan-history.tsv`

**Header on line 1 (CONTEXT.md §Specifics):**
```
firm	company	careers_url	funding_signal	funding_date	role_matches	discovered_at	promoted
```

---

### `data/vc-health.json` (new, data)

**Analog:** `data/.mtime-cache.json` (same sidecar JSON pattern, `write-file-atomic`)

**Shape (RESEARCH.md §Data Model):**
```json
{
  "firms": [
    {
      "name": "a16z",
      "last_run": "2026-04-22T03:00:00.000Z",
      "company_count": 78,
      "baseline_count": 85,
      "status": "Stale"
    }
  ]
}
```

---

## Shared Patterns

### Auth / Secrets
Not applicable — Phase 3 introduces no new API keys. Existing `keyStore` (electron/src/main/services/key-store.ts) is untouched. Source: key-store.ts lines 10-48 (reference only).

### Error Handling — IPC Result Shape

**Source:** `electron/src/main/services/status-writer.ts` lines 8-12; `ipc-handlers.ts` lines 60-68

**Apply to:** All new IPC handlers that mutate files (`promoteToPipeline`, `addVcFirm`, `setVcScrapeInterval`).

```typescript
// Standard success/error shape
export interface StatusUpdateResult { success: boolean; error?: string; message?: string }

// In handler:
ipcMain.handle('channelName', async (_e, raw: unknown) => {
  try {
    const parsed = Schema.parse(raw)
    return await serviceFunction(parsed)
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Operation failed' }
  }
})
```

### File Writes — Lockfile + Atomic + Suppression

**Source:** `electron/src/main/services/write-queue.ts` lines 9-31 (`lockAndWrite` + `GUI_WRITE_SUPPRESSION_MS`)

**Apply to:** Every main-process write to `data/pipeline.md`, `config/vc-firms.yml`, `data/vc-companies.tsv`, `data/vc-health.json`.

```typescript
import { lockAndWrite } from './write-queue'

await lockAndWrite(filePath, (current) => {
  // transform current → next
  return next
}, pendingGuiWrites)
```

Never call `fs.writeFileSync` from main-process handlers; always route through `lockAndWrite` so the FileChangeBanner is suppressed and writes are atomic.

### Validation — Zod on all IPC boundaries

**Source:** `ipc-handlers.ts` lines 15-22

**Apply to:** Every `ipcMain.handle(channel, async (_e, raw: unknown) => { ... })` — parse `raw` with a Zod schema before touching the filesystem. Schemas per RESEARCH.md §IPC Contract:
- `PromoteSchema = z.object({ company: z.string().min(1), careersUrl: z.string().url() })`
- `VcFirmSchema = z.object({ name: z.string().min(1), portfolioUrl: z.string().url(), keywords: z.array(z.string()).optional() })`
- `IntervalSchema = z.enum(['weekly', 'monthly', 'manual-only'])`

### File watcher — extend paths array

**Source:** `electron/src/main/watcher.ts` lines 13-17

**Apply to:** `data/vc-companies.tsv` and `data/vc-health.json`. No other changes to `watcher.ts` — the existing debounce + pendingGuiWrites + `files-changed` emit cover the new paths automatically.

### Child-process subprocess — reuse startOp

**Source:** `electron/src/main/services/process-runner.ts` lines 24-74

**Apply to:** `runVcScrape` handler. Extend `OpKind` on line 5 to include `'scrape'`. Handler body is a near-exact copy of the existing `runScan` handler (ipc-handlers.ts lines 111-120).

### Badge component pattern (stateless pill)

**Source:** `electron/src/renderer/components/ScoreBadge.tsx` + `StatusBadge.tsx` + `OpBadge.tsx`

**Apply to:** `FundingSignalBadge.tsx`, `RoleMatchBadge.tsx`, `PromotedBadge.tsx`, `HealthStatusDot.tsx`. Small pure component, `data-testid` + color-class-by-value pattern.

### Empty / error states

**Source:** `electron/src/renderer/components/EmptyState.tsx` + `ErrorState.tsx`

**Apply to:** DiscoverPanel, ScraperHealthPanel, CompanyTable. Every load-state machine returns one of `<EmptyState heading=... body=... />`, `<ErrorState heading=... body=... onRetry={...} />`, or the ready view.

### Panel renders inside App.tsx renderPanel switch

**Source:** `App.tsx` lines 75-120

**Apply to:** `DiscoverPanel` becomes a new `case 'discover'` in the switch. Panel is full-viewport (no SplitPaneLayout wrapper — analogous to PipelinePanel and CvPanel).

## No Analog Found

None. All 29 new/modified files map to a concrete existing analog in the codebase (8 within `scan.mjs`, 10 within `electron/src/main/`, 10 within `electron/src/renderer/components/`, 1 across `data/.mtime-cache.json`).

## Metadata

**Analog search scope:**
- `/home/desachri/JobEngine/scan.mjs` (primary CLI scraper analog)
- `/home/desachri/JobEngine/lib/statuses.mjs` (YAML load + cache pattern)
- `/home/desachri/JobEngine/portals.yml` (YAML config shape)
- `/home/desachri/JobEngine/electron/src/main/ipc-handlers.ts` (IPC handler patterns)
- `/home/desachri/JobEngine/electron/src/main/services/*.ts` (7 service files: process-runner, preferences, status-writer, write-queue, mtime-cache, key-store, evaluation-service)
- `/home/desachri/JobEngine/electron/src/main/watcher.ts` (chokidar watcher)
- `/home/desachri/JobEngine/electron/src/main/parsers/pipeline.ts` (markdown parser reference)
- `/home/desachri/JobEngine/electron/src/preload/types.ts` + `index.ts` (IPC surface)
- `/home/desachri/JobEngine/electron/src/renderer/App.tsx` (panel routing)
- `/home/desachri/JobEngine/electron/src/renderer/components/*.tsx` (28 components: Sidebar, NavItem, TrackerPanel, TrackerRow, PipelinePanel, ReportsPanel, EvaluatePanel, CvPanel, FileChangeBanner, OperationsLogDrawer, OpBadge, SettingsSlideOver, ModelSelect, VerifyButton, ScoreBadge, StatusBadge, EmptyState, ErrorState, others)

**Files read:** 23
**Pattern extraction date:** 2026-04-22
