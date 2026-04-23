# JobEngine v2

## What This Is

An AI-powered job search system that surfaces high-signal startup opportunities from leading VC portfolios, evaluates them with streaming Claude analysis and prompt caching, and manages the entire pipeline from discovery through offer — delivered as an Electron desktop app that reads the same file-backed artifacts as the existing CLI tools.

## Core Value

Discover and evaluate the right startup opportunities before they reach job boards — from a single desktop app, without opening a terminal.

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

### Active (Next Milestone)

- [ ] Complete Phase 2 + Phase 3 human UAT (40-step UI walkthrough + 8-item Discover panel checklist)
- [ ] VC adapter validation — run real scrapes against live firm pages; tune selectors where DOM has drifted
- [ ] Electron auto-update via `electron-updater` — manual GitHub Releases for v1.0; automated in v1.1+
- [ ] Interview prep panel in GUI
- [ ] Response-rate analytics dashboard

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

---
*Last updated: 2026-04-23 after v1.0 milestone*
