---
phase: 04-vc-adapter-validation
plan: 04
subsystem: testing
tags: [vc-scraper, adapters, playwright, fixtures, alpine-js, regression-harness, node-test]

# Dependency graph
requires:
  - phase: 04-vc-adapter-validation
    provides: FIXTURE_DEFECT_SKIP skip mechanism from Plan 03; defective a16z.html from Plan 02
provides:
  - validate-adapters.mjs — a16z-aware capture path that bakes resolved Alpine aria-label attributes before page.content()
  - tests/fixtures/adapters/a16z.html — re-captured with 878 static aria-label attributes, 0 Alpine :aria-label directives
  - tests/adapters.test.mjs — FIXTURE_DEFECT_SKIP removed; a16z positive test now active and passing
  - ADPT-03 fully satisfied: all 9 enabled adapters have active positive regression gates
affects:
  - npm test — 34/34 passing, 0 skips (was 33/1 skip)
  - Future a16z selector drift is now caught by npm test after --capture re-run
  - Future runs of `node validate-adapters.mjs --capture --firm a16z` produce replay-safe fixtures idempotently

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM bake + HTML post-process: use page.evaluate() to set static aria-label from resolved IDL, then regex-strip :aria-label directives from the serialized HTML string"
    - "page.content() called AFTER DOM bake (second call) to capture updated static attributes"
    - "Alpine x-for template innerHTML cannot be modified via DOM APIs without destroying rendered clones — post-process regex on the HTML string is the correct approach"
    - "Firm-specific capture branches gated by firm.name === 'a16z' — other firms' capture paths unchanged"

key-files:
  created: []
  modified:
    - validate-adapters.mjs — added a16z-specific capture branch (DOM bake + HTML post-process); 172 lines
    - tests/fixtures/adapters/a16z.html — re-captured; 878 static aria-label attributes, 0 Alpine directives; 6,093,050 bytes
    - tests/adapters.test.mjs — removed FIXTURE_DEFECT_SKIP const and skip option; 95 lines (down 12 from 107)

key-decisions:
  - "Post-process HTML string rather than remove Alpine template elements: removing template[x-for] elements destroys their Alpine-managed rendered clones (Alpine tracks rendered nodes via the template element reference); regex on the serialized HTML is the correct bypass"
  - "Two-stage bake: (1) DOM bake resolves aria-label IDL on live card buttons and removes :aria-label directive attributes; (2) re-fetch page.content() after bake so static values are in serialized HTML; (3) regex-strip any remaining :aria-label=\"...\" occurrences from template innerHTML in the HTML string"
  - "Capture is idempotent by construction: re-running --capture --firm a16z against the live page produces a fixture with identical grep profile (878 resolved, 0 directives) without any hand-edits"

requirements-completed: [ADPT-03]

# Metrics
duration: ~75min (includes debugging Alpine x-for template structure)
completed: 2026-04-24
---

# Phase 4 Plan 4: a16z Fixture Alpine Bake — Gap Closure Summary

**a16z Alpine aria-label fixture defect closed: DOM bake + HTML post-process regex in the --capture path produces a replay-safe fixture; npm test now runs 34/34 with 0 skips and the a16z positive regression gate is fully active.**

## Performance

- **Duration:** ~75 min (including Alpine template structure debugging)
- **Started:** 2026-04-24T02:30:00Z (approx)
- **Completed:** 2026-04-24T04:00:00Z (approx)
- **Tasks:** 1 (single `type="auto"` task with 3 atomic sub-steps)
- **Files created:** 0
- **Files modified:** 3 (validate-adapters.mjs, tests/fixtures/adapters/a16z.html, tests/adapters.test.mjs)
- **Commits:** 3 task commits + 1 SUMMARY commit

## What Was Baked Into the Capture Path

### Selectors used

The bake targets `button.group\/card` — Alpine's hydrated portfolio card buttons. These are the only elements carrying `:aria-label="item.company.name || item.company.post_title"` as live DOM attributes (833 elements on the live page). A secondary selector `[x-on\:click*="triggerModal"]` covers the same set (both selectors match identical 833 elements).

### Attribute-neutralization scope

The bake is a16z-only, gated by `if (firm.name === 'a16z')`. It does not touch any other firm's capture path.

**DOM bake (inside page.evaluate()):**
1. For each matching card button, read the resolved `ariaLabel` IDL property (which reflects Alpine's evaluated value from the hydrated live DOM).
2. Write it back as a static `setAttribute('aria-label', resolved)` attribute.
3. Remove the Alpine directive attributes (`removeAttribute(':aria-label')`, `removeAttribute('x-bind:aria-label')`) from each live element.

**HTML post-process (after page.content()):**
Alpine's `x-for` template elements are included in `page.content()` serialization. Each template's `innerHTML` contains the raw `:aria-label="item.company.name"` directive source. These `innerHTML` contents cannot be removed via DOM APIs without destroying the rendered clones (Alpine tracks rendered nodes via the `<template>` node reference — removing the template element removes all 833 rendered card divs with it).

Solution: regex-replace `\s*:aria-label="[^"]*"` on the serialized HTML string after the DOM bake. This strips the directive from both live element serializations and from template innerHTML in one pass.

### Why the fix is a16z-only

No other adapter's portfolio page uses Alpine.js `x-for` with `:aria-label` bindings. The other 8 firms' adapters read company names from heading text, data attributes, or inline text content — all of which survive `page.content()` unchanged. The `if (firm.name === 'a16z')` gate ensures zero behavioral change for other firms.

## Fixture Delta

| Metric | Before (Plan 02 capture) | After (Plan 04 capture) |
|--------|--------------------------|-------------------------|
| File size | 6,190,000 bytes (approx) | 6,093,050 bytes |
| `grep -cE 'aria-label="[A-Za-z][^"]*"'` | ~7 (UI controls only) | 878 |
| `grep -c ':aria-label='` | 836 | 0 |
| `grep -c 'item.company'` | 12,686+ | ~12,686 (x-on:click attrs remain; not read by adapter) |
| Companies on live capture | 833 | 833 |
| aria-labels baked | n/a | 833 |
| directives stripped | n/a | 836 (833 live elements + 3 from non-card contexts) |

Note: `item.company` still appears in `x-on:click="triggerModal(item.company)"` attributes on the rendered card buttons and in the outer x-for template's innerHTML. This does NOT affect the adapter — `scrapers/adapters/a16z.mjs` only reads `getAttribute('aria-label')`, ignoring x-on:click.

## Test Delta

| Metric | Before (Plan 03) | After (Plan 04) |
|--------|-----------------|-----------------|
| npm test total | 34 | 34 |
| pass | 33 | 34 |
| skip | 1 | 0 |
| fail | 0 | 0 |
| a16z positive test | SKIP (FIXTURE_DEFECT_SKIP) | ok 1 — passes |
| a16z negative test | ok 2 (active) | ok 2 (still active) |
| Adapter tests total | 19 (18 active + 1 skip) | 19 (19 active + 0 skip) |
| `grep -c 'FIXTURE_DEFECT_SKIP' tests/adapters.test.mjs` | 2 | 0 |
| `grep -c 'skip:' tests/adapters.test.mjs` | 1 | 0 |

## ADPT-03 Status Flip

ADPT-03 ("A regression test fixture captures expected output per adapter so future DOM changes are caught before runtime") was **PARTIAL** in 04-VERIFICATION.md: 8/9 positive fixture tests active; a16z positive was skipped.

After this plan: **VERIFIED**.
- All 9 enabled adapters now have one active positive regression test asserting `companies.length > 0` with non-empty `name`.
- All 9 enabled adapters have one active negative test asserting `companies === []` on empty HTML.
- Truth row #3 in 04-VERIFICATION.md should move from PARTIAL to VERIFIED. The re-verification is the orchestrator's job.

## Idempotence Note

Re-running `node validate-adapters.mjs --capture --firm a16z` a second time (verified during plan execution) produced a fixture with identical grep profile:
- 878 static `aria-label="[A-Za-z]..."` attributes
- 0 `:aria-label=` directives
- File size: 6,093,050 bytes

The capture path does not require hand-editing and will re-produce a replay-safe fixture on every future run, provided a16z.com still serves Alpine-hydrated card buttons after a 5-second wait.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Alpine x-for template removal destroyed rendered card clones**

- **Found during:** Step B first attempt — fixture had only 49 resolved aria-labels instead of 800+
- **Issue:** Initial implementation removed `template[x-for]` elements containing `:aria-label` in their innerHTML. Alpine tracks its `x-for`-rendered clones via the `<template>` node reference; removing the template element cascaded to removing all 833 rendered card button wrappers from the DOM. The fixture captured only the SSR-rendered header/nav with ~49 static aria-labels.
- **Root cause (deeper):** `page.content()` returns `document.documentElement.outerHTML` which includes each `<template>` element's `innerHTML` as a literal string. These template innerHTML strings cannot be edited via DOM attribute manipulation without destroying the live rendered nodes linked to them.
- **Fix:** Replaced DOM template removal with a post-process regex (`html.replace(/\s*:aria-label="[^"]*"/g, '')`) applied to the serialized HTML string after `page.content()`. Also re-fetches `page.content()` after the DOM bake (instead of before) so the baked static attributes appear in the serialized output.
- **Files modified:** validate-adapters.mjs
- **Committed in:** `3b18593` (amended from first attempt)

**2. [Rule 1 - Bug] Alpine runtime scripts could not be stripped by src*="alpine" selector**

- **Found during:** Step B debugging — Alpine was bundled in `vite-core.js` and `script.manual.js`, not a standalone `alpine.js` file. The original `script[src*="alpine"]` selector matched 0 scripts.
- **Fix:** Removed the Alpine script stripping entirely — it was not needed once the post-process regex approach correctly eliminated all `:aria-label` occurrences. The adapter test works offline without Alpine stripping because the adapter reads static `aria-label` attributes (now present from the bake) and does not depend on Alpine re-evaluating.
- **Files modified:** validate-adapters.mjs

### Scope Held

- No changes to `scrapers/adapters/a16z.mjs` (or any adapter): `git diff HEAD -- scrapers/adapters/ | wc -l` → 0
- No changes to any other fixture: `git diff HEAD -- tests/fixtures/adapters/ ':(exclude)tests/fixtures/adapters/a16z.html' | wc -l` → 0

## Task Commits

1. **Step A: bake logic in validate-adapters.mjs** — `3b18593` (fix)
2. **Step B: re-captured a16z fixture** — `0c4e323` (fixture)
3. **Step C: remove FIXTURE_DEFECT_SKIP** — `a3d21bc` (test)

## Known Stubs

None — the a16z positive test is fully wired: fixture → ctx.route() intercept → adapter $$eval → companies.length > 0 assertion.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

File checks:
- `validate-adapters.mjs` exists (172 lines) ✓
- `tests/fixtures/adapters/a16z.html` exists (6,093,050 bytes) ✓
- `tests/adapters.test.mjs` exists (95 lines) ✓

Acceptance criterion grep checks:
- `node --check validate-adapters.mjs` → exit 0 ✓
- `node --check tests/adapters.test.mjs` → exit 0 ✓
- `grep -c "if (firm.name === 'a16z')" validate-adapters.mjs` → 1 ✓
- `grep -c "setAttribute('aria-label'" validate-adapters.mjs` → 1 ✓
- `grep -c "removeAttribute(':aria-label')" validate-adapters.mjs` → 1 ✓
- `grep -cE 'aria-label="[A-Za-z][^"]*"' tests/fixtures/adapters/a16z.html` → 878 (≥ 50) ✓
- `grep -c ':aria-label=' tests/fixtures/adapters/a16z.html` → 0 ✓
- `grep -c 'FIXTURE_DEFECT_SKIP' tests/adapters.test.mjs` → 0 ✓
- `grep -c "skip:" tests/adapters.test.mjs` → 0 ✓
- `npm test` → exit 0, 34/34 pass, 0 skip ✓
- `npm test | grep -c "# SKIP"` → 0 ✓
- `npm test | grep -cE "^ok [0-9]+ - a16z adapter parses portfolio"` → 1 ✓
- `grep -c "a16z adapter returns empty array" tests/adapters.test.mjs` → 1 (negative test preserved) ✓
- `git diff HEAD -- scrapers/adapters/ | wc -l` → 0 (no adapter changes) ✓
- `git diff HEAD -- tests/fixtures/adapters/ ':(exclude)tests/fixtures/adapters/a16z.html' | wc -l` → 0 (no other fixtures changed) ✓
- Idempotence: second `--capture --firm a16z` run → 878 resolved, 0 directives, same file size ✓

Commit checks:
- `3b18593` (fix: validate-adapters.mjs bake logic) ✓
- `0c4e323` (fixture: re-captured a16z.html) ✓
- `a3d21bc` (test: remove FIXTURE_DEFECT_SKIP) ✓

---
*Phase: 04-vc-adapter-validation*
*Plan: 04 (Wave 4 — Gap Closure)*
*Completed: 2026-04-24*
