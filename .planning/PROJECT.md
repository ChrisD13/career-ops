# JobEngine v2

## What This Is

An AI-powered job search system that surfaces high-signal startup opportunities from leading VC portfolios, evaluates them with streaming Claude analysis and prompt caching, and manages the entire pipeline from discovery through offer — delivered as an Electron desktop app that reads the same file-backed artifacts as the existing CLI tools.

## Core Value

Discover and evaluate the right startup opportunities before they reach job boards — from a single desktop app, without opening a terminal.

## Current Milestone: v1.1 — Live Validation + New Panels

**Goal:** Validate the VC scraper against live firm pages, add auto-update infrastructure, and ship two new Electron panels (response-rate analytics, interview prep with Claude).

**Target features:**
- VC adapter validation — run real scrapes against all 10 firms, fix drifted selectors, add regression harness
- Electron auto-update — `electron-updater` wired to GitHub Releases with in-app install prompt
- Response-rate analytics dashboard — new panel showing score-to-outcome correlation and funnel stats
- Interview prep panel — per-company Claude-generated prep reports, stored in `interview-prep/`, surfaced in GUI

## Current State (v1.0 — Shipped 2026-04-23)

- Electron app ships: tracker, reports, pipeline, evaluate, CV, operations drawer, Discover panel
- VC scraper: `scrape-vcs.mjs` + 10 per-firm Playwright adapters + funding/role-match filter
- Anthropic integration: streaming evaluation, prompt caching (cache_control), mtime context dedup, safeStorage API key
- Write safety: `proper-lockfile` + `write-file-atomic` across all GUI write paths
- All 19 v2 requirements covered at the code level; human UAT for Phases 2+3 deferred

## Requirements

### Validated (v1.0)

- ✓ Job offer evaluation with A–F scoring — existing (`modes/oferta.md`)
- ✓ CV generation: HTML→PDF via Playwright — existing (`generate-pdf.mjs`)
- ✓ Application tracker (Markdown table + TSV merge) — existing (`data/applications.md`, `merge-tracker.mjs`)
- ✓ Batch processing: parallel evaluations via `claude -p` — existing (`batch/batch-runner.sh`)
- ✓ Portal scanning: Greenhouse/Ashby/Lever APIs, zero LLM cost — existing (`scan.mjs`)
- ✓ Pipeline/status tracking with canonical states — existing (`templates/states.yml`)
- ✓ Multi-language modes (EN, DE, FR, JA, PT, RU) — existing (`modes/*/`)
- ✓ Pattern analysis and follow-up cadence — existing (`analyze-patterns.mjs`, `followup-cadence.mjs`)
- ✓ Go TUI dashboard (Bubble Tea) — existing (`dashboard/`)
- ✓ Secure Electron desktop app (ELEC-01–05) — v1.0, Phase 1
- ✓ Write safety + Anthropic integration (ELEC-06–08, API-01–05) — v1.0, Phase 2 (code complete, UAT deferred)
- ✓ VC portfolio discovery (VC-01–06) — v1.0, Phase 3 (code complete, UAT deferred)

### Active (v1.1)

- [ ] ADPT-01: All 10 VC firm scrapers produce valid output against live pages
- [ ] ADPT-02: Per-firm scrape errors visible in Discover panel health view
- [ ] ADPT-03: Regression harness catches selector drift before it reaches users
- [ ] UPD-01: App checks for new GitHub Releases on startup (background, non-blocking)
- [ ] UPD-02: User sees update prompt with release notes when a newer version is available
- [ ] UPD-03: User can install update with one click or defer to later
- [ ] ANAL-01: Response-rate analytics panel shows score-to-outcome correlation
- [ ] ANAL-02: Funnel stats visible (applied → responded → interview → offer)
- [ ] ANAL-03: Panel auto-refreshes when applications.md changes
- [ ] PREP-01: User can generate a Claude-powered interview prep report from any tracker row
- [ ] PREP-02: Prep report streams in-app and is saved to interview-prep/ directory
- [ ] PREP-03: User can browse and view existing prep reports from the panel
- [ ] PREP-04: Prep generation uses prompt caching for CV and profile context

### Out of Scope

- Automatic application submission — user always reviews before Submit; ethical constraint from v1
- Mobile app — desktop-only (Electron)
- Cloud sync or remote state — all data stays local
- Replacing existing mode files or language translations — Electron consumes them, doesn't replace them
- Crunchbase API for funding signals — heuristics (RSS, press, Google News) in v1.0; API optional in v2
- SQLite or any database — file-backed state preserved

## Context

- Chris used v1 to evaluate 740+ offers and land a Head of Applied AI role — v2 is a capability and UX evolution, not a rethink
- Electron app calls Claude API directly — API key management, prompt caching, and streaming are first-class; existing `claude -p` batch path remains for headless use
- VC scraping targets public portfolio pages (not APIs) — scraping logic handles DOM variability; graceful degrade with `no cards found` log
- 342 files changed, 46,149 lines added across 19 days of development

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + Anthropic API directly | Enables prompt caching, streaming, and full control without CLI dependency | ✓ Good — cache_control works cleanly; streaming UX smooth |
| Live VC portfolio scraping (not static list) | Stays current as firms add portfolio companies; static lists go stale | ✓ Good — Playwright adapters handle SPA hydration; graceful degrade on drift |
| Filter by recent funding + active listings | Objective signals; avoids subjective AI-focus guessing | ✓ Good — RSS + Google News heuristics sufficient for MVP |
| Preserve file-backed state (no DB migration) | Electron reads same Markdown/YAML/TSV files; zero data migration risk | ✓ Good — lockAndWrite + write-file-atomic proved safe in stress tests |
| Keep existing batch/CLI path alongside Electron | Headless batch processing remains valid for large runs; GUI for day-to-day use | ✓ Good — process-runner abstraction works for scan/batch/pdf/scrape uniformly |
| Worktree-based parallel execution | Allows parallel plan execution without merge conflicts | ⚠ Revisit — agents sometimes committed to parent branch instead of worktree branch; sequential dispatch helps but doesn't fully eliminate |
| per-runId onExit lock release in scheduler | More reliable than polling activeOpsCount() across unrelated ops | ✓ Good — WR-01 fix from code review; cleaner than global poll |

## Constraints

- **Tech**: Electron + Node backend; Anthropic SDK for all Claude calls in the GUI path
- **Data contract**: Existing files (cv.md, config/profile.yml, modes/_profile.md, data/, reports/) are USER LAYER — Electron reads/writes same files, no schema changes without migration
- **Ethics**: Never auto-submit applications; always pause for user review before any form Submit
- **Local-only**: No cloud services, no remote database; everything runs on the user's machine
- **Scraping**: VC portfolio pages are public HTML — no login or API keys needed; pages change, so scraper must be maintainable

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-23 — v1.1 milestone started*
