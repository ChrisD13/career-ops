# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Surface the right startup opportunities from leading VC portfolios before they appear on job boards, and manage the entire pipeline from discovery through offer — without opening a terminal.
**Current focus:** Phase 1 — Electron Shell + Read-Only Views

## Current Position

Phase: 1 of 3 (Electron Shell + Read-Only Views)
Plan: 0 of 5 in current phase
Status: Ready to execute
Last activity: 2026-04-21 — Roadmap created (3 phases, 19 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Electron Shell + Read-Only Views | 0/TBD | - | - |
| 2. Write Safety + Anthropic Integration | 0/TBD | - | - |
| 3. VC Portfolio Discovery | 0/TBD | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: n/a (not started)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Electron + Anthropic API directly (not `claude -p` wrapping) — enables streaming, prompt caching, cache-hit visibility
- Filesystem remains system of record — no database; Electron is third client alongside Go TUI and batch path
- VC scraper as standalone `scrape-vcs.mjs` — child_process.fork from Electron, runnable via CLI/cron
- TSV-addition pattern is mandatory for GUI tracker writes — never direct writes to `applications.md`
- Prompt cache hierarchy: `_shared.md` → `oferta.md` → `cv.md` + `article-digest.md` → `config/profile.yml` + `_profile.md` (stable → volatile), JD in user turn

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 scraper needs per-firm DOM probing for 8 of 10 firms before writing adapters (a16z + Sequoia confirmed static; rest TBD — flagged in research/SUMMARY.md)
- Funding-signal source (Crunchbase API vs. heuristics) undecided — deferred to Phase 3 planning

## Deferred Items

Items carried forward (from v2 scope decisions):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| GUI | Inline report editing (read-only in v2) | v3+ | Init |
| Update | Electron auto-update (`electron-updater`) | v2.1 | Init |
| Funding | Crunchbase API integration | Phase 3 decision | Init |
| GUI | Interview prep panel | v3+ | Init |
| GUI | Response-rate analytics dashboard | v3+ | Init |

## Session Continuity

Last session: 2026-04-22
Stopped at: Phase 1 plans complete (5 plans, 16 tasks) — ready to execute
Resume file: .planning/phases/01-electron-shell-read-only-views/01-01-PLAN.md
