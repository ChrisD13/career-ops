# Phase 3: VC Portfolio Discovery - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone `scrape-vcs.mjs` CLI + Electron GUI integration that scrapes portfolio pages from 10 leading VC firms, persists discovered companies to `data/vc-companies.tsv`, filters by funding recency + role match, and surfaces results in a dedicated Discover panel with Promote-to-pipeline and health monitoring. Users can add new VC firms through the GUI without editing config files.

In scope: `scrape-vcs.mjs` scraper (Playwright, serialized delays, robots.txt), funding signal via RSS/press release heuristics, `data/vc-companies.tsv` output, `data/vc-health.json` sidecar, 6th sidebar "Discover" panel with filtered table view + Promote button + health panel, node-cron monthly scheduling in Electron main, "Add VC Firm" modal persisting to `config/vc-firms.yml`, scraper health alerts via banner.

Out of scope: Crunchbase API integration (heuristics only in v2), inline report editing, auto-submit applications, any cloud sync.

</domain>

<decisions>
## Implementation Decisions

### Scraper Implementation
- **D-01:** Per-firm scraping strategy: Playwright headless browser — handles SPAs and Next.js portfolio sites (most firms); a16z + Sequoia confirmed static and also supported. Playwright is already a project dependency (PDF generation).
- **D-02:** Funding signal source: RSS/press release heuristics — probe firm blog feeds and news search for "{company} funding" within the last 12 months. No API key required. Crunchbase API deferred to v3+.
- **D-03:** Request serialization: Fully serialized with random 500ms–2000ms delays between requests. Simple implementation, respects robots.txt spirit, no rate-limit risk.
- **D-04:** Per-firm health baseline stored in separate `data/vc-health.json` — tracks `{ firm, last_run, company_count, baseline_count }` per firm. Keeps TSV clean; health data can be read independently.

### GUI Discovery View
- **D-05:** Panel placement: New 6th sidebar item "Discover" — dedicated full-viewport panel. Mirrors how Evaluate got its own sidebar item in Phase 2. VC discovery is a core workflow, not secondary.
- **D-06:** Company display: Table rows (company name, firm, funding signal label, role-match badge). Consistent with tracker pattern; scannable at 100+ companies. Table columns: Company | Firm | Funding Signal | Role Match | Actions.
- **D-07:** Default filter state: Pre-filtered to companies with funding signal + role match. Toggle button ("Showing: Matched / Show all") to reveal all discovered companies. Signal-forward default — user sees the most relevant results first.
- **D-08:** Promote behavior: Per-row inline "Promote" button that appends the company's careers URL to `data/pipeline.md` immediately via IPC → main process write (proper-lockfile + write-file-atomic). Row shows "Promoted ✓" badge after promotion; button becomes disabled to prevent duplicate promotes.

### Scraper Health & Scheduling
- **D-09:** Monthly cadence: node-cron in Electron main process — configurable interval, no OS dependency. Same process model as the operations log drawer from Phase 2. Scraper can also be triggered manually from the Discover panel.
- **D-10:** Health panel: Embedded in Discover panel header, collapsed by default with a toggle. Shows per-firm table: Firm | Last Run | Company Count | Status. Expandable without leaving the panel.
- **D-11:** Alert display: Banner at top of Discover panel (same pattern as Phase 1 FileChangeBanner) when any firm's count drops >20% from baseline. Lists affected firms with count delta. Dismissible per session.
- **D-12:** Scrape cadence config: Settings slide-over (Phase 2 gear icon panel) gets a new "VC Scraper" section — interval selector (weekly / monthly / manual-only) and a "Run now" button.

### VC Firm Management (VC-06)
- **D-13:** "Add firm" UX: Modal dialog triggered by an "Add Firm" button in the Discover panel header. Consistent with Phase 2 Settings slide-over pattern. Modal contains the add-firm form.
- **D-14:** Storage target: New `config/vc-firms.yml` — keeps VC-specific configuration separate from the broader `portals.yml` (which manages ATS portal scanning). Cleaner separation of concerns; built-in firms can ship as defaults in this file.
- **D-15:** Required form fields: Firm name + portfolio page URL + optional role keywords hint. Simple but enough for the scraper adapter to target the right page and improve filtering relevance.
- **D-16:** Validation on add: HEAD request reachability check from main process before persisting to `config/vc-firms.yml`. Shows inline error if unreachable but allows user to save anyway (override). Better UX than silent failures on next scrape run.

### Claude's Discretion
- Exact Playwright adapter strategy per firm (CSS selectors vs. text extraction vs. structured data scraping) — discovered during per-firm DOM probing in planning/research
- Whether to use a shared adapter interface or firm-specific strategy classes for the scraper
- Exact CSS/layout for the Discover panel (column widths, funding signal badge colors, role-match badge style)
- Health panel expand/collapse animation style
- Whether "Add Firm" modal includes a preview scrape (test-run) option before saving — nice-to-have if straightforward to implement

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate-pdf.mjs` — existing Playwright usage pattern: launch browser, navigate, extract, close. `scrape-vcs.mjs` follows the same structure for headless scraping.
- `scan.mjs` — existing portal scanner: fetch + parse pattern, request serialization with delays, `seen-urls` dedup. Reference for scraper architecture and output format (TSV).
- `lib/statuses.mjs` — Node-side YAML loading pattern reusable for `config/vc-firms.yml` loading.
- `electron/src/main/ipc-handlers.ts` — existing IPC handler pattern; new `scraper:run`, `scraper:status`, `promote:company`, `firm:add` channels follow same one-function-per-operation shape.
- `electron/src/renderer/components/` — existing panel components (TrackerPanel, ReportsPanel, PipelinePanel) as structural reference for DiscoverPanel layout.
- Phase 2 Settings slide-over — reuse for "VC Scraper" config section; same gear icon trigger.
- Phase 1 FileChangeBanner — reuse pattern for the >20% drop alert banner in Discover panel.

### Established Patterns
- kebab-case `.mjs` root scripts — `scrape-vcs.mjs` follows this convention
- ESM imports with `import { x } from 'y'` — no CommonJS
- `child_process.fork` from Electron main for long-running Node scripts (Phase 2 scan + batch pattern)
- `proper-lockfile` + `write-file-atomic` for all file writes from GUI path
- IPC: main emits events (`evaluation:token`, `files-changed`), renderer subscribes — `scraper:progress` and `scraper:done` events follow same model
- TSV format for company data (consistent with `batch/tracker-additions/` pattern)

### Integration Points
- `electron/src/renderer/App.tsx` — add "Discover" to sidebar nav (6th item after CV panel from Phase 2)
- `electron/src/preload/types.ts` — extend `ElectronAPI` with scraper + firm management IPC channels
- `electron/src/preload/index.ts` — contextBridge surface for new channels
- `electron/src/main/ipc-handlers.ts` — new handlers for scraper trigger, health read, promote, firm add
- `data/pipeline.md` — Promote writes careers URL here (same file as existing pipeline inbox)
- `config/vc-firms.yml` — new file; main process reads this before each scrape run
- `data/vc-companies.tsv` — scraper output; Discover panel reads this (via IPC) for the company table
- `data/vc-health.json` — health sidecar; Discover panel health section reads this
- Settings slide-over from Phase 2 — extend with VC Scraper interval + manual trigger

</code_context>

<specifics>
## Specific Ideas

- Scraper runs as a child_process (same as scan.mjs in Phase 2 ELEC-07 pattern) — not a native addon
- `data/vc-companies.tsv` columns: `firm | company | careers_url | funding_signal | funding_date | role_matches | discovered_at | promoted`
- `data/vc-health.json` shape: `{ firms: [ { name, last_run, company_count, baseline_count, status } ] }`
- `config/vc-firms.yml` shape: `firms: [ { name, portfolio_url, keywords: [] } ]`
- The 10 built-in firms ship as defaults in `config/vc-firms.yml`: a16z, Sequoia, Benchmark, Accel, General Catalyst, Coatue, Founders Fund, Khosla, Index, Lightspeed
- Promote writes: `[{company}]({careers_url})` appended to `data/pipeline.md` (same format as existing pipeline entries)
- "Promoted" flag persisted in `data/vc-companies.tsv` so the UI survives refresh without re-querying pipeline.md

</specifics>

<deferred>
## Deferred Ideas

- Crunchbase API for funding signals — requires paid key, deferred to v3+ (per STATE.md and REQUIREMENTS.md)
- Batch promote (select multiple companies → promote all) — per-row promote is sufficient for v2
- Interview prep panel — v3+ per REQUIREMENTS.md deferred list
- Electron auto-update — v2.1 per REQUIREMENTS.md deferred list
- Preview scrape in "Add Firm" modal — nice-to-have, at Claude's discretion in planning

</deferred>
