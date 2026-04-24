# Roadmap: JobEngine v2

## Milestones

- ✅ **v1.0 JobEngine v2 MVP** — Phases 1–3 (shipped 2026-04-23)
- 🚧 **v1.1 Live Validation + Analytics** — Phases 4–6 (in progress)

## Phases

<details>
<summary>✅ v1.0 JobEngine v2 MVP (Phases 1–3) — SHIPPED 2026-04-23</summary>

- [x] Phase 1: Electron Shell + Read-Only Views (5/5 plans) — completed 2026-04-22
- [x] Phase 2: Write Safety + Anthropic Integration (6/6 plans) — completed 2026-04-22
- [x] Phase 3: VC Portfolio Discovery (3/3 plans) — completed 2026-04-23

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Live Validation + Analytics (In Progress)

**Milestone Goal:** Validate the VC scraper against live firm pages, ship auto-update infrastructure, and deliver a response-rate analytics panel — keeping the project focused on job discovery and application automation.

## Phase Details

### Phase 4: VC Adapter Validation
**Goal**: All 10 VC firm scrapers are validated against live pages and drifting selectors are caught by a regression harness before they reach users
**Depends on**: Phase 3
**Requirements**: ADPT-01, ADPT-02, ADPT-03
**Success Criteria** (what must be TRUE):
  1. User can run a full scrape and see at least one company record returned from each of the 10 VC firms
  2. User can open the Discover panel health view and see per-firm status including any errors (selector miss, timeout, robots block)
  3. A test run against saved fixtures catches a deliberately broken selector and reports failure without hitting live pages
**Plans:** 4 plans
Plans:
- [x] 04-01-PLAN.md — Canonical reason codes: normalizeReason() + 3 scrape-vcs callsites + inline reason text in ScraperHealthPanel (ADPT-02)
- [x] 04-02-PLAN.md — validate-adapters.mjs + selector drift fixes + 10 captured HTML fixtures (ADPT-01)
- [x] 04-03-PLAN.md — Offline Playwright regression harness at tests/adapters.test.mjs via context.route() (ADPT-03)
- [x] 04-04-PLAN.md — Gap closure: bake resolved Alpine aria-label into a16z fixture capture, re-capture, unskip positive test (ADPT-03)

### Phase 5: Electron Auto-Update
**Goal**: The app silently checks GitHub Releases on startup and lets the user install a new version with one click
**Depends on**: Phase 4
**Requirements**: UPD-01, UPD-02, UPD-03
**Success Criteria** (what must be TRUE):
  1. App starts without blocking UI while checking for updates in the background
  2. When a newer GitHub Release exists, user sees an in-app banner or dialog with the version number and release notes
  3. User can click once to download and install the update, or dismiss and have the prompt return on next launch
**Plans:** 3 plans
Plans:
- [x] 05-01-PLAN.md — electron-updater dep + GitHub publish config + UpdaterStatus type + preload IPC bridge (UPD-01, UPD-02, UPD-03)
- [x] 05-02-PLAN.md — services/updater.ts + ipc-handlers updater:install/dismiss + index.ts setTimeout wiring (UPD-01, UPD-03)
- [x] 05-03-PLAN.md — UpdateBanner component + App.tsx mount (UPD-02, UPD-03)

### Phase 6: Response-Rate Analytics Dashboard
**Goal**: Users can see score-to-outcome correlation and funnel stats for their application history in a dedicated Electron panel
**Depends on**: Phase 5
**Requirements**: ANAL-01, ANAL-02, ANAL-03
**Success Criteria** (what must be TRUE):
  1. User can open an Analytics panel showing response rates grouped by score bucket (e.g., 4.5–5.0, 4.0–4.4, etc.)
  2. User can see a funnel showing counts at each stage: applied → responded → interview → offer
  3. Panel data updates automatically when the user (or any process) writes to applications.md, without requiring a manual refresh
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Electron Shell + Read-Only Views | v1.0 | 5/5 | Complete | 2026-04-22 |
| 2. Write Safety + Anthropic Integration | v1.0 | 6/6 | Complete | 2026-04-22 |
| 3. VC Portfolio Discovery | v1.0 | 3/3 | Complete | 2026-04-23 |
| 4. VC Adapter Validation | v1.1 | 4/4 | Complete | 2026-04-24 |
| 5. Electron Auto-Update | v1.1 | 0/3 | Not started | - |
| 6. Response-Rate Analytics Dashboard | v1.1 | 0/3 | Not started | - |
