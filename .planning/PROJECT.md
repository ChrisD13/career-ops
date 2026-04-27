# JobEngine v2

## What This Is

An AI-powered job search system that surfaces high-signal startup opportunities from leading VC portfolios, evaluates them with streaming Claude analysis and prompt caching, and manages the entire pipeline from discovery through offer — delivered as an Electron desktop app that reads the same file-backed artifacts as the existing CLI tools. Users can now refresh their CV directly from the app and the app registers itself in the Linux launcher on first run.

## Core Value

Discover and evaluate the right startup opportunities before they reach job boards — from a single desktop app, without opening a terminal.

## Current State (v1.2 — Shipped 2026-04-27)

- Electron app ships: tracker, reports, pipeline, evaluate, CV, operations drawer, Discover panel, Analytics panel
- **Desktop shortcut**: auto-created on first packaged AppImage run — `~/.local/share/applications/jobengine.desktop`; idempotent (never overwrites user edits)
- **CV upload**: native file picker accepts `.md` (direct replace) and `.pdf` (unpdf extraction → review pane → atomic confirm); `cv.md` updated via `lockAndWrite`
- VC scraper: 10 per-firm Playwright adapters, regression harness (34/34 tests), `validate-adapters.mjs`
- Anthropic integration: streaming evaluation, prompt caching (`cache_control`), mtime context dedup, safeStorage API key
- Auto-update: `electron-updater` wired to GitHub Releases, UpdateBanner with one-click install + per-version dismiss
- Response-rate analytics: score-to-outcome correlation panel, application funnel, auto-refreshing on file change
- Write safety: `proper-lockfile` + `write-file-atomic` across all GUI write paths
- Human UAT deferred: 25 items total (14 from v1.0–1.1, 11 from v1.2 — require packaged AppImage or live services)
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

### Validated (v1.2)

- ✓ DESK-01: App creates `~/.local/share/applications/jobengine.desktop` on first packaged launch — v1.2, Phase 7 (code complete, E2E UAT deferred to first packaged build)
- ✓ DESK-02: Shortcut creation idempotent — skips if `.desktop` exists, never overwrites — v1.2, Phase 7
- ✓ CV-01: User opens file picker from app, selects `.md` or `.pdf` to replace `cv.md` — v1.2, Phase 8
- ✓ CV-02: `.md` file content replaces `cv.md` directly, no conversion — v1.2, Phase 8
- ✓ CV-03: `.pdf` text extracted and written to `cv.md` as plain Markdown — v1.2, Phase 8
- ✓ CV-04: PDF extraction shows in editable review pane before saving — v1.2, Phase 8 (code complete, visual UAT deferred)
- ✓ CV-05: Confirmation prompt with `cv.md` last-modified date before overwrite — v1.2, Phase 8 (code complete, visual UAT deferred)

### Active (next milestone candidates)

- **First packaged release** — fill GitHub coordinates (`owner`/`repo` in `electron/package.json`), build AppImage, publish v0.1.0 release
- **Human UAT backlog** — 25 deferred items across Phases 2–8 (require packaged AppImage or live services); can be batch-verified against the first release
- DESK-01 E2E verification — confirm `.desktop` creation + icon copy + launcher registration against packaged AppImage
- Backlog items (see `.planning/ROADMAP.md` Backlog section if any)

### Out of Scope

- Automatic application submission — user always reviews before Submit; ethical constraint from v1
- Mobile app — desktop-only (Electron)
- Cloud sync or remote state — all data stays local
- SQLite or any database — file-backed state preserved
- Interview prep panel — project scope is discovery and application automation only
- Windows/macOS shortcut support — `.desktop` is Linux-only; platform-specific shortcuts deferred

## Context

- Chris used v1 to evaluate 740+ offers and land a Head of Applied AI role — v2 is a capability and UX evolution
- Electron app calls Claude API directly — API key management, prompt caching, and streaming are first-class
- VC scraping targets public portfolio pages (not APIs) — DOM variability handled; regression harness catches drift
- v1.2: 30 commits, ~425 insertions across 10 Electron files (desktop shortcut service + CV upload IPC + 3 UI components)
- Human UAT backlog: 25 items — all blocked on packaged AppImage or live Electron session; plan a "first release" phase to clear them in batch

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
| Phase split (7 vs 8) for desktop vs CV features | Two features verify under different conditions — Phase 7 needs packaged build, Phase 8 verifies in dev mode | ✓ Good — clean verification stories per phase |
| unpdf@1.6.0 over pdf-parse / pdfjs-dist | Tree-shakeable, no native bindings, pure JS extraction | ✓ Good — clean import; extractText + getDocumentProxy work correctly |
| seed-if-missing guard before lockAndWrite (cv.md) | lockAndWrite reads before write; cv.md can be absent on fresh installs | ✓ Good — guards against ENOENT without altering the write primitive |
| getCvMtime() at confirm-modal-open (not at file-pick) | Ensures mtime is current if user deliberates on review modal | ✓ Good — 2 call sites in CvPanel; mtime always reflects disk state at confirm time |
| bg-ctp-mauve reserved to Replace button only | UI-SPEC design contract set before planning prevented color inconsistency | ✓ Good — zero design drift; grep count = 1 confirmed in verification |

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
*Last updated: 2026-04-27 after v1.2 milestone — Setup & CV Management shipped*
