# JobEngine v2

## What This Is

An enhanced AI-powered job search system that discovers high-signal startup opportunities by scraping leading VC firm portfolio pages, filters them by recent funding and active job listings, evaluates them using Claude with prompt caching for token efficiency, and surfaces everything through a polished Electron desktop app that replaces the CLI workflow. The existing file-backed state (cv.md, config/, data/, reports/) is preserved and extended — the Electron app reads the same artifacts the CLI produces.

## Core Value

Surface the right startup opportunities from leading VC portfolios before they appear on job boards, and manage the entire pipeline from discovery through offer — without opening a terminal.

## Requirements

### Validated

- ✓ Job offer evaluation with A–F scoring — existing (`modes/oferta.md`)
- ✓ CV generation: HTML→PDF via Playwright — existing (`generate-pdf.mjs`)
- ✓ Application tracker (Markdown table + TSV merge) — existing (`data/applications.md`, `merge-tracker.mjs`)
- ✓ Batch processing: parallel evaluations via `claude -p` — existing (`batch/batch-runner.sh`)
- ✓ Portal scanning: Greenhouse/Ashby/Lever APIs, zero LLM cost — existing (`scan.mjs`)
- ✓ Pipeline/status tracking with canonical states — existing (`templates/states.yml`)
- ✓ Multi-language modes (EN, DE, FR, JA, PT, RU) — existing (`modes/*/`)
- ✓ Pattern analysis and follow-up cadence — existing (`analyze-patterns.mjs`, `followup-cadence.mjs`)
- ✓ Go TUI dashboard (Bubble Tea) — existing (`dashboard/`)

### Active

- [ ] VC portfolio scraper — periodically scrape portfolio pages from 10 firms (a16z, Sequoia, Benchmark, Accel, General Catalyst, Coatue, Founders Fund, Khosla, Index, Lightspeed) and store discovered companies
- [ ] Company filtering pipeline — surface companies with funding announced in last 12 months AND active job listings matching target roles from `config/profile.yml`
- [ ] Electron desktop app — full GUI replacement for CLI; calls Claude Anthropic API directly (not CLI wrapping); reads the same file-backed state (cv.md, data/, reports/)
- [ ] Claude prompt caching — cache CV, profile, and shared mode context using `cache_control` to cut repeated evaluation cost ~90%
- [ ] Smarter file reads — track file modification timestamps so unchanged context (cv.md, _profile.md, _shared.md) is not re-read on repeated evaluations

### Out of Scope

- Automatic application submission — user always reviews before Submit; ethical constraint from existing system
- Mobile app — local-first desktop (Electron) only
- Cloud sync or remote state — all data stays local (cv.md, config/, data/, reports/)
- Replacing existing mode files or language translations — Electron consumes them, doesn't replace them
- AI/ML product focus filter — filtering by recent funding + active listings is more objective; "interesting" determined by evaluation score

## Context

- Chris used v1 to evaluate 740+ offers and land a Head of Applied AI role — v2 is a capability and UX evolution, not a rethink
- Existing Node automation layer, Go TUI dashboard, batch orchestration, and multi-language prompt contracts are preserved and extended
- Electron app calls Claude API directly — API key management, prompt caching, and streaming are first-class concerns; the existing `claude -p` batch path remains for headless use
- Token efficiency matters at scale: VC portfolio discovery could surface hundreds of companies, multiplying evaluation cost without caching
- VC scraping targets public portfolio pages (not APIs) — scraping logic needs to handle DOM variability across firm sites
- The 10 target VC firms cover both top-tier generalist (a16z, Sequoia, Benchmark, Accel, General Catalyst) and AI/tech-focused (Coatue, Founders Fund, Khosla, Index, Lightspeed)

## Constraints

- **Tech**: Electron + Node backend; Anthropic SDK for all Claude calls in the GUI path
- **Data contract**: Existing files (cv.md, config/profile.yml, modes/_profile.md, data/, reports/) are USER LAYER — Electron reads/writes same files, no schema changes without migration
- **Ethics**: Never auto-submit applications; always pause for user review before any form Submit
- **Local-only**: No cloud services, no remote database; everything runs on the user's machine
- **Scraping**: VC portfolio pages are public HTML — no login or API keys needed; pages change, so scraper must be maintainable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + Anthropic API directly | Enables prompt caching, streaming, and full control without CLI dependency | — Pending |
| Live VC portfolio scraping (not static list) | Stays current as firms add portfolio companies; static lists go stale | — Pending |
| Filter by recent funding + active listings | Objective signals; avoids subjective AI-focus guessing | — Pending |
| Preserve file-backed state (no DB migration) | Electron reads same Markdown/YAML/TSV files; zero data migration risk | — Pending |
| Keep existing batch/CLI path alongside Electron | Headless batch processing remains valid for large runs; GUI for day-to-day use | — Pending |

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
*Last updated: 2026-04-21 after initialization*
