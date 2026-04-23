# Roadmap: JobEngine v2

## Overview

JobEngine v2 layers three capabilities onto the existing file-backed job search system: (1) an Electron desktop app that replaces the CLI workflow while reading the same canonical artifacts, (2) direct Anthropic API integration with streaming, prompt caching, and smart file reads to cut evaluation cost ~90%, and (3) a VC portfolio discovery pipeline that surfaces high-signal startup opportunities before they hit job boards. The filesystem (cv.md, modes/, data/, reports/, config/) remains the system of record — Electron is a third client alongside the existing Go TUI and `claude -p` batch path. Phases 1 and 2 build the GUI from read-only shell through write-safe Anthropic integration; Phase 3 delivers the VC discovery pipeline as an independent feature that can overlap with Phase 2.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Electron Shell + Read-Only Views** - Secure Electron baseline rendering tracker, reports, and pipeline from existing file-backed state
- [ ] **Phase 2: Write Safety + Anthropic Integration** - Concurrent-write hardening, streaming evaluation, prompt caching, smart file reads
- [ ] **Phase 3: VC Portfolio Discovery** - Scrape 10 VC firms, filter by funding + active listings, surface and manage via GUI

## Phase Details

### Phase 1: Electron Shell + Read-Only Views
**Goal**: Users can launch a secure Electron desktop app that renders the same tracker, reports, and pipeline data as the Go TUI — proving the file bridge before any write path is introduced
**Depends on**: Nothing (first phase)
**Requirements**: ELEC-01, ELEC-02, ELEC-03, ELEC-04, ELEC-05
**Success Criteria** (what must be TRUE):
  1. User can launch the Electron app and it opens with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP enforced, and a narrow `contextBridge` surface (one function per operation)
  2. User can view all 740+ rows from `data/applications.md` with virtualized rendering that stays smooth while scrolling
  3. User can open any report file from `reports/*.md` and read it rendered as formatted markdown inside the app
  4. User can see the pipeline inbox from `data/pipeline.md` with pending URLs listed
  5. User can pick a canonical status from a dropdown whose options are loaded from `templates/states.yml` (selection UI exists; persistence hardens in Phase 2)
**Plans**: 5 plans
  - [x] 01-01-PLAN.md — Electron workspace scaffold: package.json, electron-vite config, Tailwind + Catppuccin tokens, TypeScript, renderer entry HTML
  - [x] 01-02-PLAN.md — Main process, preload bridge, Zod-validated IPC handlers, chokidar watcher, parsers ported from career.go + statuses.mjs
  - [x] 01-03-PLAN.md — Renderer shell: AppShell, Sidebar, shared components (ScoreBadge, StatusBadge, FileChangeBanner, EmptyState, ErrorState) + human-verify checkpoint
  - [x] 01-04-PLAN.md — Tracker panel (react-window virtualization, 9-column row), disabled StatusSelect (ELEC-03 plumbing proof), SplitPaneLayout
  - [x] 01-05-PLAN.md — ReportViewer (react-markdown + GFM + sanitize), ReportsPanel, PipelinePanel, final App wiring + phase-exit human verification
**UI hint**: yes

### Phase 2: Write Safety + Anthropic Integration
**Goal**: Users can evaluate job URLs directly inside the Electron app with streaming Claude output, see cache-hit indicators prove token savings on repeat runs, and trust that every GUI write to the tracker is race-safe against the batch path
**Depends on**: Phase 1
**Requirements**: ELEC-06, ELEC-07, ELEC-08, API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. User can paste a job URL into the GUI and watch an A-G evaluation report stream token-by-token into the viewer, with a working Cancel button and visible error handling for 429/500/auth failures
  2. User can run a second evaluation within one hour of the first and see `cache_read_input_tokens > 0` along with a per-evaluation token cost counter in the UI
  3. User can configure their Anthropic API key through the GUI and it is stored via `safeStorage` (or `keytar`), never logged, never exposed to the renderer
  4. User can trigger batch evaluation runs and portal scans (`scan.mjs`) from the GUI, and can regenerate their CV PDF in one click from a CV viewer
  5. All GUI writes to `applications.md` go through the TSV-addition pattern (`batch/tracker-additions/` + `merge-tracker.mjs`) with `proper-lockfile` + `write-file-atomic`; zero corruption across 100+ interleaved GUI+batch operations
  6. Repeat evaluations with unchanged context files (`cv.md`, `_profile.md`, `_shared.md`, `profile.yml`) skip re-reading via `data/.mtime-cache.json` sidecar — verifiable by mtime inspection
**UI hint**: yes
**Plans**: 6 plans
  - [x] 02-01-PLAN.md — Write safety foundation: proper-lockfile wrapping merge-tracker.mjs, status-writer service, pendingGuiWrites watcher extension, mtime-cache (Node + TS)
  - [x] 02-02-PLAN.md — Anthropic integration + full IPC surface: key-store, evaluation-service (streaming + caching), process-runner, preferences, preload + ipc-handlers expansion, main/index.ts wiring
  - [x] 02-03-PLAN.md — Evaluate panel + Settings slide-over: StreamingReportView, TokenStatsRow, InlineErrorBanner, EvaluatePanel, SettingsSlideOver with ApiKeyField / VerifyButton / ModelSelect
  - [x] 02-04-PLAN.md — Per-row status editing: rewrite StatusSelect as inline control, extend TrackerRow with edit state, refactor TrackerPanel coordinator, add StatusUpdateToast
  - [x] 02-05-PLAN.md — CV panel + Operations drawer + 5-panel app wiring: CvPanel, PdfToast, OperationsLogDrawer, DrawerTab, OpBadge, GearIcon, Sidebar extension, PipelinePanel actions, App.tsx composition
  - [x] 02-06-PLAN.md — Phase verification: automated structural + stress test runner, human-verify UI checklist, 02-VERIFICATION.md ledger

### Phase 3: VC Portfolio Discovery
**Goal**: Users can discover startup opportunities from 10 leading VC portfolios — filtered to firms with recent funding AND active listings matching their target roles — and promote promising companies into the pipeline without editing any config file
**Depends on**: Phase 1 (can overlap with Phase 2)
**Requirements**: VC-01, VC-02, VC-03, VC-04, VC-05, VC-06
**Success Criteria** (what must be TRUE):
  1. User can run `node scrape-vcs.mjs` from the CLI or trigger it from the GUI and see `data/vc-companies.tsv` populated with deduped companies from all 10 firms (a16z, Sequoia, Benchmark, Accel, General Catalyst, Coatue, Founders Fund, Khosla, Index, Lightspeed), respecting robots.txt and serialized with request delays
  2. User can browse a VC discovery view in the GUI showing companies filtered to those with funding in the last 12 months AND active listings matching target roles from `config/profile.yml` — with company name, firm, funding signal, and a working "Promote to pipeline" button that appends the careers URL to `data/pipeline.md`
  3. User can see a scraper health panel showing per-firm last-run timestamp, company count, and an alert when any firm's count drops >20% (DOM drift signal)
  4. User can add a new VC firm through the GUI by providing a firm name and portfolio URL; the entry is persisted to `config/vc-firms.yml` (or `portals.yml`) and included in the next scrape run without manual file editing
  5. Scraper runs on a configurable monthly cadence by default and maintains a per-firm baseline count to support the >20% drop alert
**Plans**: 3 plans
  - [x] 03-01-PLAN.md — Standalone scraper CLI: scrape-vcs.mjs + 10 per-firm Playwright adapters + scraper libraries (robots, tsv-writer, health, role-matcher, funding-detector) + config/vc-firms.yml defaults (VC-01, VC-02, VC-03)
  - [x] 03-02-PLAN.md — Electron main process: 8 IPC channels (runVcScrape, readVcCompanies, readVcHealth, promoteToPipeline, listVcFirms, addVcFirm, getVcScrapeInterval, setVcScrapeInterval) + node-cron scheduler + vc-firms/vc-companies/vc-health/promote/url-probe services + preload bridge + watcher extension (VC-04, VC-05, VC-06 main-side)
  - [ ] 03-03-PLAN.md — Renderer Discover panel: 6th sidebar entry (Compass), virtualized 5-column CompanyTable + CompanyRow, VcDropAlertBanner, ScraperHealthPanel accordion, AddFirmModal with HEAD-probe + Save-anyway override, Settings VcScraperSection with cron schedule + Run scan now, App.tsx wiring (VC-04, VC-05, VC-06 UI)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 (Phase 3 may begin any time after Phase 1 completes; can overlap with Phase 2).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Electron Shell + Read-Only Views | 0/5 | Not started | - |
| 2. Write Safety + Anthropic Integration | 0/TBD | Not started | - |
| 3. VC Portfolio Discovery | 0/3 | Not started | - |
