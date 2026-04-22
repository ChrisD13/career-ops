# JobEngine v2 Architecture

**Researched:** 2026-04-21
**Scope:** Adding Electron desktop app, VC portfolio scraper, company filtering, prompt caching, and smart file reads to the existing file-backed career-ops system.
**Confidence:** HIGH for Electron IPC and prompt caching (verified with official Anthropic/Electron docs); MEDIUM for VC scraper placement and storage choice (pattern fit with existing codebase is the decider).

## Guiding Principle

The existing system is a **prompt-driven local automation with file-backed state**. Every new capability must honor three invariants established in `/home/desachri/JobEngine/.planning/codebase/ARCHITECTURE.md`:

1. **The filesystem is the system of record.** Markdown/YAML/TSV files under `cv.md`, `config/`, `modes/`, `data/`, `reports/`, `output/` are canonical. No new component may shadow this.
2. **User layer vs. system layer separation** (`DATA_CONTRACT.md`). User data is never overwritten by system updates.
3. **Multiple clients over the same files.** CLI (`claude -p`), Go TUI dashboard, and now Electron all read/write the same artifacts. Concurrency discipline is mandatory.

The Electron app is a **third client over the existing file substrate** — not a replacement. The `claude -p` batch path stays valid for headless/large runs (v1 evaluated 740+ offers through that path). The Electron path is the interactive day-to-day interface.

---

## Component Boundaries

```
                              USER
                               |
              +----------------+----------------+
              |                                 |
       [Electron App]                    [CLI / claude -p]
              |                                 |
     +--------+--------+                        |
     |                 |                        |
  Renderer         Main Process                 |
   (UI)           (Node, privileged)            |
     |                 |                        |
     | contextBridge   | IPC handlers           |
     | (preload.js)    | - fs ops               |
     +-----------------+ - Anthropic SDK        |
                       | - child_process        |
                       |                        |
                +------+------+                 |
                |             |                 |
         [VC Scraper     [Anthropic      [batch-runner.sh
          child process]  API calls]     + workers]
                |             |                 |
                +------+------+-----------------+
                       |
              +--------v----------+
              |  FILE SUBSTRATE   |   <-- unchanged
              |                   |
              |  cv.md            |
              |  config/*.yml     |
              |  modes/*.md       |
              |  data/*.md        |
              |  data/*.tsv       |
              |  reports/*.md     |
              |  output/*.pdf     |
              |                   |
              |  NEW:             |
              |  data/vc-companies.tsv
              |  data/.mtime-cache.json
              +-------------------+
```

### Electron Main Process

- **Responsibility:** All privileged I/O — filesystem reads/writes, Anthropic API calls, child process management, Playwright (PDF and scraping).
- **Reuses:** Imports existing `.mjs` modules directly rather than reimplementing. `generate-pdf.mjs`, `merge-tracker.mjs`, `liveness-core.mjs`, `scan.mjs`, `lib/statuses.mjs` are all consumable as ES modules from the main process.
- **New code:** IPC handlers that wrap existing scripts; Anthropic SDK integration; mtime-cache logic; scraper spawner.
- **Constraint:** Must never write to `modes/_shared.md` or other system-layer files from user actions (same rule that applies to the CLI path).

### Preload Script (Context Bridge)

- **Responsibility:** Exposes a tiny, whitelisted API surface to the renderer via `contextBridge.exposeInMainWorld('jobEngine', { ... })`.
- **Pattern:** One method per IPC message. **Never expose `ipcRenderer` directly** — that is a known security vulnerability ([Electron Security docs](https://www.electronjs.org/docs/latest/tutorial/security)).
- **Validation:** Validate inputs in preload AND re-validate in main process handler (defense in depth).

Suggested API shape:

```typescript
// preload.ts — exposed to renderer as window.jobEngine
contextBridge.exposeInMainWorld('jobEngine', {
  // Read-only data access
  tracker: {
    list: () => ipcRenderer.invoke('tracker:list'),
    get: (num: number) => ipcRenderer.invoke('tracker:get', num),
    updateStatus: (num: number, status: string) => ipcRenderer.invoke('tracker:updateStatus', { num, status }),
  },
  pipeline: {
    list: () => ipcRenderer.invoke('pipeline:list'),
    evaluateUrl: (url: string) => ipcRenderer.invoke('pipeline:evaluate', url), // streaming via event
  },
  reports: {
    read: (num: number) => ipcRenderer.invoke('reports:read', num),
    generatePdf: (num: number) => ipcRenderer.invoke('reports:generatePdf', num),
  },
  vc: {
    companies: () => ipcRenderer.invoke('vc:companies'),
    rescan: () => ipcRenderer.invoke('vc:rescan'),
    onProgress: (cb) => ipcRenderer.on('vc:progress', cb),
  },
  config: {
    readProfile: () => ipcRenderer.invoke('config:readProfile'),
    writeProfile: (yaml: string) => ipcRenderer.invoke('config:writeProfile', yaml),
  },
  // Evaluation stream — for live token updates in the UI
  onEvalStream: (cb) => ipcRenderer.on('eval:stream', cb),
});
```

**Security rules enforced:**
- `contextIsolation: true` (default since Electron 12)
- `nodeIntegration: false`
- `sandbox: true` where possible
- CSP header blocks remote content
- Validate every `sender` frame in main-process handlers

Sources: [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge), [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Security](https://www.electronjs.org/docs/latest/tutorial/security).

### Renderer (UI)

- **Responsibility:** Display only. No file access, no API keys, no Node primitives.
- **Stack recommendation:** React + TypeScript + Vite (via `electron-vite`). Vite support in Electron Forge is still experimental per their docs; `electron-vite` is purpose-built and stable enough for a production app.
- **State:** Local UI state only (e.g., selected report, filter chips). Canonical state lives in files — renderer always re-reads via IPC after mutations.

### VC Scraper — **as a child process spawned from main**

This is the most architecturally consequential decision. Three options were considered:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Inside Electron main process | Simple | Scraping is long-running + CPU-bound (Playwright); blocks main process → UI freezes; known issue per [Electron perf docs](https://www.electronjs.org/docs/latest/tutorial/performance) | **Rejected** |
| `worker_threads` in main | Lightweight | Playwright spawns its own Chromium; doesn't benefit from thread isolation; historical Electron+worker_threads friction ([issue #26816](https://github.com/electron/electron/issues/26816)) | **Rejected** |
| Standalone `.mjs` spawned via `child_process.fork()` | Matches existing pattern — every other operation is a standalone `.mjs`; fully isolated from UI; reusable from CLI without Electron; survives main-process crashes gracefully | Requires IPC message protocol between main and child | **Recommended** |

**Recommended layout:** A new `scrape-vcs.mjs` at project root, consistent with `scan.mjs`, `generate-pdf.mjs`, etc. Electron main spawns it via `fork()`, streams progress events back to the renderer. The script runs standalone via `node scrape-vcs.mjs` too, which preserves the "every operation is an npm-runnable CLI" principle from the existing stack.

This means **VC scraping is usable from batch/cron, not just Electron**. A user can `node scrape-vcs.mjs` nightly via cron and the Electron app reads the resulting file on next open.

Source: [Electron child_process patterns](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html).

### Anthropic API Client

- **Location:** Electron main process only. API key never touches the renderer.
- **Key storage:** OS keychain via `keytar` or Electron's `safeStorage` API. **Never** in `config/profile.yml` (that file is public/git-trackable surface).
- **Stream handling:** SDK streams tokens back; main process relays via `webContents.send('eval:stream', chunk)` to renderer.
- **Usage reporting:** Anthropic SDK returns `cache_creation_input_tokens` and `cache_read_input_tokens` in the response — surface these in the UI so the user can see caching ROI in real time.

---

## Data Flow

### Flow 1: Interactive Evaluation (new Electron path)

1. User pastes JD URL in Electron UI.
2. Renderer calls `window.jobEngine.pipeline.evaluateUrl(url)`.
3. Main process:
   a. Checks mtime cache (see Smart File Reads section). Reads only files whose mtime has advanced since last read.
   b. Builds the Anthropic request with `cache_control` on the static prefix (CV + profile + shared mode).
   c. Fetches JD text (WebFetch-equivalent via `fetch()`).
   d. Calls `anthropic.messages.create({ stream: true, ... })`.
   e. Streams tokens back to renderer via IPC event.
   f. On completion: writes `reports/{num}-{slug}-{date}.md`, stages `batch/tracker-additions/{num}-{slug}.tsv`, invokes `merge-tracker.mjs`, optionally calls `generate-pdf.mjs`.
4. Renderer re-reads tracker via IPC and updates UI.

### Flow 2: VC Discovery → Filtered Funnel

1. User clicks "Rescan VC portfolios" (or cron runs `scrape-vcs.mjs`).
2. Scraper child process iterates the 10 firms (a16z, Sequoia, Benchmark, Accel, General Catalyst, Coatue, Founders Fund, Khosla, Index, Lightspeed).
3. For each firm: Playwright navigates portfolio page, extracts `{company_name, url, sector}` tuples.
4. Scraper writes/updates `data/vc-companies.tsv` (append-mode with dedup by domain).
5. **Filtering stage** (either same run or separate `filter-vcs.mjs` invocation):
   - For each discovered company, probe for careers page and recent news (WebSearch or HTTP heuristics).
   - Detect "funding announced in last 12 months" signals.
   - Match active job listings against `config/profile.yml` target roles.
   - Write matches to `data/pipeline.md` (appending to the existing pending-URLs inbox — **reusing the mechanism the CLI already uses**).
6. Electron reads `data/pipeline.md` and shows matches in a "VC Funnel" view.

**Key insight:** VC-discovered companies feed the existing `data/pipeline.md` inbox. The evaluation pipeline doesn't need to change — it already processes URLs from that file.

### Flow 3: Smart File Reads (mtime cache)

A new `data/.mtime-cache.json` records last-read mtimes and cached content hashes per consumer:

```json
{
  "anthropic-context": {
    "cv.md": { "mtime": 1745220000000, "tokens": 1840, "cache_breakpoint_hash": "abc123" },
    "config/profile.yml": { "mtime": 1745100000000, "tokens": 310, ... },
    "modes/_profile.md": { ... },
    "modes/_shared.md": { ... }
  }
}
```

**On each evaluation:**
1. `fs.stat()` each file in the context prefix.
2. If ALL mtimes match the cache → known-good prefix; Anthropic prompt cache almost certainly still valid; reuse the cached request shape without re-reading file bodies.
3. If ANY mtime advanced → re-read the changed file(s), re-hash the prefix, update `.mtime-cache.json`, and expect a cache write (not read) on the next Anthropic call.

This is a **local-first optimization** that complements Anthropic's 5-minute TTL prompt cache. Even if Anthropic's cache has expired, we avoid the filesystem re-read cost (which is small but non-zero for 30+ evaluations in a batch).

**Pattern reference:** [Node.js mtime caching](https://bobbyhadz.com/blog/get-last-modified-date-of-file-using-node-js). The sidecar JSON approach matches the existing project's "TSV/JSON files as state" idiom.

### Flow 4: Prompt Caching Integration

The Anthropic SDK request for an evaluation looks like this:

```typescript
await anthropic.messages.create({
  model: "claude-sonnet-4-7",
  max_tokens: 4096,
  system: [
    // Block 1: large stable system context — CACHED
    {
      type: "text",
      text: buildSystemPrefix({
        sharedRules: readIfChanged("modes/_shared.md"),
        userProfile: readIfChanged("modes/_profile.md"),
        cv: readIfChanged("cv.md"),
        articleDigest: readIfChanged("article-digest.md"),
        profileYml: readIfChanged("config/profile.yml"),
      }),
      cache_control: { type: "ephemeral" },  // <-- cache breakpoint here
    },
    // Block 2: mode-specific instructions — could also be cached if evaluating many offers with same mode
    {
      type: "text",
      text: readIfChanged("modes/oferta.md"),
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [
    // Block 3: per-offer content — NOT cached (changes every call)
    { role: "user", content: `URL: ${url}\n\nJD:\n${jdText}` }
  ],
  stream: true,
});
```

**Cache breakpoint placement rationale:**
- The CV + profile + shared rules prefix is typically 5–15K tokens. Far exceeds the 1,024-token minimum for Sonnet.
- At cache read price (0.1×) vs. normal input (1×), per-evaluation savings are ~85–90% on the cached portion ([Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
- 5-minute default TTL is sufficient for interactive evaluation sessions; for batch runs, explicitly set `ttl: "1h"` to avoid re-writing the cache 12 times an hour.
- **Note:** Anthropic changed default TTL from 1h to 5min in March 2026 — budget accordingly. Source: [TTL change notice](https://dev.to/whoffagents/anthropic-silently-dropped-prompt-cache-ttl-from-1-hour-to-5-minutes-16ao).

**Integration with existing modes:** The mode files (`modes/oferta.md`, `modes/pdf.md`, etc.) stay as-is. The Electron path reads them, concatenates them into the cached system block, and sends via SDK. The `claude -p` CLI path continues to work unchanged because it loads the same files natively.

### Flow 5: Concurrent File Access (Electron + `claude -p` batch)

This is the **highest-risk area** for data corruption. Both paths may write to `data/applications.md`, stage rows in `batch/tracker-additions/`, and create files in `reports/`.

**Current state (verified in existing code):**
- `batch/batch-runner.sh` already uses lock files: `batch/batch-runner.pid` and `batch/.batch-state.lock`.
- `merge-tracker.mjs` is the only canonical writer to `data/applications.md` in both paths.
- The Go dashboard writes status updates to `applications.md` in-place; on failure it rebuilds from disk.

**Recommended additions:**

| Risk | Mitigation |
|------|-----------|
| Electron and `claude -p` both running `merge-tracker.mjs` | Extend `merge-tracker.mjs` to acquire `batch/.merge.lock` via `proper-lockfile` before reading/writing `applications.md`. |
| `applications.md` torn-write if editor-visible | Use `write-file-atomic` inside `merge-tracker.mjs`: write to `applications.md.tmp`, fsync, rename. Rename-within-same-FS is atomic. |
| Report number collisions | Both paths allocate `{num}` as `max existing + 1` from scanning `reports/`. Under concurrent load, two processes could pick the same number. **Mitigation:** use lockfile around the numbering step, or switch to `Date.now()` + sequence suffix for Electron-side reports to sidestep collision entirely. |
| Stale reads in Electron after batch writes | The renderer's mtime-watcher (via `fs.watch`) invalidates in-memory state when files change — renderer re-fetches via IPC. |

Libraries: [`write-file-atomic`](https://www.npmjs.com/package/write-file-atomic), [`proper-lockfile`](https://www.npmjs.com/package/proper-lockfile).

**No schema migration is required.** The same files work for both paths.

---

## Storage Decision: Where Do VC Companies Live?

The question was: new file in `data/` (matching existing pattern), SQLite, or something else?

**Recommendation: `data/vc-companies.tsv`** — matches existing pattern.

| Option | Fit with existing codebase | Verdict |
|--------|---------------------------|---------|
| `data/vc-companies.tsv` | Identical to `data/scan-history.tsv` — append-only, tab-separated, human-readable, grep-able, git-diffable | **Chosen** |
| `data/vc-companies.md` (markdown table) | Matches `applications.md` pattern; human-readable but harder to parse reliably | Alternative |
| SQLite (`data/vc.db`) | Better for querying, bad for git-diffability, breaks the "plain-text filesystem as state" invariant; requires new dependency; only justified if >10K rows | Rejected |
| `electron-store` JSON | Bound to Electron; breaks "CLI can run the same scripts" rule | Rejected |

**Schema for `data/vc-companies.tsv` (7 columns):**

```
domain  name  firm  discovered_date  last_seen_date  careers_url  funding_signal
```

This file stays ≤10K rows even if all 10 firms yield ~1000 portfolio companies each (realistic upper bound is closer to 3–5K dedup'd). TSV parsing is trivial and already idiomatic in this codebase (see `scan.mjs`, `dashboard/internal/data/career.go`).

If filtering needs ever outgrow TSV (multi-column queries across funding rounds, sector, investor overlap), adding `better-sqlite3` later is a local optimization — not a v2 requirement.

Source for decision framing: [electron-store alternatives](https://www.astrolytics.io/blog/electron-store-alternatives).

---

## Suggested Build Order

The phases are ordered to minimize risk: the Electron shell ships working but feature-light early, then each capability plugs in without changing the shell.

### Phase 1: Electron Shell + Read-Only Views (NO Anthropic, NO scraping)
**Goal:** Prove the file-bridge works.
- Scaffold with `electron-vite` + React + TypeScript.
- Implement preload contextBridge API for read-only operations: `tracker.list`, `reports.read`, `pipeline.list`.
- Main process reuses `dashboard/internal/data/career.go` logic, reimplemented in `.mjs` (or imports existing `.mjs` parsers; this project already has TSV/MD parsing code scattered across the root scripts — consolidate into `lib/parsers.mjs`).
- UI: three views — Tracker table, Report viewer, Pipeline inbox.
- **Exit criteria:** Electron app opens, shows the same data the Go dashboard shows, no writes yet.

**Why first:** Decouples "can we build an Electron app over these files" from "does the API work." Ships a usable read-only client immediately.

### Phase 2: Write Operations + Concurrency Hardening
**Goal:** Safely mutate the same files the CLI uses.
- Add `write-file-atomic` and `proper-lockfile` as dependencies.
- Refactor `merge-tracker.mjs` to lock before writing.
- IPC handlers for `tracker.updateStatus`, `config.writeProfile`.
- Test scenario: run a `claude -p` batch AND use the Electron app at the same time; verify no torn writes.
- **Exit criteria:** Concurrent batch + Electron doesn't corrupt `applications.md`.

**Why second:** Nothing else in v2 is safe until this is done. Everything downstream writes files.

### Phase 3: Anthropic SDK Integration + Prompt Caching
**Goal:** Evaluate a single JD from the Electron UI.
- Add `@anthropic-ai/sdk` dependency.
- Implement API key storage via Electron `safeStorage`.
- Build the cached system-block composer (reads CV, profile, shared, mode; places `cache_control`).
- Stream tokens to renderer; render as they arrive.
- Write report using existing report-number allocation (with lockfile from Phase 2).
- **Exit criteria:** Paste URL, see streaming evaluation, report written, cache hit confirmed in second eval within 5 min.

**Why third:** Depends on Phase 2 (report writes must be safe). Biggest token-cost impact.

### Phase 4: Smart File Reads (mtime cache)
**Goal:** Skip re-reading unchanged context files.
- Build `lib/mtime-cache.mjs` with `readIfChanged(path, consumer)`.
- Write `.mtime-cache.json` sidecar.
- Wire into the cached system-block composer from Phase 3.
- **Exit criteria:** Evaluating offer N+1 with no changes to CV/profile reads zero file bytes for the prefix; logs confirm cache reuse.

**Why fourth:** Optimization on top of Phase 3. Doesn't change correctness, only efficiency. Cheap and high-leverage.

### Phase 5: VC Portfolio Scraper (`scrape-vcs.mjs`)
**Goal:** Discover companies from 10 VC firms.
- Standalone `.mjs` at project root.
- Uses Playwright (already a dependency).
- One extractor function per firm (DOM structures differ). Start with a16z + Sequoia; add others iteratively.
- Writes `data/vc-companies.tsv` with upsert-by-domain semantics.
- Runnable via `node scrape-vcs.mjs` or spawned as child from Electron main.
- **Exit criteria:** Run the script, get ≥500 deduped companies across 10 firms.

**Why fifth:** Independent of evaluation. Can run in parallel with Phase 3 development by another contributor. Placing after Phase 2 (so writes are safe) but before Phase 6 (filter depends on it).

### Phase 6: Company Filtering Pipeline
**Goal:** Surface VC-discovered companies with recent funding + matching roles.
- New `filter-vcs.mjs` script or subcommand.
- Reads `data/vc-companies.tsv`, enriches with funding + careers signals.
- Matches against `config/profile.yml.title_filter` and `_profile.md` archetypes.
- Appends matches to `data/pipeline.md` (existing inbox mechanism).
- Electron UI: "VC Funnel" view showing new candidates.
- **Exit criteria:** From ≥500 VC companies, surface ≥10 that match user's target profile with funding within 12 months.

**Why sixth:** Depends on Phase 5 data and the pipeline-write safety from Phase 2.

### Phase 7: PDF Generation from Electron
**Goal:** Generate ATS-optimized CV without leaving the GUI.
- Wire existing `generate-pdf.mjs` behind IPC handler.
- Progress events stream to renderer.
- **Exit criteria:** One-click PDF from the report view.

**Why last:** `generate-pdf.mjs` already works standalone — this is the thinnest IPC wrapper. Low risk, good demo. Defer until the harder stuff is stable.

**Build-order dependency graph:**
```
Phase 1 (Shell, read-only)
    |
    v
Phase 2 (Writes + concurrency) -----> Phase 5 (VC scraper)
    |                                      |
    v                                      v
Phase 3 (Anthropic + caching)         Phase 6 (Filtering)
    |
    v
Phase 4 (mtime cache)
    |
    v
Phase 7 (PDF from UI)
```

Phases 5–6 and Phases 3–4 can proceed in parallel once Phase 2 is done.

---

## Integration With Existing Layers

Mapping the five new capabilities to the existing five-layer architecture from `/home/desachri/JobEngine/.planning/codebase/ARCHITECTURE.md`:

| New capability | Integrates with | How |
|----------------|-----------------|-----|
| Electron desktop app | Dashboard Presentation Layer (extends it) | Third presentation client alongside Go TUI and CLI. Reads same files. Does not replace Go dashboard — they coexist; users choose. |
| VC portfolio scraper | Node Automation Layer | New root `.mjs` script following the exact pattern of `scan.mjs`. Callable via `npm run scrape-vcs`, from `claude -p`, or from Electron IPC. |
| Company filtering | Node Automation + File-Based Domain State | New `filter-vcs.mjs` reads `data/vc-companies.tsv` + config, writes to `data/pipeline.md` (existing inbox). |
| Prompt caching | Agent Routing & Prompt Layer (new SDK path) | Electron path composes a cached system block from the same `modes/_shared.md`, `modes/_profile.md`, `cv.md` that the CLI path consumes. Mode files remain the single source of truth for instructions. |
| Smart file reads | Node Automation Layer (new library) | New `lib/mtime-cache.mjs`. Sidecar `.mtime-cache.json` in `data/`. Used by Electron main process before Anthropic calls. |

**What doesn't change:**
- `modes/*.md` prompt contracts (system layer — updatable)
- `DATA_CONTRACT.md` user/system file boundary
- `templates/states.yml` canonical statuses
- `batch/batch-runner.sh` and `claude -p` headless path
- Go TUI dashboard
- All existing `.mjs` scripts (only augmented with locking inside `merge-tracker.mjs`)

**What gets consolidated:**
- TSV/Markdown parsing logic currently duplicated across `merge-tracker.mjs`, `verify-pipeline.mjs`, `analyze-patterns.mjs`, and `dashboard/internal/data/career.go` should be extracted into a shared `lib/parsers.mjs` before the Electron main process imports it. This is a small refactor that Phase 1 should do.

---

## Open Questions / Flags for Later Phases

1. **Electron auto-update.** Desktop apps typically use `electron-updater`. Out of v2 scope but worth flagging — the existing `update-system.mjs` handles the `modes/` + scripts update path; Electron binary updates are a separate concern.

2. **API key onboarding UX.** First-run flow should detect missing key and guide the user. Consider reading `ANTHROPIC_API_KEY` from env as a convenience, then persist to `safeStorage`.

3. **VC firm DOM drift.** Portfolio pages change HTML. Each firm's extractor should be isolated (one file per firm under `scrapers/vc/{firm}.mjs`) and include a smoke test that fails loudly when the page structure changes. Flag for Phase 5.

4. **Funding detection signals.** "Recent funding" can come from Crunchbase (requires API key), press releases, or company blog. Start with a heuristic: scrape the careers page URL path pattern + company blog RSS if present. Flag as needing deeper research at Phase 6.

5. **Batch-mode prompt caching.** The `claude -p` path uses the Claude Code CLI, which has its own cache layer. Confirm whether prompt-caching benefits compound or overlap. Non-blocking for v2 since the Electron path is the primary win.

---

## Sources

**HIGH confidence (official docs):**
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic Prompt Caching Cookbook](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/prompt_caching.ipynb)
- [write-file-atomic](https://www.npmjs.com/package/write-file-atomic)
- [proper-lockfile](https://www.npmjs.com/package/proper-lockfile)
- Project files: `/home/desachri/JobEngine/.planning/codebase/ARCHITECTURE.md`, `/home/desachri/JobEngine/.planning/codebase/STACK.md`, `/home/desachri/JobEngine/DATA_CONTRACT.md` (referenced by CLAUDE.md)

**MEDIUM confidence (community sources, verified against official behavior):**
- [electron-vite](https://electron-vite.org/) — build tool recommendation
- [Electron child_process patterns](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html)
- [Node.js mtime patterns](https://bobbyhadz.com/blog/get-last-modified-date-of-file-using-node-js)
- [Anthropic TTL change notice (2026)](https://dev.to/whoffagents/anthropic-silently-dropped-prompt-cache-ttl-from-1-hour-to-5-minutes-16ao)
- [Electron storage comparison](https://www.astrolytics.io/blog/electron-store-alternatives)
- [Playwright vs Cheerio 2026](https://dev.to/vhub_systems_ed5641f65d59/web-scraping-with-nodejs-in-2026-axios-cheerio-playwright-crawlee-4f4g)

**LOW confidence / flagged for validation:**
- Exact token savings for JobEngine's specific prompt shapes — needs measurement once Phase 3 ships
- VC portfolio page DOM stability over time — needs ongoing maintenance budget
