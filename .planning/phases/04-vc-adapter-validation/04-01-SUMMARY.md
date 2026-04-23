---
phase: 04-vc-adapter-validation
plan: 01
subsystem: scraping
tags: [vc-scraper, error-classification, health, electron, react, node-test]

# Dependency graph
requires:
  - phase: 03-vc-portfolio-discovery
    provides: scrape-vcs.mjs, scrapers/health.mjs, ScraperHealthPanel.tsx, HealthStatusDot.tsx, VcFirmHealth type
provides:
  - normalizeReason() classifier in scrapers/health.mjs (canonical reason codes)
  - Canonical reason codes in data/vc-health.json (selector_miss | timeout | robots_block | network_error)
  - BC-1 — empty adapter result is now Error/selector_miss (was OK/count:0)
  - BC-2 — thrown errors normalized (no raw err.message in vc-health.json)
  - BC-3 — robots disallow emits canonical 'robots_block' (was 'robots.txt disallow')
  - Inline reason text in ScraperHealthPanel Error rows
affects:
  - 04-02 (live adapter validation / validate-adapters.mjs — consumes normalizeReason)
  - 04-03 (fixture regression harness — tests adapter outputs)
  - future Electron panels reading VcFirmHealth.reason

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure classifier at the write site — normalize raw error/condition into a small enum BEFORE it is persisted or surfaced to UI"
    - "UI reason surfaced inline with subtext tokens (text-ctp-subtext text-label) + em-dash separator, guarded by status+reason predicate"
    - "node:test RED/GREEN/REFACTOR TDD cycle on a pure function with six explicit behavior bullets"

key-files:
  created:
    - tests/health.test.mjs
  modified:
    - scrapers/health.mjs
    - scrape-vcs.mjs
    - electron/src/renderer/components/ScraperHealthPanel.tsx

key-decisions:
  - "robots.txt callsite hardcodes 'robots_block' rather than calling normalizeReason() — it is a boolean condition from checkAllowed(), not a thrown error"
  - "Kept console.error(err.message) in the catch branch for ops visibility; only the persisted vc-health.json gets the canonical code"
  - "Used UI-SPEC section 2 tokens (text-ctp-subtext text-label) rather than the ctp-red example in PATTERNS.md — UI-SPEC is the authoritative design contract"
  - "normalizeReason() treats both null and undefined as 'adapter returned 0 companies' — single selector_miss branch for 'no error thrown, yet something is wrong'"

patterns-established:
  - "normalize-at-write pattern — errors classified by a pure function at the same module that persists health state, so downstream consumers (UI, tests, validate-adapters.mjs) see only canonical codes"
  - "Inline-subtext reason rendering — visible explanation next to status, not in a tooltip; preserves table layout"

requirements-completed: [ADPT-02]

# Metrics
duration: ~2min
completed: 2026-04-23
---

# Phase 4 Plan 1: Canonical Scraper Reason Codes Summary

**normalizeReason() classifier standardizes VC scraper error reporting into four canonical codes (selector_miss, timeout, robots_block, network_error) and surfaces them inline in the Electron health panel, satisfying ADPT-02.**

## Performance

- **Duration:** ~2 min (4 commits)
- **Started:** 2026-04-23T23:48:54Z
- **Completed:** 2026-04-23T23:50:30Z
- **Tasks:** 3 completed (Task 1 via TDD RED+GREEN, Tasks 2 & 3 direct)
- **Files modified:** 3 (plus 1 new test file)

## Accomplishments

- **Canonical reason codes shipped.** `normalizeReason()` is a pure export from `scrapers/health.mjs` that maps thrown errors and the 0-companies condition into one of four codes. Unit-covered by 6 tests in `tests/health.test.mjs` — all pass.
- **All three scrape-vcs callsites standardized.** Robots disallow, empty adapter result, and thrown exceptions now all write canonical codes to `data/vc-health.json` — no raw `err.message` or custom strings reach the UI.
- **BC-1 semantic change landed.** An adapter returning 0 companies is now surfaced as `Error/selector_miss` in the health panel — previously this was silently reported as `OK/count:0`.
- **Inline reason visible in the UI.** ScraperHealthPanel Error rows now render `● Error — selector_miss` instead of requiring users to hover for a tooltip. OK and Stale rows unchanged.

## Task Commits

Each task was committed atomically (--no-verify in worktree):

1. **Task 1 (TDD RED): Add failing tests for normalizeReason()** — `a7da5aa` (test)
2. **Task 1 (TDD GREEN): Implement normalizeReason() classifier** — `3aba618` (feat)
3. **Task 2: Wire normalizeReason() into scrape-vcs.mjs (3 callsites, BC-1/BC-2/BC-3)** — `182b371` (feat)
4. **Task 3: Render reason text inline in ScraperHealthPanel Error rows** — `af9499d` (feat)

_Task 1 was executed as a TDD cycle per `tdd="true"` — RED commit (failing test) then GREEN commit (implementation). No REFACTOR pass was needed: the function is 8 lines of straight-line control flow with no duplication to extract._

## Files Created/Modified

- `tests/health.test.mjs` — **created**. 6 node:test assertions covering null/undefined, /timeout/i message, TimeoutError name, /robots/i, generic fallback.
- `scrapers/health.mjs` — **modified**. Added `normalizeReason()` as a new named export before `readHealth()`. No new imports; no changes to `readHealth()` or `writeHealth()`.
- `scrape-vcs.mjs` — **modified**. Four edits: (A) import rewrite to pull in `normalizeReason`, (B) robots callsite now hardcodes `'robots_block'`, (C) 0-companies branch now emits `Error/selector_miss` (BC-1), (D) thrown-error branch now uses `normalizeReason(err)` (BC-2). `console.error(err.message)` kept as-is for ops logs.
- `electron/src/renderer/components/ScraperHealthPanel.tsx` — **modified**. Added conditional `<span>` after the status span: `{f.status === 'Error' && f.reason && (<span className="text-ctp-subtext text-label" data-testid="health-reason-text">— {f.reason}</span>)}`. HealthStatusDot untouched.

## Decisions Made

- **Robots callsite bypasses `normalizeReason()`.** The robots.txt path is a boolean condition from `checkAllowed()`, not a thrown error — hardcoding `'robots_block'` is cleaner than fabricating a fake Error just to classify it. Documented in PATTERNS.md and confirmed during Task 2.
- **UI tokens follow UI-SPEC, not early PATTERNS.md draft.** PATTERNS.md suggested `text-ctp-red ml-1 text-label`. UI-SPEC section 2 specifies `text-ctp-subtext text-label` with an em-dash separator. The plan explicitly called out UI-SPEC as the source of truth; used the subtext tokens.
- **`data-testid="health-reason-text"` added.** Not in the plan's acceptance grep but explicitly required by the plan action text ("so downstream tests / manual verification can target the element") — followed plan language.
- **`console.error(err.message)` preserved.** Plan explicitly said "the `console.error(...)` line just above Edit D stays as-is" — raw message still appears in stdout for operator debugging; only the persisted JSON gets the canonical code.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Chained grep acceptance script halts on grep -c 0.** Task 2's combined verification chain exited early because `grep -c` with zero matches returns exit 1 (which is the desired answer for "old string removed"). Re-ran each criterion as an independent statement with `|| true` to get a full readout. Not a plan issue — purely an execution scripting nuance. No bug introduced.

## Next Phase Readiness

- **Ready for 04-02 (live adapter validation).** `validate-adapters.mjs` can import `normalizeReason` from `scrapers/health.mjs` unchanged.
- **Ready for 04-03 (fixture regression harness).** Fixture-based tests don't depend on this plan's changes, but any UI-level assertions can target `data-testid="health-reason-text"`.
- **Downstream heads-up on BC-1.** The first scrape run after this merges may surface more Error rows than before (any firm that was silently returning 0 companies on a maintenance page will now flip to `selector_miss`). This is intentional per CONTEXT.md and is the only reason ADPT-02 is meaningful.
- **No blockers.** All verification gates pass: `npm test` → 15/15 green, `node --check scrape-vcs.mjs` → parse OK, `cd electron && npx tsc --noEmit` → exit 0.

## Self-Check: PASSED

- File `tests/health.test.mjs` exists.
- File `scrapers/health.mjs` modified (normalizeReason export present at line 10).
- File `scrape-vcs.mjs` modified (normalizeReason imported; three callsites updated).
- File `electron/src/renderer/components/ScraperHealthPanel.tsx` modified (inline reason span present).
- Commits `a7da5aa`, `3aba618`, `182b371`, `af9499d` all present in `git log` on the worktree branch.

---
*Phase: 04-vc-adapter-validation*
*Completed: 2026-04-23*
