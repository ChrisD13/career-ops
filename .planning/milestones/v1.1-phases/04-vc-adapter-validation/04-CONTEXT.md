# Phase 4: VC Adapter Validation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate all 10 VC firm scrapers against live pages, catch drifting selectors with a fixture-based regression harness, and surface per-firm status (including distinct error reason codes) in the Discover panel health view — so selector drift is caught before it reaches users.

</domain>

<decisions>
## Implementation Decisions

### Regression Harness Architecture
- Fixtures stored at `tests/fixtures/adapters/{firm-name}.html` — follows existing `tests/fixtures/scanner/` pattern
- Broken-selector detection via `page.setContent()` with fixture HTML — Playwright loads local HTML without network, exercises real parsing path
- Harness entry point: `tests/adapters.test.mjs` — fits `npm test` (Node test runner picks up `tests/*.test.mjs` automatically)
- Tests use a real Playwright browser launch with `page.setContent()` — exercises full adapter parsing path, not mocked

### Live Validation Approach
- Dedicated `validate-adapters.mjs` script — separate from `npm test` since it hits real sites and is slow; not part of CI by default
- Failure threshold: 0 companies returned = Error, ≥1 company = OK
- If adapter drift found during validation, fix selectors in this phase (the goal says "drifting selectors are caught" — fix, not just log)
- `validate-adapters.mjs --capture` saves fresh HTML to `tests/fixtures/adapters/` after a successful live run

### Error Reason Standardization
- Canonical reason codes: `selector_miss`, `timeout`, `robots_block`, `network_error` — standardized in `scrapers/health.mjs`
- ScraperHealthPanel: surface `reason` as visible text in Error rows (currently tooltip-only via HealthStatusDot) — minor enhancement
- Reason-code mapping lives in `scrapers/health.mjs` — single source where health is written and enriched

### Fixture Scope & Baseline
- All 10 firms get fixture HTML files (captured via `--capture` run)
- Fixture tests verify structure only: `name` is non-empty string and array is non-empty — not brittle count matching
- `npm test` stays fully offline (fixture-only); live validation is `validate-adapters.mjs`

### Claude's Discretion
- Exact fixture HTML file naming (e.g., `a16z.html` vs `a16z-portfolio.html`)
- Whether `validate-adapters.mjs` outputs results to stdout only or also writes a summary JSON
- Specific Playwright `page.setContent()` vs `page.route()` approach for fixture injection (whichever is cleaner per adapter)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scrapers/adapters/{a16z,accel,benchmark,coatue,founders-fund,general-catalyst,index-ventures,khosla,lightspeed,sequoia}.mjs` — 10 adapters, each exports `async function scrape(context, {log, firm})`
- `scrapers/adapters/index.mjs` — adapter registry
- `scrapers/health.mjs` — `writeHealth()` writes `data/vc-health.json`
- `tests/scan.test.mjs` — model for test structure: Node `test()` + `assert`, fixtures from `tests/fixtures/`
- `ScraperHealthPanel.tsx` — already renders OK/Stale/Error with `HealthStatusDot` (reason as tooltip)
- `HealthStatusDot.tsx` — status dot component; reason currently shown as tooltip

### Established Patterns
- Test files: `tests/*.test.mjs`, Node built-in `node:test` + `node:assert/strict`
- Fixtures: `tests/fixtures/{category}/` subdirectories
- Health writing: `scrapers/health.mjs` `writeHealth()` called from `scrape-vcs.mjs`
- CLI flags on scripts: `--dry-run`, `--firm` patterns already established in `scrape-vcs.mjs`

### Integration Points
- `tests/adapters.test.mjs` → picked up by `npm test` automatically
- `validate-adapters.mjs` → new standalone script, add to `package.json` scripts as `"validate:adapters"`
- `scrapers/health.mjs` → add reason-code normalization here
- `ScraperHealthPanel.tsx` → minor text surfacing for Error reason

</code_context>

<specifics>
## Specific Ideas

- `validate-adapters.mjs --capture` flag saves fresh HTML fixtures to `tests/fixtures/adapters/` for later regression use
- `validate-adapters.mjs` with no flag runs live scrape across all 10 firms, prints per-firm OK/Error with company count and reason
- Fixture test for broken selector: use a stripped/mutated version of the HTML fixture (all company cards removed) to verify adapter returns empty array and test catches it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
