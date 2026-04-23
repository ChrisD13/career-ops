---
phase: "03"
plan: "01"
subsystem: "scraper"
tags: [vc-scraper, playwright, node-esm, tsv, health, role-match, funding-detector]

dependency_graph:
  requires:
    - scan.mjs (detectApi, buildTitleFilter exports)
    - config/profile.yml (target_roles for role-matcher keywords)
    - playwright (already installed for PDF generation)
    - js-yaml (already installed)
  provides:
    - scrape-vcs.mjs (CLI scraper entry point)
    - scrapers/robots.mjs (robots.txt check + randomDelay)
    - scrapers/tsv-writer.mjs (atomic TSV read/write/merge)
    - scrapers/health.mjs (atomic JSON health sidecar)
    - scrapers/role-matcher.mjs (ATS probe + title filter)
    - scrapers/funding-detector.mjs (RSS + Google News heuristics)
    - scrapers/adapters/*.mjs (10 firm adapters + registry)
    - config/vc-firms.yml (10 default firms, Benchmark disabled)
    - data/vc-companies.tsv (scraper output schema established)
    - data/vc-health.json (health sidecar schema established)
  affects:
    - package.json (3 new deps: node-cron, robots-parser, write-file-atomic)

tech_stack:
  added:
    - node-cron@^4.2.1 (installed, will be used by Electron scheduler in Plan 02)
    - robots-parser@^3.0.1 (RFC 9309-compliant robots.txt parsing)
    - write-file-atomic@^7.0.1 (temp+rename atomic writes for TSV and JSON)
  patterns:
    - per-firm adapter architecture (one file per firm, shared interface)
    - adapter registry (firm name → async function, __generic__ fallback)
    - robots.txt in-memory cache (one fetch per origin per run)
    - high-water-mark baseline rule (baseline_count never decreases)
    - TSV dedup-and-rewrite (mergeCompanies preserves promoted flag)
    - direct-run guard (pathToFileURL pattern from scan.mjs)

key_files:
  created:
    - scrape-vcs.mjs
    - scrapers/robots.mjs
    - scrapers/tsv-writer.mjs
    - scrapers/health.mjs
    - scrapers/role-matcher.mjs
    - scrapers/funding-detector.mjs
    - scrapers/adapters/a16z.mjs
    - scrapers/adapters/sequoia.mjs
    - scrapers/adapters/benchmark.mjs
    - scrapers/adapters/accel.mjs
    - scrapers/adapters/general-catalyst.mjs
    - scrapers/adapters/coatue.mjs
    - scrapers/adapters/founders-fund.mjs
    - scrapers/adapters/khosla.mjs
    - scrapers/adapters/index-ventures.mjs
    - scrapers/adapters/lightspeed.mjs
    - scrapers/adapters/index.mjs
    - config/vc-firms.yml
    - config/vc-firms.example.yml
  modified:
    - package.json (3 new deps added)

decisions:
  - "Benchmark firm: --firm flag bypasses enabled/portfolio_url filter (explicit intent) so benchmark dry-run smoke test works; normal runs still skip disabled firms"
  - "robots.txt check skipped when portfolio_url is empty (Benchmark stub path); avoids URL parse error on empty string"
  - "mergeCompanies dedupe key is firm+company (not company alone) to allow same company across multiple firms"
  - "funding-detector uses per-firm RSS cache (rssCache Map) keyed by firm name to avoid refetching per company"

metrics:
  duration: "~25 minutes"
  tasks_completed: 3
  files_changed: 20
  completed_date: "2026-04-23"
---

# Phase 3 Plan 01: VC Portfolio Scraper — Summary

**One-liner:** Standalone Playwright scraper with per-firm adapter registry, RSS/Google News funding heuristics, and ATS-based role matching that writes `data/vc-companies.tsv` + `data/vc-health.json` via atomic writes.

## What Was Built

### Task 1: Scraper library modules + deps + config (commit: ad20f98)

Installed three new root deps (`node-cron@4.2.1`, `robots-parser@3.0.1`, `write-file-atomic@7.0.1`) and created five library modules:

- **`scrapers/robots.mjs`** — wraps `robots-parser` with an in-memory origin cache; exposes `checkAllowed(url)` and `randomDelay(min, max)`. User-Agent: `JobEngineBot/1.0`.
- **`scrapers/tsv-writer.mjs`** — `readExistingCompanies`, `writeCompaniesTsv` (atomic via `write-file-atomic`), `mergeCompanies` (dedupe by firm+company, preserves `promoted=true` flag).
- **`scrapers/health.mjs`** — `readHealth` / `writeHealth` merging per-firm updates into `data/vc-health.json`; baseline never decreases (high-water-mark rule).
- **`scrapers/role-matcher.mjs`** — imports `detectApi` + `buildTitleFilter` from `scan.mjs` directly; `extractRoleKeywords` reads `target_roles.primary` + `archetypes[*].name` from profile; `detectRoleMatches` probes ATS APIs and returns comma-separated matched keywords.
- **`scrapers/funding-detector.mjs`** — Signal A: firm blog RSS (`/feed/`) with `rssCache` per firm; Signal B: Google News RSS search. Word-boundary regex on company name (escapeRegex). Pitfall 8 guard (Content-Type + try/catch). 12-month window.

Also shipped `config/vc-firms.yml` + `config/vc-firms.example.yml` with 10 default firms (Benchmark disabled, empty portfolio_url).

### Task 2: 10 per-firm adapters + adapter registry (commit: 508ec9a)

Created one adapter file per firm in `scrapers/adapters/`. All adapters share the contract: `async function scrape(context, { log, firm }) -> Promise<Array<{ name, website, careers_url }>>`.

| Adapter | Strategy | Notes |
|---------|----------|-------|
| a16z | JS-rendered + "Load All" click | waitUntil networkidle |
| Sequoia | SPA + waitForSelector | waitUntil networkidle, 45s timeout |
| Benchmark | Stub — returns [] | Logs informative message; no page.goto |
| Accel | JS-rendered + "Load More" loop | Capped at 20 iterations |
| General Catalyst | Paginated | Up to 15 pages |
| Coatue | Static + "Load more" tail | Capped at 10 clicks |
| Founders Fund | Static, detail page links | Single page |
| Khosla | Static, categorized grid | External links |
| Index Ventures | Static, full list in markup | |
| Lightspeed | Static, 500+ entries | 45s timeout |

`scrapers/adapters/index.mjs` exports the registry `{ 'a16z': fn, 'Sequoia': fn, ..., '__generic__': fn }`. The `__generic__` fallback filters external links by text length (1-80 chars) to reduce nav-link noise.

### Task 3: scrape-vcs.mjs CLI entry point (commit: efbcb7a)

The orchestrator follows the `scan.mjs` structural template exactly:
- Shebang + JSDoc header + config constants
- `main()` with arg parsing (`--dry-run`, `--firm`)
- Serialized firm loop: robots.txt → adapter → per-company enrichment (funding + role-match) → mergeCompanies → writeCompaniesTsv + writeHealth
- `isDirectRun` guard (pathToFileURL pattern)
- Named export `{ main }` for Electron child_process.fork

**Deviation applied:** `--firm` flag bypasses the `enabled !== false && portfolio_url` filter so `--firm benchmark --dry-run` works for testing; normal runs without `--firm` still honor the enabled/portfolio_url gates.

## Smoke Test Result

```
node scrape-vcs.mjs --firm benchmark --dry-run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VC Scrape — 2026-04-23 (dry-run)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Firms to scan:       1
Role keywords:       0
[Benchmark] scraping…
[Benchmark] Benchmark has no public portfolio page — set portfolio_url to a mirror...
[Benchmark] adapter returned 0 companies
Dry-run — no files written.
Exit code: 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed --firm flag failing for disabled firms**
- **Found during:** Task 3 smoke test
- **Issue:** The plan's firm-selection logic filtered by `enabled !== false && portfolio_url` BEFORE applying `firmFilter`, so `--firm benchmark` found no matching enabled firms and exited with error
- **Fix:** When `--firm` is specified, bypass the enabled/portfolio_url filter (explicit user intent). Only normal runs (no `--firm`) filter disabled firms.
- **Files modified:** `scrape-vcs.mjs`
- **Commit:** efbcb7a

**2. [Rule 2 - Missing critical functionality] Guard robots.txt check for empty portfolio_url**
- **Found during:** Task 3 smoke test (would have thrown on `new URL('')`)
- **Issue:** `checkAllowed(firm.portfolio_url)` called `new URL('')` which throws for Benchmark's empty URL
- **Fix:** Only call `checkAllowed` when `firm.portfolio_url` is non-empty
- **Files modified:** `scrape-vcs.mjs`
- **Commit:** efbcb7a

## Known Stubs

None. All TSV columns and health JSON fields are populated at scrape time. Benchmark returns `[]` by design (documented behavior, not a data stub).

## Threat Flags

None. All surfaces in this plan (local file reads, external HTTP fetches, TSV writes) were covered in the plan's threat model (T-03-01 through T-03-08). No new unmodeled surfaces introduced.

## Self-Check: PASSED

All 19 created files verified present. All 3 commits verified in git log:
- `ad20f98` — feat(03-01): add scraper deps, vc-firms config, and library modules
- `508ec9a` — feat(03-01): implement 10 per-firm Playwright adapters and adapter registry
- `efbcb7a` — feat(03-01): add scrape-vcs.mjs CLI orchestrator with dry-run and --firm flags
