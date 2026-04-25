---
phase: 04-vc-adapter-validation
plan: 02
subsystem: scraping
tags: [vc-scraper, adapters, playwright, fixtures, live-validation, selector-drift, alpine-js, webflow, react]

# Dependency graph
requires:
  - phase: 04-vc-adapter-validation
    provides: normalizeReason() classifier from Plan 01 (scrapers/health.mjs)
  - phase: 03-vc-portfolio-discovery
    provides: 10 VC adapters in scrapers/adapters/, adapter registry, config/vc-firms.yml
provides:
  - validate-adapters.mjs — live-validation CLI (npm run validate:adapters)
  - 4 repaired VC adapters (a16z, Accel, Founders Fund, General Catalyst) — real-site selectors current as of 2026-04-24
  - 10 fixture HTML files under tests/fixtures/adapters/ (9 live-captured, 1 stub) — baseline for Plan 03 regression harness
  - ADPT-01 satisfied — every enabled VC firm returns ≥1 company record against its live portfolio page
affects:
  - 04-03 (fixture regression harness — consumes tests/fixtures/adapters/*.html)
  - future adapter maintenance (validate:adapters is the drift detector)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-firm Playwright BrowserContext in validate-adapters.mjs (Research pitfall 2) — one adapter cannot pollute the next"
    - "Hardcoded FIXTURE_FILENAMES map — resolves Index → index-ventures.html collision at source rather than through adapter-registry-key normalization"
    - "Capture path uses waitUntil: 'domcontentloaded' + 5s settle — robust to long-poll beacons that prevent networkidle from ever firing"

key-files:
  created:
    - validate-adapters.mjs
    - tests/fixtures/adapters/a16z.html
    - tests/fixtures/adapters/sequoia.html
    - tests/fixtures/adapters/accel.html
    - tests/fixtures/adapters/general-catalyst.html
    - tests/fixtures/adapters/coatue.html
    - tests/fixtures/adapters/founders-fund.html
    - tests/fixtures/adapters/khosla.html
    - tests/fixtures/adapters/index-ventures.html
    - tests/fixtures/adapters/lightspeed.html
    - tests/fixtures/adapters/benchmark.html
  modified:
    - package.json
    - scrapers/adapters/a16z.mjs
    - scrapers/adapters/accel.mjs
    - scrapers/adapters/founders-fund.mjs
    - scrapers/adapters/general-catalyst.mjs

key-decisions:
  - "General Catalyst was a timeout bug, not selector drift — networkidle never fires because of a long-poll beacon; switching to domcontentloaded + 2.5s settle was the whole fix (no selector change). Kept count at 3 real drifts, within plan budget."
  - "a16z migrated to Alpine.js (wr25Portfolio component) — cards hydrate client-side; added button.group/card as primary selector and read name from aria-label, kept old selectors as fallbacks"
  - "Accel moved to Webflow — added .company-card_component and h3[accel-content='company-name']/h3.sr-only selectors; name is present but visually hidden (screen-reader only)"
  - "Founders Fund uses React-rendered .portfolio-tile cards with an invisible full-card overlay anchor — extract name from h2.tile-heading and href from the overlay anchor separately"
  - "validate-adapters.mjs --capture path originally hardcoded 'networkidle' which broke General Catalyst capture even after the adapter itself was fixed; mirrored the adapter's domcontentloaded+settle pattern as Rule 1 bug fix"

patterns-established:
  - "OR-chain selector preservation — when fixing drift, add the new selector as the first option in the chain and keep the old ones as fallbacks (future-proofs the adapter across incremental theme changes)"
  - "Alpine/React/Webflow-rendered pages need domcontentloaded + fixed settle, not networkidle — long-poll analytics/tracking beacons keep the network busy indefinitely"
  - "Adapter contract preservation during drift repair — function signature (context, { log, firm }), page.goto() URL, and { name, website, careers_url } return shape are invariant; only selector strings and navigation options change"

requirements-completed: [ADPT-01]

# Metrics
duration: ~30min
completed: 2026-04-24
---

# Phase 4 Plan 2: Live VC Adapter Validation Summary

**validate-adapters.mjs ships as a live-validation CLI; 4 of 9 adapters (a16z / Accel / Founders Fund / General Catalyst) were repaired against real portfolio pages; all 9 enabled firms now return ≥1 company and 10 fixture HTML files are on disk — ADPT-01 satisfied.**

## Checkpoint State

This plan is at **checkpoint:human-verify** (Task 2, Step E). Everything is committed; awaiting user approval to proceed to Plan 03.

**Final live validation run:**
```
OK:    9
Error: 0
```

Per-firm results:

| Firm             | Status | Companies | Fixture                         | Fixture Bytes |
| ---------------- | ------ | --------- | ------------------------------- | ------------- |
| a16z             | OK     | 833       | a16z.html                       | 6,192,186     |
| Sequoia          | OK     | 21        | sequoia.html                    | 170,218       |
| Accel            | OK     | 100       | accel.html                      | 609,579       |
| General Catalyst | OK     | 63        | general-catalyst.html           | 241,764       |
| Coatue           | OK     | 5         | coatue.html                     | 159,117       |
| Founders Fund    | OK     | 62        | founders-fund.html              | 545,392       |
| Khosla           | OK     | 130       | khosla.html                     | 234,501       |
| Index            | OK     | 377       | index-ventures.html (NOT index) | 239,265       |
| Lightspeed       | OK     | 653       | lightspeed.html                 | 646,458       |
| Benchmark        | skip   | —         | benchmark.html (stub)           | 355           |

**Verification command for user to re-run after merge:**
```
node validate-adapters.mjs
```
Expected output: 9 OK lines, `OK: 9` / `Error: 0`, exit 0.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-24 (approx)
- **Completed:** 2026-04-24
- **Tasks:** 2 completed (Task 1 direct; Task 2 checkpoint:human-verify reached, awaiting approval)
- **Files created:** 11 (1 script + 10 fixtures)
- **Files modified:** 5 (package.json + 4 adapter fixes)
- **Commits:** 3

## Accomplishments

- **validate-adapters.mjs shipped** — imports `normalizeReason` from Plan 01, reads `config/vc-firms.yml`, runs each adapter in its own BrowserContext, prints `[{firm}] OK (N companies)` or `[{firm}] Error: {reason} — {message}`. Registered as `npm run validate:adapters`. Supports `--firm <substring>` and `--capture`.
- **4 drifted adapters repaired** — after the first validation revealed 4 errors, each was diagnosed against its live DOM:
  - **a16z**: migrated to Alpine.js (wr25Portfolio). Cards are `<button class="group/card" aria-label="{name}">`. Switched to `domcontentloaded` + 5s hydration wait, added `button.group/card` selector, read name from `aria-label` with fallback to heading. 833 companies.
  - **Accel**: moved to Webflow. Cards are `.company-card_component` with name in `<h3 accel-content="company-name" class="sr-only">`. Added these selectors to the head of the OR-chain. 100 companies.
  - **Founders Fund**: React-rendered `.portfolio-tile` cards with `h2.tile-heading > span` for name and an invisible full-card `<a href="/company/{slug}/">` overlay. Now extracts name from the heading and href from the overlay anchor. 62 companies.
  - **General Catalyst**: not actually a selector issue — `networkidle` never fired because the page keeps a long-poll beacon open. Switched to `domcontentloaded` + 2.5s settle, bumped timeout to 60s. 63 companies.
- **10 fixture HTML files captured** — 9 live-captured via `node validate-adapters.mjs --capture` (150 KB – 6.2 MB each), 1 minimal stub for Benchmark. Index Ventures correctly named `index-ventures.html` (not `index.html`). All stored under `tests/fixtures/adapters/`.
- **Adapter contract preserved across all 4 fixes** — no changes to function signature, `page.goto()` URL, or `{name, website, careers_url}[]` return shape. Selector OR-chains kept old selectors as fallbacks.

## Task Commits

Each task committed atomically with --no-verify (parallel-executor worktree):

1. **Task 1: Add validate-adapters.mjs** — `109b529` (feat) — new script + `npm run validate:adapters` registration.
2. **Task 2 / Fix: Repair 4 drifted adapters** — `7349281` (fix) — a16z, Accel, Founders Fund, General Catalyst selector/navigation updates.
3. **Task 2 / Capture: 10 fixtures + capture path networkidle bug** — `ca388f0` (feat) — fixture capture and validate-adapters.mjs capture-path fix.

_Note: No separate "metadata" commit per parallel-executor rules — SUMMARY.md will be committed with this file write._

## Files Created/Modified

### Created
- `validate-adapters.mjs` (root) — Live adapter validator, 125 lines. Shebang + JSDoc + `normalizeReason` import + FIXTURE_FILENAMES map (collision-resolved) + main() with `--firm`/`--capture` handling.
- `tests/fixtures/adapters/a16z.html` — 6.19 MB, 833 Alpine-hydrated card buttons.
- `tests/fixtures/adapters/sequoia.html` — 170 KB.
- `tests/fixtures/adapters/accel.html` — 610 KB, Webflow company-card_component tiles.
- `tests/fixtures/adapters/general-catalyst.html` — 242 KB.
- `tests/fixtures/adapters/coatue.html` — 159 KB.
- `tests/fixtures/adapters/founders-fund.html` — 545 KB, React-rendered portfolio-tile grid.
- `tests/fixtures/adapters/khosla.html` — 234 KB.
- `tests/fixtures/adapters/index-ventures.html` — 239 KB (collision-resolved filename per CONTEXT.md).
- `tests/fixtures/adapters/lightspeed.html` — 646 KB.
- `tests/fixtures/adapters/benchmark.html` — 355 bytes, explanatory stub (Benchmark has no public portfolio).

### Modified
- `package.json` — added `"validate:adapters": "node validate-adapters.mjs"` between `scan` and `gemini:eval`.
- `scrapers/adapters/a16z.mjs` — **before:** `waitUntil: 'networkidle'`, selectors `article[data-portfolio-company], .portfolio-company, .company-card, li.portfolio__item`; **after:** `waitUntil: 'domcontentloaded'` + 5s wait, first selector `button.group\\/card`, name extracted from `aria-label` (with heading fallback), old selectors kept as OR-chain fallbacks.
- `scrapers/adapters/accel.mjs` — **before:** `a[href*="/companies/"], article.company, .company-tile` with name from `h3, h2, .name`; **after:** first selector `.company-card_component`, name from `[accel-content="company-name"], h3.sr-only`, old selectors kept as fallbacks.
- `scrapers/adapters/founders-fund.mjs` — **before:** extracted name from anchor text of `a[href*="/company/"]` (empty — anchor is invisible overlay); **after:** first selector `.portfolio-tile`, name from `h2.tile-heading > span`, href from the overlay anchor inside the tile; old anchor selectors kept as fallbacks.
- `scrapers/adapters/general-catalyst.mjs` — **before:** `waitUntil: 'networkidle', timeout: 30000`; **after:** `waitUntil: 'domcontentloaded', timeout: 60000` + 2.5s settle. Selectors unchanged.

## Decisions Made

- **GC reclassified as timeout, not drift.** Initial run showed 4 errors but inspecting GC's stack revealed `page.goto: Timeout ... networkidle`. The actual DOM contained 63 companies once allowed to render with `domcontentloaded + settle`. This kept drift count at 3 (within the "more than 3 → escape hatch" threshold per the plan).
- **Selector chains preserved, not replaced.** Every adapter fix added the new selector at the **head** of the OR-chain and kept the old selectors as fallbacks. This makes the adapters robust to incremental theme changes and allows A/B theme rollouts on the target site not to break scraping instantly.
- **a16z name source is aria-label, not heading.** The WR25 cards have no server-rendered heading text; the name lives in `button[aria-label="{name}"]`. Chose this over scraping the Alpine template source because aria-labels are the stable accessibility contract.
- **Accel name from sr-only h3.** The visible name on an Accel card is an SVG logo; the plain-text name is in a screen-reader-only `<h3 class="sr-only">`. This is a stable semantic element Webflow is unlikely to drop.
- **Founders Fund: separate heading extraction from href extraction.** The full-card overlay `<a>` has empty textContent, so relying on `anchor.textContent` (as the old adapter did) always returns 0 names. Split into `querySelector('h2.tile-heading')` for name and `querySelector('a[href^="/company/"]')` for href.
- **Capture path fix mirrored the adapter fix.** validate-adapters.mjs's `--capture` path had its own hardcoded `networkidle` that would retime-out even when the adapter itself worked. Changed to the same `domcontentloaded + 5s settle` pattern (Rule 1 — bug in the tool the plan created).
- **Used Write tool for benchmark.html**, not heredoc — per execute-plan.md guidance ("never use heredoc for file creation").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 drifted adapter selectors / navigation options**
- **Found during:** Task 2, Step A (first `node validate-adapters.mjs` run)
- **Issue:** 4 of 9 enabled firms returned 0 companies or timed out — real-site DOM had evolved (a16z Alpine redesign, Accel Webflow move, Founders Fund overlay-anchor markup; General Catalyst long-poll beacon breaks networkidle).
- **Fix:** Repaired each adapter — see "Files Modified" above for before→after per adapter. All 4 changes preserve the adapter contract (signature, URL, return shape).
- **Files modified:** `scrapers/adapters/a16z.mjs`, `scrapers/adapters/accel.mjs`, `scrapers/adapters/founders-fund.mjs`, `scrapers/adapters/general-catalyst.mjs`.
- **Verification:** `node validate-adapters.mjs --firm <each>` returned OK (833, 100, 62, 63 companies respectively); full run returns 9 OK / 0 Error.
- **Committed in:** `7349281`.

**2. [Rule 1 - Bug] Fixed validate-adapters.mjs capture path networkidle timeout**
- **Found during:** Task 2, Step C (first `--capture` run after adapters were fixed)
- **Issue:** Even after `scrapers/adapters/general-catalyst.mjs` was fixed, the `--capture` path in validate-adapters.mjs hardcoded its own `page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })` and timed out on GC capture. The capture-path gotos were duplicating the navigation the adapter had already handled, but with obsolete wait semantics.
- **Fix:** Changed validate-adapters.mjs capture-path `page.goto()` to `waitUntil: 'domcontentloaded'` + 5s settle, timeout 60s — mirroring the adapter-level fix.
- **Files modified:** `validate-adapters.mjs`.
- **Verification:** Re-ran `--capture` on GC alone — fixture captured successfully (242 KB); full `--capture` run then produced 9 fixtures on disk with zero errors.
- **Committed in:** `ca388f0`.

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in code under this plan's scope).
**Impact on plan:** Both auto-fixes were required to satisfy ADPT-01. Drift discovery was the whole point of this plan per CONTEXT.md ("fix, not just log") — classifying it as "deviation" is just bookkeeping. The validate-adapters.mjs capture-path fix was true collateral damage (bug in a tool this plan created, discovered mid-execution).

## Issues Encountered

- **`git clean` not used** — Per `<destructive_git_prohibition>`, avoided any blanket reset/clean in this worktree. Removed per-probe files (`.a16z-probe.mjs`, `.dom-capture-tmp.mjs`) individually with targeted `rm`.
- **One fixture (a16z.html) is 6.2 MB.** This is the actual page content (1,668 card buttons with verbose Tailwind classes each, plus Alpine templates). Under the plan's 5 KB lower bound but well above; no upper bound specified. Acceptable for fixture use. May be worth minifying or slicing in Plan 03 if the regression harness becomes slow.
- **Electron package.json shows pre-existing M in `git status`** — not touched by this plan, left alone per scope-boundary rule.

## User Setup Required

None — no external service configuration required. Plan 01's normalizeReason() was already shipped.

## Next Phase Readiness

**Ready for Plan 03 (fixture regression harness).** All 10 fixtures exist on disk with correct filenames; Index Ventures collision is resolved. Fixture files range from 355 bytes (benchmark stub) to 6.2 MB (a16z) — the regression harness should load them via `page.setContent()` as CONTEXT.md decides.

**No blockers.** All plan-level verification gates pass:
- `ls tests/fixtures/adapters/*.html | wc -l` → 10
- `find tests/fixtures/adapters -name '*.html' ! -name 'benchmark.html' -size -5k` → empty
- `test -f tests/fixtures/adapters/index-ventures.html` → yes
- `test -f tests/fixtures/adapters/index.html` → no (no collision)
- `grep -cE "\"validate:adapters\"" package.json` → 1
- All adapter fixes preserve `export default async function scrape(context, { log, firm })`

## Self-Check

- File `validate-adapters.mjs` exists, shebang present, imports normalizeReason from scrapers/health.mjs, has `'Index': 'index-ventures.html'` mapping, handles `--capture` and `--firm` flags, uses per-firm `browser.newContext()`.
- `node --check validate-adapters.mjs` → exit 0.
- `package.json` scripts has `"validate:adapters": "node validate-adapters.mjs"`.
- 4 adapter files modified, all preserve signature/URL/return shape.
- 10 HTML files on disk under `tests/fixtures/adapters/`; 9 live-captured, 1 stub.
- Commits `109b529` (Task 1), `7349281` (adapter fixes), `ca388f0` (fixtures + capture fix) all present in `git log` on the worktree branch.

**Self-Check: PASSED**

---
*Phase: 04-vc-adapter-validation*
*Plan: 02 (Wave 2)*
*Checkpoint state: human-verify — awaiting user approval to proceed to Plan 03*
*Completed: 2026-04-24*
