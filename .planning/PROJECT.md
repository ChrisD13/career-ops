# JobEngine v2

## What This Is

An AI-powered job search system that surfaces high-signal startup opportunities from leading VC portfolios, evaluates them with streaming Claude analysis and prompt caching, and manages the entire pipeline from discovery through offer — delivered as an Electron desktop app that reads the same file-backed artifacts as the existing CLI tools.

## Core Value

Discover and evaluate the right startup opportunities before they reach job boards — from a single desktop app, without opening a terminal.

## Current Milestone: v1.2 — Setup & CV Management

**Goal:** Eliminate the two biggest post-install friction points — launching the app and keeping CV content fresh.

**Target features:**
- Desktop shortcut — auto-created on first packaged launch; writes `~/.local/share/applications/jobengine.desktop`
- CV upload — file picker in the app; accepts `.md` (direct replace) and `.pdf` (text extraction → cv.md)

## Current State (v1.1 — Shipped 2026-04-24)

- Electron app ships: tracker, reports, pipeline, evaluate, CV, operations drawer, Discover panel, **Analytics panel**
- VC scraper: 10 per-firm Playwright adapters, regression harness (34/34 tests), `validate-adapters.mjs` for live validation
- Anthropic integration: streaming evaluation, prompt caching (cache_control), mtime context dedup, safeStorage API key
- Auto-update: `electron-updater` wired to GitHub Releases, UpdateBanner with one-click install + per-version dismiss
- Response-rate analytics: score-to-outcome correlation panel, application funnel, auto-refreshing on file change
- Write safety: `proper-lockfile` + `write-file-atomic` across all GUI write paths
- Human UAT deferred: 14 items across Phases 2–5 (require packaged AppImage or live services)
- **User setup required before first release:** fill `owner` + `repo` in `electron/package.json` build.publish

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

### Validated (v1.1)

- ✓ ADPT-01: All 10 VC firm scrapers produce valid output against live pages — v1.1, Phase 4
- ✓ ADPT-02: Per-firm scrape errors visible in Discover panel health view — v1.1, Phase 4
- ✓ ADPT-03: Regression harness catches selector drift before runtime — v1.1, Phase 4
- ✓ UPD-01: App checks GitHub Releases on startup (non-blocking) — v1.1, Phase 5 (runtime UAT deferred)
- ✓ UPD-02: User sees update prompt with release notes — v1.1, Phase 5 (runtime UAT deferred)
- ✓ UPD-03: One-click install or dismiss with per-version reminder — v1.1, Phase 5 (runtime UAT deferred)
- ✓ ANAL-01: Score-to-outcome analytics panel — v1.1, Phase 6
- ✓ ANAL-02: Application funnel stats — v1.1, Phase 6
- ✓ ANAL-03: Panel auto-refreshes on file change — v1.1, Phase 6

### Active (next milestone candidates)

- Human UAT backlog — 14 deferred items across Phases 2, 3, 4, 5 (require packaged build or live services)
- First packaged release — fill GitHub coordinates, run `npm run dist`, publish v0.1.0 release
- Backlog items (see .planning/ROADMAP.md Backlog section if any)

### Out of Scope

- Automatic application submission — user always reviews before Submit; ethical constraint from v1
- Mobile app — desktop-only (Electron)
- Cloud sync or remote state — all data stays local
- SQLite or any database — file-backed state preserved
- Interview prep panel — project scope is discovery and application automation only

## Context

- Chris used v1 to evaluate 740+ offers and land a Head of Applied AI role — v2 is a capability and UX evolution
- Electron app calls Claude API directly — API key management, prompt caching, and streaming are first-class
- VC scraping targets public portfolio pages (not APIs) — DOM variability handled; regression harness catches drift
- v1.1: 77 files changed, ~99K insertions across 20 days (2026-04-04 → 2026-04-24)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + Anthropic API directly | Enables prompt caching, streaming, and full control without CLI dependency | ✓ Good — cache_control works cleanly; streaming UX smooth |
| Live VC portfolio scraping (not static list) | Stays current as firms add portfolio companies; static lists go stale | ✓ Good — Playwright adapters handle SPA hydration; graceful degrade on drift |
| Filter by recent funding + active listings | Objective signals; avoids subjective AI-focus guessing | ✓ Good — RSS + Google News heuristics sufficient for MVP |
| Preserve file-backed state (no DB migration) | Electron reads same Markdown/YAML/TSV files; zero data migration risk | ✓ Good — lockAndWrite + write-file-atomic proved safe in stress tests |
| Keep existing batch/CLI path alongside Electron | Headless batch processing remains valid for large runs; GUI for day-to-day use | ✓ Good — process-runner abstraction works for scan/batch/pdf/scrape uniformly |
| Worktree-based parallel execution | Allows parallel plan execution without merge conflicts | ⚠ Revisit — agents sometimes committed to parent branch; stash+merge workaround needed |
| per-runId onExit lock release in scheduler | More reliable than polling activeOpsCount() across unrelated ops | ✓ Good — cleaner than global poll |
| electron-updater + GitHub Releases (not custom server) | Public repos, no token needed for checking; standard electron-builder flow | ✓ Good — zero infra cost; draft releases invisible to runtime (expected) |
| package.json#build for publish config (not electron-builder.yml) | Avoids merge conflicts with existing build config | ✓ Good — single source of truth for build + publish |
| Analytics computed in renderer from readTracker (no new IPC) | Zero main-process changes; pure functional aggregation; easy to test | ✓ Good — computeAnalytics() is fully stateless and verifiable |
| CSS-only Tailwind bar charts (no chart library) | No new dependency; consistent with project's minimal-deps philosophy | ✓ Good — Catppuccin color tokens provide semantic score coloring |
| Cumulative funnel semantics (forward-progress counting) | Applied ≥ Responded is guaranteed; avoids misleading drops | ✓ Good — correctly handles applications that skip stages |

## Constraints

- **Tech**: Electron + Node backend; Anthropic SDK for all Claude calls in the GUI path
- **Data contract**: Existing files (cv.md, config/profile.yml, modes/_profile.md, data/, reports/) are USER LAYER — Electron reads/writes same files, no schema changes without migration
- **Ethics**: Never auto-submit applications; always pause for user review before any form Submit
- **Local-only**: No cloud services, no remote database; everything runs on the user's machine
- **Scraping**: VC portfolio pages are public HTML — no login or API keys needed; pages change, so scraper must be maintainable

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**: Move validated requirements, log decisions, check core value drift.
**After each milestone**: Full review of all sections, audit Out of Scope, update Context.

---
*Last updated: 2026-04-24 after v1.1 milestone — Live Validation + Analytics shipped*
