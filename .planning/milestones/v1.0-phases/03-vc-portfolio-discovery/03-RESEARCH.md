# Phase 3: VC Portfolio Discovery - Research

**Researched:** 2026-04-22
**Domain:** Node.js web scraping (Playwright + Cheerio fallback) + Electron integration (node-cron scheduler, child_process.fork, IPC, YAML persistence) + SPA DOM adapters for 10 VC portfolio sites
**Confidence:** HIGH for stack, patterns, Electron integration; MEDIUM for per-firm DOM adapters (9 of 10 probed); LOW for funding-signal heuristics (deferred to runtime A/B).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scraper Implementation**
- **D-01:** Per-firm scraping strategy: Playwright headless browser — handles SPAs and Next.js portfolio sites (most firms); a16z + Sequoia confirmed static and also supported. Playwright is already a project dependency (PDF generation).
- **D-02:** Funding signal source: RSS/press release heuristics — probe firm blog feeds and news search for "{company} funding" within the last 12 months. No API key required. Crunchbase API deferred to v3+.
- **D-03:** Request serialization: Fully serialized with random 500ms–2000ms delays between requests. Simple implementation, respects robots.txt spirit, no rate-limit risk.
- **D-04:** Per-firm health baseline stored in separate `data/vc-health.json` — tracks `{ firm, last_run, company_count, baseline_count }` per firm. Keeps TSV clean; health data can be read independently.

**GUI Discovery View**
- **D-05:** Panel placement: New 6th sidebar item "Discover" — dedicated full-viewport panel.
- **D-06:** Table columns: Company | Firm | Funding Signal | Role Match | Actions.
- **D-07:** Default filter state: Pre-filtered to funded + role-matched; toggle to "All".
- **D-08:** Per-row inline "Promote" button that appends to `data/pipeline.md` via IPC (proper-lockfile + write-file-atomic). Row transitions to "Promoted ✓" badge; promoted flag persisted in `data/vc-companies.tsv`.

**Scraper Health & Scheduling**
- **D-09:** Monthly cadence via node-cron in Electron main process; also triggerable manually from Discover panel / Settings.
- **D-10:** Health panel embedded in Discover panel header, collapsed by default.
- **D-11:** Banner at top of Discover panel when any firm's count drops >20% from baseline (same tint pattern as Phase 1 FileChangeBanner). Dismissible per session.
- **D-12:** Settings slide-over gets a new "VC Scraper" section — interval selector (weekly / monthly / manual-only) + "Run now" button.

**VC Firm Management (VC-06)**
- **D-13:** "Add Firm" modal triggered from Discover panel header.
- **D-14:** Storage target: New `config/vc-firms.yml` (not `portals.yml`).
- **D-15:** Required form fields: Firm name + portfolio page URL + optional role keywords.
- **D-16:** HEAD request reachability check before persisting; user can override on failure ("Save anyway").

### Claude's Discretion

- Exact Playwright adapter strategy per firm (CSS selectors vs. text extraction vs. structured data scraping)
- Shared adapter interface vs. firm-specific strategy classes
- Exact CSS/layout for the Discover panel (column widths, badge colors, row styling)
- Health panel expand/collapse animation style
- Whether "Add Firm" modal includes a preview scrape — nice-to-have if straightforward

### Deferred Ideas (OUT OF SCOPE)

- Crunchbase API for funding signals (v3+)
- Batch promote (select multiple → promote all) — per-row is sufficient
- Interview prep panel (v3+)
- Electron auto-update (v2.1)
- Preview scrape in "Add Firm" modal (nice-to-have, Claude's discretion)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VC-01 | Scrape 10 VC firms via standalone `scrape-vcs.mjs`, runnable from CLI and Electron GUI; output to `data/vc-companies.tsv` | Playwright adapter architecture (§ Architecture Patterns); per-firm DOM probe results (§ Per-Firm Adapter Notes); `scan.mjs` TSV-writer pattern reused verbatim |
| VC-02 | Monthly cadence, respects robots.txt, serialized with delays, per-firm baseline for drop alerts | node-cron 4.2 in Electron main with `createTask`+persisted config (§ Scheduler); `robots-parser` npm library (§ Standard Stack); random 500–2000ms delay per D-03 |
| VC-03 | Filter to funding <12 months AND active job listings matching target roles from `config/profile.yml` | RSS/press-release heuristics for funding (§ Funding Signal Heuristics); reuse `detectApi`+`buildTitleFilter` from `scan.mjs` for active listings matching (§ Role-Match Pipeline) |
| VC-04 | GUI discovery view with company rows + Promote button appending careers URL to `data/pipeline.md` | DiscoverPanel follows TrackerPanel pattern (§ Electron Integration); pipeline append uses existing `scan.mjs` `appendToPipeline()` helper or inline IPC with proper-lockfile + write-file-atomic |
| VC-05 | Scraper health panel — per-firm last-run, count, >20% drop alert | `data/vc-health.json` sidecar loaded by new IPC handler; baseline rule established on second successful run (§ Health Model) |
| VC-06 | Add new VC firm from GUI; persisted to `config/vc-firms.yml`; included in next scrape | HEAD probe via `fetch(url, { method: 'HEAD' })` from main process; js-yaml dump + `proper-lockfile`/`write-file-atomic` write (§ Add-Firm Flow) |
</phase_requirements>

## Summary

Phase 3 adds a VC portfolio discovery pipeline on top of the existing Electron + Node scraper substrate. The phase consists of four self-contained layers that compose cleanly:

1. **`scrape-vcs.mjs`** — a new standalone Node ESM script at the repo root (same pattern as `scan.mjs`). It loads `config/vc-firms.yml`, iterates the 10 built-in firms plus any user additions, runs a per-firm adapter (Playwright headless browser, since 5 of 10 firms are SPAs), serializes requests with random 500–2000ms delays, honors `robots.txt` via `robots-parser`, probes funding-signal heuristics via blog RSS + Google News queries, deduplicates against existing rows, and atomically writes `data/vc-companies.tsv` and `data/vc-health.json`.
2. **Electron main-process surface** — new IPC handlers (`runVcScrape`, `readVcCompanies`, `readVcHealth`, `promoteToPipeline`, `listVcFirms`, `addVcFirm`, `getVcScrapeInterval`, `setVcScrapeInterval`) and a `node-cron` scheduler initialized at app-ready time and reconfigured on interval change.
3. **Renderer** — `DiscoverPanel` (6th sidebar entry), `CompanyTable` with react-window virtualization, `ScraperHealthPanel` accordion, `VcDropAlertBanner`, `AddFirmModal`, and a `VcScraperSection` appended to the existing Settings slide-over.
4. **Data contract** — three new files: `data/vc-companies.tsv` (8 columns per D-specifics), `data/vc-health.json` (per-firm status sidecar), and `config/vc-firms.yml` (shipped with 10 defaults, user-extensible).

The dominant risks are (a) **SPA variance** — 5 of 10 firms are JavaScript-rendered, two are paginated, one (Benchmark) has no first-party portfolio page so it must be sourced elsewhere or omitted with a graceful fallback, and (b) **funding heuristics will be noisy** — RSS/press-release probing is string-matching, not structured data, so the "Funded" badge must be labeled as a signal, not a fact. Scheduling is straightforward: node-cron 4.x is pure JS, has no native dependencies, and composes cleanly with an Electron main process as long as we persist the interval config ourselves (node-cron has no built-in persistence).

**Primary recommendation:** Build an adapter-per-firm architecture (one file per firm in `scrapers/adapters/`) behind a shared `Adapter` interface (`scrape(browserContext): Promise<Company[]>`). Ship Playwright for all 10 (acceptable — Playwright is already bundled, and Cheerio offers no meaningful gains here since the static firms still return simple pages). For Benchmark (no public portfolio page), emit a one-line adapter that returns `[]` and logs "Benchmark has no public portfolio page — configure a data source manually in config/vc-firms.yml to enable." Users can still add Benchmark via Add Firm modal with a third-party mirror URL if desired.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| VC portfolio scraping (HTTP + headless browser) | Standalone Node ESM script (child_process) | Electron main (spawn + stream logs) | Long-running, network-heavy, Playwright can't run in sandboxed renderer. Mirrors `scan.mjs` + `generate-pdf.mjs` from Phase 2. |
| Scrape scheduling (node-cron) | Electron main process | — | Node-cron is pure JS and runs only while app is alive. Acceptable for a desktop app; user explicitly accepted monthly cadence that tolerates app-off gaps. |
| File I/O (TSV / YAML / JSON writes) | Electron main process (GUI path) | scrape-vcs.mjs (CLI path) | Both writers use proper-lockfile + write-file-atomic. GUI path sets `pendingGuiWrites` flag to suppress FileChangeBanner (Phase 2 pattern). |
| robots.txt enforcement | scrape-vcs.mjs (per-firm, before each request) | — | Scraping concern lives with the scraper; `robots-parser` fetches once per firm, caches in-memory. |
| Company table rendering | Electron renderer (React + react-window) | — | Same as TrackerPanel — virtualized list for datasets of 500+ companies. |
| Filter logic (Matched / All) | Renderer | — | Filter state is UI state; the raw TSV is the source of truth, renderer filters client-side. |
| Role-match check | Electron main (read `config/profile.yml` once, expose matched keywords to renderer) or scraper (compute at scrape time, persist in TSV) | — | **Decision needed during planning.** Recommend: compute at scrape time so the `role_matches` TSV column is authoritative and the renderer stays dumb. |
| Funding-signal detection | scrape-vcs.mjs | — | Heuristic probes (RSS + news query) happen during scrape, cached in TSV `funding_signal` + `funding_date` columns. |
| Pipeline append (Promote) | Electron main (IPC handler) | — | Small file write with lockfile; renderer fires IPC and updates local row state optimistically. |
| Health panel | Renderer reads `data/vc-health.json` via IPC | Scraper writes health data per-firm post-run | Sidecar pattern keeps health data orthogonal to the companies TSV. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `playwright` | `^1.59.1` | Headless browser for SPA portfolio pages (Sequoia, a16z "Load All", Accel, General Catalyst, Coatue dynamic tail, Lightspeed filters) | Already a project dependency from `generate-pdf.mjs`. Official docs confirm `__NEXT_DATA__` extraction pattern for Next.js-based sites. `[VERIFIED: npm view playwright version → 1.59.1]` |
| `node-cron` | `^4.2.1` | Scheduler for monthly scraper runs in Electron main | Pure JavaScript, no native deps, ESM support (`import cron from 'node-cron'`). `[VERIFIED: npm view node-cron version → 4.2.1, time.modified 2026-03-18]` |
| `robots-parser` | `^3.0.1` | RFC 9309-compliant robots.txt parser — `isAllowed(url, userAgent)`, `getCrawlDelay(userAgent)` | Widely adopted, simple API, wildcard support. `[VERIFIED: npm view robots-parser version → 3.0.1]` |
| `js-yaml` | `^4.1.1` | Load/dump `config/vc-firms.yml` | Already in both root and electron/ package.json. `[VERIFIED: grep package.json]` |
| `proper-lockfile` | `^4.1.2` | Lock `data/pipeline.md`, `data/vc-companies.tsv`, `config/vc-firms.yml` during writes | Already in use (Phase 2 `status-writer.ts`). `[VERIFIED: grep]` |
| `write-file-atomic` | `^7.0.1` | Atomic writes for same files | Already in use (Phase 2). `[VERIFIED: grep electron/package.json]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-window` | `1.8.10` | Virtualized company table in DiscoverPanel | Already in Phase 1 for TrackerPanel — reuse verbatim when company count > 100 |
| `chokidar` | `^5.0.0` | File watcher extension — watch `data/vc-companies.tsv` + `data/vc-health.json` in Phase 3 | Already running in Phase 2 for `data/applications.md` and `data/pipeline.md`. Extend the existing `watcher.ts` watch list. |
| `lucide-react` | `^0.511.0` | Icons: `Compass` (sidebar), `AlertTriangle` (drop banner), `Plus` (Add Firm), `Loader2` (in-flight), `Send` (Promote), `Check` (Promoted), `Play` (Run scan now), `ChevronDown/Up` (health accordion), `X` (modal close) | Already Phase 2 standard |
| `zod` | `^3.25.76` | Validate IPC payloads for new channels (VcFirmSchema, PromoteSchema, VcIntervalSchema) | Already in use — all IPC in Phase 2 uses it |

### NOT Needed (explicit exclusions)

| Library | Why excluded |
|---------|--------------|
| `cheerio` / `undici` | SUMMARY.md proposed these for static pages; per-firm research shows 5 of 10 firms are SPAs and Playwright handles both cases uniformly. Adding Cheerio would mean maintaining two code paths per adapter for marginal perf gain (a headless browser cold-start is ~1–2s; the whole scrape is serialized with 500–2000ms delays anyway). Ship Playwright-only for simplicity. `[ASSUMED]` — validated in planning by running both paths on a16z if benchmarks reveal >5× delta. |
| `node-schedule` | Per npm comparisons, node-cron 4.x has the smaller surface area and same functional coverage for our use case (fixed intervals, not complex date math). `[CITED: pkgpulse.com node-cron vs node-schedule comparison]` |
| `agenda` / `bree` | DB-backed job queues — overkill for a single-user desktop app with no multi-host durability requirement. `[CITED: github.com/node-cron/node-cron issue #340]` |
| `puppeteer` | Playwright supersedes it and is already installed. `[CITED: Phase research SUMMARY.md]` |
| Crunchbase API | Deferred by decision; paid key, v3+. `[CITED: CONTEXT.md Deferred]` |

### Installation

```bash
# From electron/ directory (Electron main-process deps)
npm install node-cron robots-parser
npm install --save-dev @types/node-cron

# Root package.json needs the same two packages so scrape-vcs.mjs works standalone from CLI
cd .. && npm install node-cron robots-parser
# (playwright and js-yaml are already in root package.json)
```

**Version verification:**

```bash
npm view node-cron version       # → 4.2.1 (verified 2026-04-22)
npm view robots-parser version   # → 3.0.1 (verified 2026-04-22)
npm view playwright version      # → 1.59.1 (verified 2026-04-22)
npm view js-yaml version         # → 4.1.1 (already installed)
```

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────┐
                     │   Electron Main Process             │
                     │                                     │
  Sidebar click ───▶ │  IPC: runVcScrape                   │
  "Run scan now" ──▶ │  Scheduler (node-cron, monthly)     │
                     │        │                            │
                     │        ▼ child_process.spawn        │
                     │   ┌─────────────────────────┐       │
                     │   │   scrape-vcs.mjs        │       │
                     │   │   (child process)       │       │
                     │   └────────────┬────────────┘       │
                     │                │                    │
                     │         stdout/stderr (line-by-line)│
                     │                │                    │
                     │        webContents.send             │
                     │        "op:output" / "op:done"      │
                     │                │                    │
                     └────────────────┼────────────────────┘
                                      │
                     ┌────────────────▼────────────────────┐
                     │   Renderer (React)                  │
                     │                                     │
                     │  OperationsLogDrawer (Scrape tab)   │
                     │  DiscoverPanel                      │
                     │    ├─ VcDropAlertBanner             │
                     │    ├─ Header (Filter + Add Firm)    │
                     │    ├─ ScraperHealthPanel (accordion)│
                     │    └─ CompanyTable                  │
                     │          └─ PromoteButton ─▶ IPC    │
                     │                                     │
                     │  SettingsSlideOver                  │
                     │    └─ VcScraperSection              │
                     │         ├─ Interval <select>        │
                     │         └─ Run scan now button      │
                     └─────────────────────────────────────┘

  ─────────────────────────────────────────────────────────────

                       scrape-vcs.mjs (data flow)

  config/vc-firms.yml ──▶ loadFirms()
                                │
                                ▼
                   for each firm (serial, 500–2000ms delay):
                     ├─ robots-parser: isAllowed(portfolio_url)
                     ├─ PlaywrightAdapter.scrape(browserCtx)
                     │     └─ returns [{ name, careers_url }]
                     ├─ FundingDetector.probe(company)
                     │     ├─ firm blog RSS (last 12 months)
                     │     └─ Google News query "company funding"
                     │     └─ returns { signal, date }
                     ├─ RoleMatcher.match(company, targetRoles)
                     │     └─ ATS-API probe (reuse detectApi/parse
                     │        from scan.mjs) → check title_filter
                     └─ dedup(existing TSV rows)
                                │
                                ▼
        writeFileAtomic(data/vc-companies.tsv) + (data/vc-health.json)
```

### Recommended Project Structure

```
JobEngine/
├── scrape-vcs.mjs              # NEW — root ESM entry point (mirrors scan.mjs)
├── scrapers/                   # NEW folder — adapter code used by scrape-vcs.mjs
│   ├── adapters/
│   │   ├── a16z.mjs
│   │   ├── sequoia.mjs
│   │   ├── benchmark.mjs       # stub adapter (no public portfolio page — logs & returns [])
│   │   ├── accel.mjs
│   │   ├── general-catalyst.mjs
│   │   ├── coatue.mjs
│   │   ├── founders-fund.mjs
│   │   ├── khosla.mjs
│   │   ├── index-ventures.mjs
│   │   ├── lightspeed.mjs
│   │   └── index.mjs           # adapter registry: { firmName → adapter }
│   ├── funding-detector.mjs    # RSS + news query heuristics
│   ├── role-matcher.mjs        # reuses detectApi + buildTitleFilter from scan.mjs
│   ├── robots.mjs              # thin robots-parser wrapper w/ in-memory cache
│   └── health.mjs              # reads/writes data/vc-health.json
├── config/
│   └── vc-firms.yml            # NEW — ships with 10 defaults; user-editable via modal
├── data/
│   ├── vc-companies.tsv        # NEW — scraper output
│   └── vc-health.json          # NEW — per-firm status sidecar
├── electron/src/main/
│   ├── services/
│   │   └── scheduler.ts        # NEW — node-cron wrapper, reads interval from preferences
│   └── ipc-handlers.ts         # EXTEND — new VC channels (see IPC Contract below)
└── electron/src/renderer/components/
    ├── DiscoverPanel.tsx       # NEW
    ├── VcDropAlertBanner.tsx   # NEW
    ├── DiscoverFilterToggle.tsx # NEW
    ├── ScraperHealthPanel.tsx  # NEW
    ├── HealthStatusDot.tsx     # NEW
    ├── CompanyTable.tsx        # NEW
    ├── CompanyRow.tsx          # NEW
    ├── FundingSignalBadge.tsx  # NEW
    ├── RoleMatchBadge.tsx      # NEW
    ├── PromoteButton.tsx       # NEW
    ├── PromotedBadge.tsx       # NEW
    ├── AddFirmButton.tsx       # NEW
    ├── AddFirmModal.tsx        # NEW
    └── VcScraperSection.tsx    # NEW — appended into SettingsSlideOver
```

### Pattern 1: Adapter Interface (per-firm scraper)

**What:** One file per firm exports a default async function that takes a Playwright `BrowserContext` and returns `Company[]`. All firms share the same shape so `scrape-vcs.mjs` loops uniformly.

**When to use:** Every new firm, including user-added firms (which use a generic fallback adapter).

**Example:**
```javascript
// Source: adapter pattern derived from the existing `scan.mjs` parser-per-ATS model (greenhouse, ashby, lever)
// scrapers/adapters/a16z.mjs

/**
 * Adapter for a16z portfolio page.
 *
 * URL: https://a16z.com/portfolio/
 * Type: JS-rendered list with "Load All" button (verified 2026-04-22)
 * Robots: no disallow, no crawl-delay (verified 2026-04-22)
 */
export default async function scrape(context, { log }) {
  const page = await context.newPage();
  await page.goto('https://a16z.com/portfolio/', { waitUntil: 'networkidle' });

  // Click "Load All" if present — reveals the full list
  const loadAll = page.locator('button:has-text("Load All")').first();
  if (await loadAll.isVisible().catch(() => false)) {
    await loadAll.click();
    await page.waitForTimeout(1500);
  }

  // Extract company cards — selectors TBD during plan-task (DOM probing)
  const companies = await page.$$eval(
    '[data-portfolio-company], .portfolio-company',  // best-guess, verify in planning
    (nodes) => nodes.map((n) => ({
      name: n.querySelector('h3, .company-name')?.textContent?.trim() ?? '',
      careers_url: n.querySelector('a[href*="careers"], a[href*="jobs"]')?.href ?? '',
      website: n.querySelector('a[rel="external"]')?.href ?? '',
    })),
  );

  await page.close();
  return companies.filter((c) => c.name);
}
```

### Pattern 2: node-cron 4.x Scheduler in Electron Main

**What:** Pure-JavaScript cron scheduler. Task is created once at app-ready, can be started/stopped/destroyed; no built-in persistence — we persist the interval selection ourselves in the existing `preferences.json` (same file Phase 2 uses for model selection).

**When to use:** For the "monthly" / "weekly" / "manual-only" interval selector.

**Example:**
```typescript
// Source: github.com/node-cron/node-cron README + npm docs (verified 2026-04-22)
// electron/src/main/services/scheduler.ts

import cron, { type ScheduledTask } from 'node-cron';
import { preferences } from './preferences';
import { startOp } from './process-runner';
import type { BrowserWindow } from 'electron';

const EXPRESSIONS = {
  weekly:  '0 3 * * 1',   // Monday 03:00
  monthly: '0 3 1 * *',   // 1st of month 03:00
} as const;

let activeTask: ScheduledTask | null = null;

export async function initScheduler(
  projectRoot: string,
  win: BrowserWindow,
): Promise<void> {
  const interval = await preferences.getVcScrapeInterval(); // "weekly" | "monthly" | "manual-only"
  if (interval === 'manual-only') return;

  // node-cron 4.x: cron.schedule() starts immediately; use createTask for deferred start
  activeTask = cron.schedule(EXPRESSIONS[interval], () => {
    startOp({
      kind: 'scrape',
      command: 'node',
      args: ['scrape-vcs.mjs'],
      cwd: projectRoot,
      win,
    });
  });
}

export async function reconfigureScheduler(
  projectRoot: string,
  win: BrowserWindow,
  newInterval: 'weekly' | 'monthly' | 'manual-only',
): Promise<void> {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }
  await preferences.setVcScrapeInterval(newInterval);
  if (newInterval !== 'manual-only') {
    activeTask = cron.schedule(EXPRESSIONS[newInterval], () => {
      startOp({ kind: 'scrape', command: 'node', args: ['scrape-vcs.mjs'], cwd: projectRoot, win });
    });
  }
}
```

### Pattern 3: robots.txt Check Before Each Request

**What:** Fetch each firm's `robots.txt` once per scrape run, cache the parsed result, and check every URL before request.

**Example:**
```javascript
// Source: github.com/samclarke/robots-parser (verified 2026-04-22)
// scrapers/robots.mjs

import robotsParser from 'robots-parser';
import { setTimeout } from 'timers/promises';

const USER_AGENT = 'JobEngineBot/1.0 (+https://github.com/santifer/career-ops)';
const robotsCache = new Map();

export async function checkAllowed(url) {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    let body = '';
    try {
      const res = await fetch(robotsUrl);
      body = res.ok ? await res.text() : '';
    } catch {
      body = '';
    }
    robotsCache.set(origin, robotsParser(robotsUrl, body));
  }
  const parser = robotsCache.get(origin);
  return {
    allowed: parser.isAllowed(url, USER_AGENT) ?? true,
    crawlDelay: parser.getCrawlDelay(USER_AGENT),
  };
}

export async function randomDelay(min = 500, max = 2000) {
  const ms = min + Math.floor(Math.random() * (max - min));
  await setTimeout(ms);
}
```

### Pattern 4: Reuse Phase 2 `process-runner.ts` for scraper spawn

The existing `startOp({ kind, command, args, cwd, win })` helper already streams stdout/stderr to the renderer via `op:output` / `op:done` events. Phase 3 needs only:

1. Extend `OpKind = 'scan' | 'batch' | 'pdf' | 'scrape'` in `process-runner.ts`.
2. Extend `OpOutputPayload.kind` and `OpDonePayload.kind` types in `preload/types.ts`.
3. Add a new `op-badge--scrape` CSS class in `OpBadge` (same blue as scan, per UI-SPEC).
4. Add a new IPC handler `runVcScrape` that calls `startOp({ kind: 'scrape', command: 'node', args: ['scrape-vcs.mjs'], cwd: projectRoot, win })` — a near-identical copy of the existing `runScan` handler.

No new child-process plumbing is needed — the Phase 2 operations log drawer already handles a new `Scrape` tab automatically once `kind: 'scrape'` appears.

### Anti-Patterns to Avoid

- **Running Playwright in the renderer.** Never. Playwright launches Chromium — must be in a Node child process. Our scraper runs as `child_process.spawn('node', ['scrape-vcs.mjs'])`, same as `scan.mjs`.
- **Direct writes to `data/pipeline.md` from the renderer.** All writes go through IPC → main process → proper-lockfile + write-file-atomic. Phase 2 already enforces this via the `pendingGuiWrites` set.
- **Skipping the robots.txt check "because 500–2000ms delays are polite enough."** Respecting robots.txt is part of the ethical contract in `CLAUDE.md`. If any firm disallows scraping its portfolio path, the adapter must log and skip.
- **Rewriting `config/vc-firms.yml` without lockfile.** Two paths write this: Add Firm modal (GUI) and manual edits (CLI). Use proper-lockfile.
- **Hardcoding the 10 firms in `scrape-vcs.mjs` source.** They MUST live in `config/vc-firms.yml` as the shipped default so users can edit them via the Add Firm modal, disable firms, or override URLs.
- **Computing role-match client-side on every render.** Do it once at scrape time, persist in `role_matches` TSV column, render reads the column.
- **Using node-cron's `cron.schedule` in "scheduled: false" mode and expecting node-cron to remember the schedule across app restarts.** It won't — there's no disk persistence. Persist the interval choice ourselves in `preferences.json` and re-initialize the task on app-ready.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parse `robots.txt` | Regex-based matching | `robots-parser` (RFC 9309 compliant) | Wildcards, user-agent groups, allow-order rules, crawl-delay parsing — these are subtle and error-prone |
| Cron-expression scheduling | `setInterval` with manual "monthly" logic | `node-cron` 4.x | Month-length variance, DST, "1st of month" semantics — use the library |
| Atomic file writes | `fs.writeFileSync` | `write-file-atomic` | Temp-file + rename guarantees no partial writes. Already used in Phase 2. |
| Multi-process file locking | Custom `.lock` files | `proper-lockfile` | Stale-lock detection, retry-with-backoff. Already used in Phase 2. |
| Parse Next.js `__NEXT_DATA__` | Regex-extract `<script id="__NEXT_DATA__">`  | `page.evaluate(() => JSON.parse(document.getElementById('__NEXT_DATA__').textContent))` | Playwright has page context — use DOM APIs, not regex. `[CITED: oxylabs.io Playwright tutorial 2026]` |
| TSV read/write | `split('\t')` rolled by hand | Reuse `scan.mjs` append helpers as reference pattern | `scan.mjs` already has the pattern for append + header-on-first-create; replicate it |
| HEAD request for URL validation | Custom timeout/retry | Plain `fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })` | Node 22 has built-in fetch + AbortSignal.timeout(); no library needed |

**Key insight:** Every scraping pitfall (rate-limiting, robots.txt compliance, SPA hydration, atomic writes, cron scheduling) has a battle-tested library. Our value-add is (a) the per-firm adapter set and (b) the Electron integration glue — not lower-level primitives.

## Per-Firm Adapter Notes

Verified per-firm via WebFetch probes on 2026-04-22. Treat each row's `rendering` column as the authoritative result for planning the adapter strategy.

| # | Firm | Portfolio URL | Rendering | Pagination / Expansion | Has direct careers URLs? | Notes |
|---|------|--------------|-----------|------------------------|-----|-------|
| 1 | a16z | `https://a16z.com/portfolio/` | **JS-rendered** | "Load All" button | Not in first payload; website links only | May need to follow `a16z.com/investment-list/` or `speedrun.a16z.com/companies/` for full list. `[VERIFIED: WebFetch 2026-04-22]` |
| 2 | Sequoia | `https://www.sequoiacap.com/our-companies/` | **SPA** (client-rendered, "Loading" placeholders in initial HTML) | Filters + client-side table | No direct careers URLs in markup — only internal `/companies/{slug}/` detail pages | Need to follow detail pages or find JSON API via `page.waitForResponse`. `robots.txt` is fully permissive. `[VERIFIED: WebFetch 2026-04-22]` |
| 3 | Benchmark | **No public portfolio page on `benchmark.com`** | — | — | — | `www.benchmark.com` homepage lists only addresses. No `/companies`, no `/portfolio` path found. **Stub adapter returns `[]` + informative log.** Users can manually add via Add Firm modal pointing at a third-party mirror (e.g. vcbacked.co) if desired. `[VERIFIED: WebFetch 2026-04-22]` |
| 4 | Accel | `https://www.accel.com/companies` | **JS-rendered** | "Load More" button + filters | Requires click-through to company detail | Dynamic API fetch likely — inspect network tab in planning. `[VERIFIED: WebFetch 2026-04-22]` |
| 5 | General Catalyst | `https://www.generalcatalyst.com/portfolio` | **JS-rendered, paginated** | Paginated table + sector filters | Company detail pages | Walk pagination in adapter. `[VERIFIED: WebFetch 2026-04-22]` |
| 6 | Coatue | `https://www.coatue.com/portfolio` | **Static HTML** (+ "Load more" for tail) | Most visible in first payload; "Load more" reveals remaining | **Yes** — direct external website URLs in markup | Easiest adapter. Static `$$eval` on company cards works. `[VERIFIED: WebFetch 2026-04-22]` |
| 7 | Founders Fund | `https://foundersfund.com/portfolio/` | **Static HTML** | Single page | Internal `/company/{slug}/` detail pages (70+ entries) | Follow detail pages to find websites & careers URLs. `[VERIFIED: WebFetch 2026-04-22]` |
| 8 | Khosla Ventures | `https://www.khoslaventures.com/portfolio/` | **Static HTML** | Categorized grid (8 categories) | **Yes** — direct external links | Static `$$eval` on category sections. `[VERIFIED: WebFetch 2026-04-22]` |
| 9 | Index Ventures | `https://www.indexventures.com/companies/` | **Static HTML** (client-side filtering only) | Full list in markup | Hyperlinks per company | Static extract. `[VERIFIED: WebFetch 2026-04-22]` |
| 10 | Lightspeed | `https://lsvp.com/portfolio/` | **Static HTML** | Full list (500+); filter UI is client-side | Company cards with full metadata | Largest portfolio; static extract. `[VERIFIED: WebFetch 2026-04-22]` |

**Summary:** 5 firms static, 4 firms JS-rendered, 1 firm (Benchmark) has no public portfolio. Using Playwright for all 10 normalizes the adapter code — static sites simply skip the "wait for XHR / click button" steps. **No separate Cheerio path is warranted.**

**Careers-URL extraction:** Most firms link to company marketing sites, not careers pages. The adapter's primary job is capturing `{ name, website }`. A post-scrape step converts `website` → `careers_url` using the existing `scan.mjs` pattern — probe `${website}/careers`, `${website}/jobs`, or detect ATS subdomain (Greenhouse/Ashby/Lever). This is already a solved problem via `detectApi` in `scan.mjs`; reuse it.

## Funding Signal Heuristics (VC-03)

Per D-02: no Crunchbase API. Detect funding using two signal sources probed in the scraper:

### Signal A — Firm blog RSS/Atom

Each VC firm publishes "we're investing in X" announcements on their blog. Many blogs expose RSS.

| Firm | Blog RSS Feed (best-known) | Confidence |
|------|----------------------------|-----------|
| a16z | `https://a16z.com/feed/` | HIGH `[ASSUMED]` — verify during planning |
| Sequoia | `https://www.sequoiacap.com/feed/` | MEDIUM `[ASSUMED]` |
| Founders Fund | `https://foundersfund.com/feed/` | MEDIUM `[ASSUMED]` |
| Khosla | `https://www.khoslaventures.com/feed/` | MEDIUM `[ASSUMED]` |
| Lightspeed | `https://lsvp.com/feed/` | MEDIUM `[ASSUMED]` |
| (others) | Manually probe `/feed/`, `/rss`, `/blog.rss`, `<link rel="alternate">` in HTML | LOW — verify during planning |

**Logic:** For each company X, grep RSS entries published within the last 365 days for `X`'s name (case-insensitive, word-boundary). If found, `funding_signal = "Blog announcement"` and `funding_date = <entry pubDate>`.

### Signal B — Google News search

For each company, execute a single query like `"{company} funding round 2025 OR 2026"` via Google's public RSS (`https://news.google.com/rss/search?q=...&hl=en-US`). Parse the result; if any headline from the last 12 months matches heuristics (`raised`, `series A/B/C/D`, `funding`, `seed round`), emit `funding_signal = "Press mention"` with the newest date.

**Note:** Google News RSS is undocumented but publicly accessible; historically stable. Mark `[ASSUMED]` — no SLA from Google. Add a graceful fallback to "no signal" on HTTP errors.

### Rate-limit concerns

Both RSS and Google News queries are HTTP GETs; they count toward our serialized 500–2000ms budget. **For 10 firms × ~50 companies each = ~500 Google News requests per scrape, serialized with 1s average delay = ~500 seconds (~8 minutes).** Acceptable for a monthly scheduled run; log progress per-company in stdout so the operations drawer shows forward motion.

### Signal confidence

Label badge as `"Funded"` (green pill). **The badge asserts "we saw a signal," not "company raised capital in the last year."** False positives are tolerable — this is a discovery aid, not a CRM. `[ASSUMED]` — user may reject this design during planning; if so, switch to "Maybe funded" / "Signal found" phrasing.

## Role-Match Pipeline (VC-03 second half)

For each discovered company:

1. Derive `careers_url` using the existing `scan.mjs` `detectApi()` helper on `website`.
2. If ATS-detectable (Greenhouse/Ashby/Lever), hit the JSON API once.
3. Apply the user's `title_filter.positive` + `archetypes` keywords from `config/profile.yml` against job titles (reuse `buildTitleFilter` from `scan.mjs`).
4. Persist matched keywords in `role_matches` TSV column (comma-separated). Empty string = no match.

This ties cleanly into the existing scan.mjs model — we're reusing validated code paths, not inventing new ones.

**Keywords source:** `config/profile.yml` → `target_roles.primary[]` + `target_roles.archetypes[*].name`. Read once per scraper run; pass to the role-matcher module.

## Data Model

### `config/vc-firms.yml` (shipped defaults)

```yaml
# Source: per-firm WebFetch probes 2026-04-22
firms:
  - name: a16z
    portfolio_url: https://a16z.com/portfolio/
    keywords: []
  - name: Sequoia
    portfolio_url: https://www.sequoiacap.com/our-companies/
    keywords: []
  - name: Benchmark
    portfolio_url: ""  # intentionally blank — no public portfolio page
    keywords: []
    enabled: false     # user must supply URL or leave disabled
  - name: Accel
    portfolio_url: https://www.accel.com/companies
    keywords: []
  - name: General Catalyst
    portfolio_url: https://www.generalcatalyst.com/portfolio
    keywords: []
  - name: Coatue
    portfolio_url: https://www.coatue.com/portfolio
    keywords: []
  - name: Founders Fund
    portfolio_url: https://foundersfund.com/portfolio/
    keywords: []
  - name: Khosla
    portfolio_url: https://www.khoslaventures.com/portfolio/
    keywords: []
  - name: Index
    portfolio_url: https://www.indexventures.com/companies/
    keywords: []
  - name: Lightspeed
    portfolio_url: https://lsvp.com/portfolio/
    keywords: []
```

### `data/vc-companies.tsv` (per CONTEXT.md Specific Ideas)

Tab-separated, header on line 1:

```
firm	company	careers_url	funding_signal	funding_date	role_matches	discovered_at	promoted
```

- `firm`: literal firm name from `config/vc-firms.yml`
- `company`: company display name
- `careers_url`: resolved careers URL (empty string if none found)
- `funding_signal`: `"Blog announcement" | "Press mention" | ""`
- `funding_date`: ISO date (`YYYY-MM-DD`) of the detected signal, or empty
- `role_matches`: comma-separated matched keywords (empty = no match)
- `discovered_at`: ISO date
- `promoted`: `"true" | "false"` — set to `"true"` by the Promote IPC handler after successful append to `pipeline.md`

### `data/vc-health.json` (per CONTEXT.md Specific Ideas)

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

**Status derivation (scraper writes this on each run):**
- `OK` — `company_count >= baseline_count * 0.8` AND `last_run` within configured interval
- `Stale` — `last_run` older than configured interval (computed at read time by the renderer, not stored)
- `Error` — last run returned non-zero exit for this firm (scraper writes a line-level `status: "Error"` when an adapter throws)

**Baseline rule:** On the first successful scrape, `baseline_count = company_count`. On subsequent successful scrapes, `baseline_count = max(baseline_count, company_count)` — never decreases. This way, a one-time drop triggers the banner; recovery to the peak resets the baseline high-water mark. `[ASSUMED]` — confirm with user during planning if a different rule (e.g. rolling 3-run average) is preferred.

## IPC Contract (new channels)

Extend `ElectronAPI` in `preload/types.ts` and the corresponding handlers in `ipc-handlers.ts`:

| Channel | Direction | Payload in | Payload out |
|---------|-----------|-----------|------------|
| `runVcScrape` | renderer → main | `void` | `{ runId: string }` (reuses `op:output` / `op:done` streaming events) |
| `readVcCompanies` | renderer → main | `void` | `VcCompany[]` |
| `readVcHealth` | renderer → main | `void` | `{ firms: VcFirmHealth[] }` |
| `promoteToPipeline` | renderer → main | `{ company: string, careersUrl: string }` (zod validated) | `{ success: boolean, error?: string }` |
| `listVcFirms` | renderer → main | `void` | `VcFirmConfig[]` |
| `addVcFirm` | renderer → main | `{ name: string, portfolioUrl: string, keywords?: string[] }` (zod) | `{ success: boolean, reachable: boolean, error?: string }` |
| `getVcScrapeInterval` | renderer → main | `void` | `{ interval: 'weekly' \| 'monthly' \| 'manual-only' }` |
| `setVcScrapeInterval` | renderer → main | `'weekly' \| 'monthly' \| 'manual-only'` (zod) | `void` |

All IPC channels must validate raw input via `zod` schemas (same pattern as Phase 2 `UpdateStatusSchema`, `ApiKeySchema`).

## Electron Integration

### `SettingsSlideOver` extension

Append a `VcScraperSection` below the Model selector. Read from/write to `preferences.json` via a new `preferences.getVcScrapeInterval()` / `setVcScrapeInterval()` method that follows the same JSON-file pattern as `getModel`/`setModel`.

### `Sidebar` extension

Add a new nav item with `Compass` icon (lucide-react — already installed) as the 6th entry, below CV. This is a 4-line diff to `Sidebar.tsx`.

### File watcher extension

Extend `watcher.ts`'s `paths` array with `data/vc-companies.tsv` and `data/vc-health.json`. The existing chokidar + `files-changed` IPC event already debounces and ignores GUI-initiated writes (via `pendingGuiWrites`). DiscoverPanel subscribes to `onFilesChanged` and re-invokes `readVcCompanies` + `readVcHealth`.

### GUI-initiated scrape — suppress FileChangeBanner

When `runVcScrape` fires, add `data/vc-companies.tsv` and `data/vc-health.json` to `pendingGuiWrites` for the duration of the child process (clear in `child.on('exit')`). Matches Phase 2 D-15 pattern.

## Scheduler

### Choice: node-cron 4.2.1

- **Pure JavaScript**, no native deps `[CITED: github.com/node-cron/node-cron README]`
- ESM native: `import cron from 'node-cron'`
- API: `cron.schedule(expression, callback)` returns a task with `.start()` / `.stop()` / `.getStatus()` methods
- No built-in persistence `[CITED: github.com/node-cron/node-cron issue #340]` — we persist the user's interval choice in `preferences.json`

### Persistence strategy

1. On `setVcScrapeInterval` IPC, write new interval to `preferences.json` (via the existing `preferences` service, extended with two new methods).
2. On app-ready, `initScheduler` reads the persisted interval and creates the cron task.
3. On interval change at runtime, `reconfigureScheduler` stops the existing task and creates a new one with the new expression.

### Missed-run behavior

**Accepted by design.** If the app is closed at the scheduled time, node-cron does not catch up on missed runs. The user can always click "Run scan now" to trigger manually. Since VC portfolios don't change hourly, a missed monthly run is tolerable.

**If the planner wants catch-up:** Store `last_scrape_completed_at` in preferences, compare to current time on app-ready; if the delta exceeds the configured interval, trigger a scrape immediately after the existing warm-up. This is optional and adds ~10 LOC.

## Common Pitfalls

### Pitfall 1: SPA sites return empty HTML on first fetch
**What goes wrong:** Sequoia, a16z, Accel, General Catalyst render company cards client-side. A Playwright scrape without `waitUntil: 'networkidle'` captures the skeleton page with placeholders ("Loading...") and returns zero companies.
**Why it happens:** `page.goto()` by default returns on `load`, not `networkidle`. Data fetches are XHRs that come after.
**How to avoid:** Use `await page.goto(url, { waitUntil: 'networkidle' })`. For infinite-scroll or "Load More" patterns, explicitly click the button and `await page.waitForResponse` or `page.waitForFunction(() => ...)`.
**Warning signs:** Scraper reports 0 companies from a known-populated firm; page screenshot (dev-only) shows loading spinner.

### Pitfall 2: robots.txt disallow silently ignored
**What goes wrong:** Scraper hits a disallowed path, VC firm's WAF flags our IP, subsequent runs get 403.
**How to avoid:** Always call `checkAllowed(url)` before every `page.goto()`. On disallow, log `"Skipping {firm}: robots.txt disallows"` and return `[]` for that firm; mark health as `Error` for that firm with a human-readable reason.
**Warning signs:** Firm count = 0, health shows `Error`, log shows "robots.txt disallows".

### Pitfall 3: node-cron task fires during child-process-already-running
**What goes wrong:** User clicks "Run scan now" at 02:59, cron fires at 03:00, two child processes race on `data/vc-companies.tsv`.
**How to avoid:** Track `scrapeActive` in the scheduler; cron handler early-returns if already active. Same pattern as `scanActive` in Phase 2 PipelinePanel.
**Warning signs:** TSV corruption, duplicate rows, partial writes.

### Pitfall 4: Funding-signal heuristics produce too many false positives
**What goes wrong:** "Stripe funding announced" matches any Stripe-adjacent news within 12 months; users see "Funded" on companies that last raised in 2021.
**How to avoid:** Require `funding_date` to be within 365 days of `discovered_at`. Apply word-boundary regex, not `.includes()`. Log each match's source URL in the TSV `funding_signal` column ("Blog announcement via a16z.com/feed") so users can verify.
**Warning signs:** User reports "most companies are marked Funded but I don't believe it."

### Pitfall 5: Benchmark has no portfolio page, adapter throws
**What goes wrong:** Adapter tries to `goto("")`, throws, scraper crashes mid-run.
**How to avoid:** Benchmark's shipped adapter returns `[]` immediately and logs a one-line message. `config/vc-firms.yml` ships with `enabled: false` for Benchmark. Firm shows up in health panel as "Disabled" or is omitted.
**Warning signs:** Unhandled promise rejection during scrape run.

### Pitfall 6: HEAD request on portfolio URL times out during Add Firm
**What goes wrong:** User clicks "Save Firm", main-process `fetch` hangs 60s, UI shows `Saving…` indefinitely.
**How to avoid:** Wrap HEAD with `AbortSignal.timeout(5000)` (Node 22 built-in). On timeout, surface "Could not reach URL — save anyway?" per D-16.
**Warning signs:** UI stuck on Saving…; no toast, no error.

### Pitfall 7: Promoted flag stale after Pipeline deletes the row
**What goes wrong:** User promotes Acme → appears in pipeline.md → user deletes from pipeline. Discover panel still shows `Promoted ✓`; user can't re-promote.
**How to avoid:** `Promoted ✓` state in `data/vc-companies.tsv` is authoritative for the Discover UI. Document behavior: "re-promoting a removed company requires editing the TSV by hand, or re-running the scrape (which resets `promoted = false` for new rows only)." Defer a per-row un-promote UI to v3+.
**Warning signs:** User complaint "I deleted from pipeline and now I can't re-promote."

### Pitfall 8: Google News RSS returns HTML error page instead of RSS
**What goes wrong:** Google rate-limits our serialized requests, returns a 429 or challenge page, funding heuristic parses the HTML as XML and throws.
**How to avoid:** Check `Content-Type` header before parsing. Wrap parser in try/catch. Fall back to `funding_signal = ""`.
**Warning signs:** Spike of errors in scrape logs midway through a run.

## Code Examples

### `scrape-vcs.mjs` skeleton

```javascript
// Source: structure follows scan.mjs exactly
#!/usr/bin/env node

import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import yaml from 'js-yaml';
import { pathToFileURL } from 'url';
import { checkAllowed, randomDelay } from './scrapers/robots.mjs';
import { detectFundingSignal } from './scrapers/funding-detector.mjs';
import { detectRoleMatches } from './scrapers/role-matcher.mjs';
import { writeCompaniesTsv } from './scrapers/tsv-writer.mjs';
import { writeHealth } from './scrapers/health.mjs';
import adapters from './scrapers/adapters/index.mjs';

async function main() {
  mkdirSync('data', { recursive: true });
  const firmsYaml = yaml.load(readFileSync('config/vc-firms.yml', 'utf-8'));
  const firms = (firmsYaml.firms || []).filter((f) => f.enabled !== false && f.portfolio_url);

  const profile = yaml.load(readFileSync('config/profile.yml', 'utf-8'));
  const roleKeywords = extractRoleKeywords(profile);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'JobEngineBot/1.0 (+https://github.com/santifer/career-ops)',
  });

  const allCompanies = [];
  const healthUpdates = [];

  for (const firm of firms) {
    const { allowed } = await checkAllowed(firm.portfolio_url);
    if (!allowed) {
      console.log(`[${firm.name}] robots.txt disallows — skipping`);
      healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots.txt' });
      continue;
    }
    const adapter = adapters[firm.name] ?? adapters.__generic__;
    try {
      console.log(`[${firm.name}] scraping…`);
      const companies = await adapter(context, { log: console.log, firm });
      for (const c of companies) {
        const signal = await detectFundingSignal(c, firm);
        const roleMatches = await detectRoleMatches(c, roleKeywords);
        allCompanies.push({ firm: firm.name, ...c, ...signal, role_matches: roleMatches });
        await randomDelay();
      }
      healthUpdates.push({ name: firm.name, status: 'OK', count: companies.length });
      console.log(`[${firm.name}] ${companies.length} companies`);
    } catch (err) {
      console.error(`[${firm.name}] error: ${err.message}`);
      healthUpdates.push({ name: firm.name, status: 'Error', reason: err.message });
    }
    await randomDelay();
  }

  await browser.close();
  await writeCompaniesTsv('data/vc-companies.tsv', allCompanies);
  await writeHealth('data/vc-health.json', healthUpdates);
  console.log(`Done. ${allCompanies.length} companies written.`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
```

### HEAD probe for Add Firm validation

```typescript
// Source: Node 22 built-in fetch + AbortSignal.timeout
// electron/src/main/services/url-probe.ts
export async function probeUrl(url: string): Promise<{ reachable: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    return { reachable: res.ok };
  } catch (err: any) {
    return { reachable: false, error: err.message };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer | Playwright | ~2020 | Playwright has a superset of features, active Microsoft backing, better browser-matrix support |
| `node-fetch` | Built-in `fetch` (Node 18+) | Node 18 LTS | No extra dep; built-in supports AbortSignal.timeout() and redirect handling |
| Crunchbase API for funding | RSS/press-release heuristics (this phase) | v2 per D-02 | No paid API keys; imperfect signal; users understand heuristics are advisory |
| Cheerio + undici for static scraping | Playwright for all | This phase (planning decision) | Simplifies adapter code to one path; marginal perf loss (1-2s Chromium startup) |
| node-cron 2.x (no task.stop/start) | node-cron 4.x | 2024 | Explicit lifecycle methods; required for our dynamic reconfigure flow |

**Deprecated/outdated:**
- `node-cron` 2.x — task control API incomplete; use 4.x
- `axios` / `node-fetch` — unnecessary since Node 18 built-in fetch
- `request` / `request-promise` — archived since 2020

## Runtime State Inventory

Phase 3 is additive (new files, new folders, no rename/refactor). This section intentionally thin.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None (new TSV + new JSON file — no existing records to migrate) | None |
| Live service config | None (no external services integrated) | None |
| OS-registered state | node-cron tasks live in-process; Electron exit terminates them cleanly | None |
| Secrets / env vars | None new (no API keys in Phase 3) | None |
| Build artifacts | Playwright browser binaries (already installed from Phase 2); no new artifacts | None |

**Nothing found in category:** All categories above confirm no legacy state — Phase 3 ships greenfield files only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 18+ | scrape-vcs.mjs (built-in fetch, AbortSignal.timeout) | ✓ | 22.22.2 | — |
| Playwright + Chromium | All 10 firm adapters | ✓ | 1.2.0 (root) / 1.59.1 (registry latest) | — (already in use for Phase 2 PDF gen) |
| `node-cron` | Electron main scheduler | ✗ | — | Install: `npm install node-cron` in electron/ and root |
| `robots-parser` | Scraper robots.txt check | ✗ | — | Install: `npm install robots-parser` in root |
| `js-yaml` | `config/vc-firms.yml` load | ✓ | 4.1.1 | — |
| `proper-lockfile` | File writes | ✓ | 4.1.2 | — |
| `write-file-atomic` | File writes | ✓ | 7.0.1 (electron) | — |
| Internet access | RSS feeds, Google News, firm portfolio sites | ✓ (runtime assumption) | — | Scraper logs errors and marks firm status `Error`; UI shows the state |

**Missing dependencies with no fallback:** None (all missing deps have `npm install` as the fallback).

**Missing dependencies with fallback:** `node-cron` and `robots-parser` — install during the first planning task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Each firm's blog RSS lives at `/feed/` | Funding Signal Heuristics | LOW — scraper falls back to Google News only; worst case fewer "Funded" badges |
| A2 | Google News RSS is publicly accessible and returns parseable XML | Funding Signal Heuristics | MEDIUM — if Google changes path or rate-limits us, all funding detection degrades; fallback is no badge, scraper continues |
| A3 | A "high-water mark" baseline rule (never decrease) matches user mental model for drop alerts | Data Model — Health | MEDIUM — if user wants rolling average, the formula is a 3-line change; flag during planning |
| A4 | Playwright-for-all (no Cheerio fast-path) is acceptable performance | Standard Stack | LOW — if planning finds a 5×+ slowdown in the monthly cron run, can add Cheerio for the 5 static sites; no architectural change needed |
| A5 | Benchmark's lack of public portfolio means shipping `enabled: false` is preferable to hardcoding a third-party mirror URL | Per-Firm Adapter Notes | LOW — deferring this to user choice is the most conservative decision |
| A6 | `"Funded"` label (not "Maybe funded") is acceptable copy given the heuristic uncertainty | Funding Signal Heuristics + UI-SPEC Copywriting Contract | MEDIUM — UI-SPEC already locked `"Funded"`; if user changes mind during planning, all copy changes in one place |
| A7 | Missed cron runs during app-off are acceptable (no catch-up logic in v2) | Scheduler | LOW — user can run manually; monthly cadence is forgiving |
| A8 | Scraping a single firm's portfolio takes <~2 minutes including funding probes for ~50 companies | Rate-limit concerns | MEDIUM — if a firm has 500+ companies (Sequoia, Lightspeed), the per-firm wall time balloons to 15+ min; may require batch-splitting within a firm |
| A9 | `config/vc-firms.yml` can ship as a tracked file in the repo (like `templates/portals.example.yml`) or user-editable copy in `config/` | Data Model | LOW — mirrors existing `config/profile.example.yml` + `config/profile.yml` pattern |
| A10 | Role-match computation at scrape time (not render time) is the preferred architecture | Architectural Responsibility Map | LOW — re-evaluating per-render is cheap but adds coupling; the scrape-time precompute is a cleaner contract |

**Assumptions above marked MEDIUM or higher should be raised during planning for explicit user confirmation.**

## Open Questions

1. **Benchmark firm handling**
   - What we know: `benchmark.com` has no public portfolio page; third-party mirrors exist (vcbacked.co, crunchbase, etc.)
   - What's unclear: Should the shipped config disable Benchmark entirely (current recommendation), or point it at a third-party mirror (imperfect but populated)?
   - Recommendation: Ship disabled with an empty URL. Include an explanatory note in `config/vc-firms.yml` comments. Users who want mirror data can enable + set URL manually.

2. **Role-match baseline**
   - What we know: Role-match requires ATS-detectable careers URL (Greenhouse/Ashby/Lever) per `scan.mjs` logic.
   - What's unclear: What % of VC portfolio companies use these three ATS systems? For companies without detectable ATS, role_match is permanently empty, and the "Matched" filter yields fewer results than users might expect.
   - Recommendation: During planning, instrument the scraper with a dry-run that logs ATS-detection success rate per firm. If <30%, consider adding a secondary heuristic (e.g., `website + '/careers'` HTML scrape for "engineer" / archetype keywords as a weak signal).

3. **Funding detection rate-limit**
   - What we know: Serialized requests with 500–2000ms delay add up to ~500–1000 Google News queries per scrape.
   - What's unclear: Will Google News RSS rate-limit at scale? No published limits.
   - Recommendation: During Wave 1 of implementation, dry-run a single 10-firm scrape and monitor for 429s. If rate-limited, add exponential backoff or skip Google News for common company names.

4. **Initial baseline handling**
   - What we know: First scrape establishes baseline_count; subsequent scrapes compare.
   - What's unclear: Should the first scrape trigger the drop-alert banner at all? (If a firm has 0 companies on first run due to a scraper bug, users see a false-positive alert.)
   - Recommendation: Suppress the drop alert when `baseline_count === 0` OR `last_run === null` for the firm. Only alert once we have ≥2 successful runs.

5. **node-cron + Electron integration**
   - What we know: node-cron 4.x is pure JS with no native deps; initializes fine in Electron main.
   - What's unclear: Does node-cron hold the event loop alive, preventing `app.quit()`? (In Electron, holding timers can prevent clean shutdown.)
   - Recommendation: Call `activeTask?.stop()` in `app.on('before-quit')`. Low-risk verification task in planning.

## Validation Architecture

Skipped per `workflow.nyquist_validation = false` in `.planning/config.json`.

## Project Constraints (from CLAUDE.md)

Relevant directives that bind Phase 3:

- **ESM modules only** — `scrape-vcs.mjs` + `scrapers/*.mjs` must use `import`/`export`, not `require`. `[CITED: CLAUDE.md Stack and Conventions]`
- **kebab-case `.mjs` at root** — `scrape-vcs.mjs` filename is already canonical. `[CITED: CONTEXT.md Established Patterns]`
- **Playwright for offer verification, not WebSearch/WebFetch** — applicable to the existing `/career-ops` skill, not directly to the scraper; mentioned only for context. `[CITED: CLAUDE.md Offer Verification]`
- **Never submit applications without review** — Promote writes the URL to pipeline.md; the user still manually evaluates before applying. Phase 3 does not change this contract. `[CITED: CLAUDE.md Ethical Use]`
- **NEVER edit `modes/_shared.md` for user-specific content** — not touched by Phase 3. `[CITED: CLAUDE.md Data Contract]`
- **NEVER add new rows to `applications.md` directly** — Phase 3 does not touch `applications.md`; all writes are to `pipeline.md` (the inbox), which is the correct target per `scan.mjs`'s existing pattern. `[CITED: CLAUDE.md Pipeline Integrity]`
- **No emoji in button labels / error copy** — already enforced by Phase 3 UI-SPEC Copywriting Contract. `[CITED: UI-SPEC]`

## Sources

### Primary (HIGH confidence)

- `[VERIFIED]` npm registry — `npm view node-cron / robots-parser / playwright / js-yaml version` run 2026-04-22
- `[CITED]` github.com/samclarke/robots-parser — API reference verified 2026-04-22
- `[CITED]` github.com/node-cron/node-cron (README) — API + pure-JS confirmation verified 2026-04-22
- `[CITED]` oxylabs.io / scrapingdog / brightdata Playwright Node.js tutorials 2026 — `__NEXT_DATA__` pattern, `waitUntil: 'networkidle'`, serialized delays
- `[VERIFIED]` Per-firm WebFetch probes 2026-04-22: a16z.com, sequoiacap.com, accel.com, generalcatalyst.com, coatue.com, foundersfund.com, khoslaventures.com, indexventures.com, lsvp.com, benchmark.com
- `[VERIFIED]` `scan.mjs`, `generate-pdf.mjs`, `electron/src/main/ipc-handlers.ts`, `electron/src/main/services/process-runner.ts`, `electron/src/main/services/status-writer.ts`, `electron/src/preload/types.ts`, `electron/src/main/watcher.ts`, `electron/src/main/services/preferences.ts` — read during research, 2026-04-22

### Secondary (MEDIUM confidence)

- npm compare node-cron vs node-schedule vs croner (pkgpulse.com) — used for stack choice rationale
- digitalocean / freecodecamp / logrocket node-cron tutorials — corroborate node-cron 4.x API

### Tertiary (LOW confidence — flagged as `[ASSUMED]`)

- Firm blog RSS paths (`/feed/`) — convention; verify per-firm during planning
- Google News RSS stability — publicly used but undocumented by Google
- Performance assumption that Playwright-for-all is acceptable (no benchmarks yet)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified against npm registry 2026-04-22
- Architecture Patterns: HIGH — reuses proven Phase 1 / Phase 2 patterns verbatim (process-runner, watcher, IPC, lockfile/atomic writes)
- Per-Firm Adapter Notes: MEDIUM — 9 of 10 firms probed via WebFetch, Benchmark confirmed absent; exact selectors are TBD during planning but rendering type is verified
- Funding Signal Heuristics: MEDIUM — RSS pattern works in principle but per-firm feed paths are assumed
- Role-Match Pipeline: HIGH — reuses `scan.mjs` helpers verbatim
- Data Model: HIGH — column set + JSON shape taken directly from CONTEXT.md Specific Ideas
- Pitfalls: HIGH — derived from Phase research SUMMARY.md + verified Phase 1/2 experience
- Scheduler: HIGH — node-cron 4.x documented; Electron integration pattern established in Phase 2

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable ecosystem; firm portfolio page DOM could shift, flagging in drop-alert design)
