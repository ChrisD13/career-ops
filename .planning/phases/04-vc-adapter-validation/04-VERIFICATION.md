---
phase: 04-vc-adapter-validation
verified: 2026-04-23T00:00:00Z
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Every enabled adapter (9 firms) has one positive test asserting companies.length > 0 against its captured fixture"
    status: partial
    reason: "a16z positive test is skipped via node:test { skip } because the captured fixture has unresolved Alpine :aria-label bindings. The fixture was captured with page.content() before Alpine hydration baked resolved attribute values; on replay, Alpine errors 'item is not defined' and the adapter returns 0 companies. The negative test for a16z runs and passes (fixture independent), but the positive regression gate for a16z is absent — a16z selector drift will not be caught by npm test."
    artifacts:
      - path: "tests/adapters.test.mjs"
        issue: "FIXTURE_DEFECT_SKIP map causes a16z positive test to be skipped (TAP output: ok 1 ... # SKIP Plan 02 fixture-capture defect)"
      - path: "tests/fixtures/adapters/a16z.html"
        issue: "Contains raw Alpine :aria-label directive source (':aria-label=\"item.company.name\"') instead of resolved static aria-label attributes — captured before Alpine hydration resolved attribute bindings"
    missing:
      - "Re-capture a16z.html with resolved aria-label attributes (e.g. bake via page.evaluate() before page.content() in validate-adapters.mjs --capture path)"
      - "Remove FIXTURE_DEFECT_SKIP['a16z'] entry from tests/adapters.test.mjs once fixture is corrected"
      - "Verify a16z positive test passes against corrected fixture (expect companies.length > 0 with non-empty name fields)"
---

# Phase 4: VC Adapter Validation Verification Report

**Phase Goal:** All 10 VC firm scrapers are validated against live pages and drifting selectors are caught by a regression harness before they reach users
**Verified:** 2026-04-23
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run a full scrape and see at least one company record returned from each of the 10 VC firms | VERIFIED | Plan 02 live run: 9/9 enabled firms returned OK (9 OK / 0 Error); Benchmark disabled by config. validate-adapters.mjs exits non-zero on any Error. Four drifted adapters (a16z, Accel, Founders Fund, General Catalyst) were repaired; all verified live. |
| 2 | User can open the Discover panel health view and see per-firm status including any errors | VERIFIED | ScraperHealthPanel.tsx lines 61-65: `{f.status === 'Error' && f.reason && (<span ... data-testid="health-reason-text">— {f.reason}</span>)}`. All 3 callsites in scrape-vcs.mjs write canonical reason codes. |
| 3 | A test run against saved fixtures catches a deliberately broken selector and reports failure without hitting live pages | PARTIAL | 9 negative tests (including a16z) run offline and catch broken selectors. 8/9 positive tests run; a16z positive is skipped due to Alpine fixture defect. SC-3 is partially satisfied: the harness catches drift for 8 firms via positive tests and all 9 via negative tests, but a16z has no functioning positive regression gate. |
| 4 | normalizeReason() classifies thrown errors and null into one of four canonical codes | VERIFIED | scrapers/health.mjs lines 10-17: export confirmed. Live behavioral spot-check: null→selector_miss, TimeoutError→timeout, /timeout/i→timeout, /robots/i→robots_block, generic→network_error, undefined→selector_miss. |
| 5 | scrape-vcs.mjs treats adapter returning 0 companies as Error with reason selector_miss (BC-1) | VERIFIED | scrape-vcs.mjs line 115-117: `if (discovered.length === 0) { healthUpdates.push({ name: firm.name, status: 'Error', reason: normalizeReason(null), count: 0 }); }`. No raw err.message or robots.txt disallow strings in reason field. |
| 6 | User can run `node validate-adapters.mjs` and see per-firm OK/Error for all 9 enabled firms | VERIFIED | validate-adapters.mjs: 131 lines, shebang present, imports normalizeReason, reads config/vc-firms.yml, exits 1 if errCount>0. npm script "validate:adapters" confirmed in package.json line 20. |
| 7 | 10 fixture HTML files exist under tests/fixtures/adapters/ with correct names | VERIFIED | `ls tests/fixtures/adapters/*.html \| wc -l` → 10. All 9 live-captured fixtures ≥5KB. index-ventures.html present; index.html absent (collision resolved). benchmark.html is the 355-byte stub. |
| 8 | The regression harness runs fully offline via context.route() — no live network | VERIFIED | tests/adapters.test.mjs: `grep -c "ctx.route("` → 2 (positive + negative loops). `grep -c "page.setContent"` → 0. npm test exits 0 in ~86s with no network calls. |

**Score:** 7/8 truths verified (1 partial → gap)

### Deferred Items

None — the a16z positive test gap is not addressed by Phase 5 (Auto-Update) or Phase 6 (Response-Rate Analytics). It is an open gap within Phase 4 scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scrapers/health.mjs` | normalizeReason() named export + readHealth + writeHealth | VERIFIED | Lines 10, 19, 28. All three exports present. No new imports added (pure function). |
| `scrape-vcs.mjs` | Canonical reason codes at all 3 callsites, normalizeReason imported | VERIFIED | Line 25: import. Lines 84, 116, 122: three callsites. No `reason: err.message` present. |
| `electron/src/renderer/components/ScraperHealthPanel.tsx` | Inline reason text on Error rows, data-testid="health-reason-text" | VERIFIED | Lines 61-65 confirmed. em-dash literal present. health-panel-toggle test-id preserved. |
| `validate-adapters.mjs` | Live validation entry point with --capture and --firm flags, min 60 lines | VERIFIED | 131 lines. All flags present. normalizeReason imported. FIXTURE_FILENAMES map with Index→index-ventures.html. exits 1 on error. |
| `package.json` | npm run validate:adapters script | VERIFIED | Line 20: `"validate:adapters": "node validate-adapters.mjs"` |
| `tests/fixtures/adapters/a16z.html` | Live-captured a16z portfolio HTML | PARTIAL | Exists (6.19 MB) but contains unresolved Alpine :aria-label directives — fixture is defective for positive test replay. |
| `tests/fixtures/adapters/sequoia.html` | Live-captured | VERIFIED | 170 KB |
| `tests/fixtures/adapters/accel.html` | Live-captured | VERIFIED | 610 KB |
| `tests/fixtures/adapters/coatue.html` | Live-captured | VERIFIED | 159 KB |
| `tests/fixtures/adapters/founders-fund.html` | Live-captured | VERIFIED | 545 KB |
| `tests/fixtures/adapters/general-catalyst.html` | Live-captured | VERIFIED | 242 KB |
| `tests/fixtures/adapters/index-ventures.html` | Live-captured, collision-free name | VERIFIED | 239 KB; index.html absent |
| `tests/fixtures/adapters/khosla.html` | Live-captured | VERIFIED | 234 KB |
| `tests/fixtures/adapters/lightspeed.html` | Live-captured | VERIFIED | 646 KB |
| `tests/fixtures/adapters/benchmark.html` | Minimal stub | VERIFIED | 355 bytes |
| `tests/adapters.test.mjs` | Offline harness, min 120 lines, context.route present | VERIFIED | 107 lines (below 120 minimum per plan; however all behavioral requirements met); context.route present (2 occurrences); no page.setContent. |
| `tests/health.test.mjs` | 6 normalizeReason unit tests | VERIFIED | 29 lines, 6 test() calls. |

Note: tests/adapters.test.mjs is 107 lines vs plan's min_lines: 120. The 13-line shortfall is cosmetic (plan template included boilerplate the executor collapsed). All required behaviors are verified. This is not treated as a gap.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scrape-vcs.mjs | scrapers/health.mjs | named import of normalizeReason | VERIFIED | Line 25: `import { writeHealth, normalizeReason } from './scrapers/health.mjs'` |
| ScraperHealthPanel.tsx | data/vc-health.json (via VcFirmHealth.reason) | conditional render after status span | VERIFIED | Line 61: `{f.status === 'Error' && f.reason && ...}` |
| validate-adapters.mjs | scrapers/health.mjs | named import of normalizeReason | VERIFIED | Line 22: `import { normalizeReason } from './scrapers/health.mjs'` |
| validate-adapters.mjs | config/vc-firms.yml | yaml.load + firm filter | VERIFIED | yaml.load present; firms filtered by `f.enabled !== false && f.portfolio_url` |
| validate-adapters.mjs | scrapers/adapters/index.mjs | adapter registry lookup | VERIFIED | `adapters[firm.name] ?? adapters.__generic__` |
| package.json | validate-adapters.mjs | npm script validate:adapters | VERIFIED | Line 20 confirmed |
| tests/adapters.test.mjs | scrapers/adapters/*.mjs | per-adapter default import | VERIFIED | All 10 adapters imported by name including index-ventures.mjs |
| tests/adapters.test.mjs | tests/fixtures/adapters/*.html | readFileSync + context.route fulfill | VERIFIED | `readFileSync(join(fixturesDir, adapter.fixture))` + `ctx.route(..., route.fulfill(...))` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ScraperHealthPanel.tsx | firms array via VcFirmHealth[] | data/vc-health.json (written by scrape-vcs.mjs via writeHealth) | Yes — writeHealth atomically writes DB of firm records; scrape-vcs.mjs populates from live adapters | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| normalizeReason returns 4 canonical codes | `node -e "import(...).then(m => console.log(...))"` | null→selector_miss, TimeoutError→timeout, /timeout/i→timeout, /robots/i→robots_block, generic→network_error, undefined→selector_miss | PASS |
| scrape-vcs.mjs parses cleanly | `node --check scrape-vcs.mjs` | exit 0 | PASS |
| validate-adapters.mjs parses cleanly | `node --check validate-adapters.mjs` | exit 0 | PASS |
| tests/adapters.test.mjs parses cleanly | `node --check tests/adapters.test.mjs` | exit 0 | PASS |
| npm test exits 0 | `npm test` | 34 tests: 33 pass / 1 skip / 0 fail | PASS |
| Skipped test is a16z positive | TAP output | `ok 1 - a16z adapter parses portfolio companies from captured fixture # SKIP Plan 02 fixture-capture defect...` | PASS (skip confirmed, documented) |
| Live network not called during npm test | No network dependencies in test setup | context.route() intercepts page.goto() before any real request | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ADPT-01 | 04-02-PLAN.md | All 10 VC firm scrapers return ≥1 company record against live pages | SATISFIED | 9/9 enabled firms returned OK in live validation (Plan 02); Benchmark disabled by config. validate-adapters.mjs exits 0. |
| ADPT-02 | 04-01-PLAN.md | Scraper errors (selector miss, timeout, robots block) are visible per-firm in health panel | SATISFIED | normalizeReason() exports 4 codes; all 3 callsites in scrape-vcs.mjs use canonical codes; ScraperHealthPanel renders "● Error — selector_miss" inline. |
| ADPT-03 | 04-03-PLAN.md | A regression test fixture captures expected output per adapter so future DOM changes are caught before runtime | PARTIAL | 8/9 positive fixture tests pass; a16z positive test skipped due to defective fixture. Negative tests for all 9 firms run and prove the harness catches drift. Full ADPT-03 requires all 9 positive tests to run. |

All three Phase-4-mapped requirement IDs (ADPT-01, ADPT-02, ADPT-03) appear in exactly one plan's `requirements:` frontmatter each. No orphaned requirement IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| tests/adapters.test.mjs | 48-58 | FIXTURE_DEFECT_SKIP — a16z positive test unconditionally skipped | Warning | a16z selector drift will not be caught by npm test until fixture is corrected |
| tests/fixtures/adapters/a16z.html | (content) | Alpine :aria-label directive not resolved to static value | Warning | Fixture unusable for positive test replay; root cause of skip |
| scrapers/adapters/accel.mjs | 9 | Loop counter mutation inside .catch callback: `i = 20` (per REVIEW WR-02) | Warning | Fragile pagination break; hardcoded 20 in two places; conflates click error with end-of-pages |
| validate-adapters.mjs | 85-96 | --capture path opens fresh page without replaying adapter interactions (per REVIEW WR-01) | Warning | Paginating adapters (Accel, General Catalyst) capture only first-page HTML |

Severity classification: The a16z skip (rows 1-2) is a Blocker for ADPT-03 full satisfaction. The remaining items (rows 3-4) are Warnings per the REVIEW — they do not block goal achievement but reduce robustness.

### Human Verification Required

#### 1. a16z Live Regression Gate

**Test:** After fixing the a16z fixture (re-capturing with resolved aria-label attributes), run `npm test` and confirm the a16z positive test passes with companies.length > 0 and non-empty name fields.
**Expected:** Test `a16z adapter parses portfolio companies from captured fixture` passes (no # SKIP) and asserts ≥1 company with a real name string.
**Why human:** Requires running `node validate-adapters.mjs --capture` against live a16z.com (network access), then verifying the captured HTML has resolved aria-label attributes before running npm test.

#### 2. ScraperHealthPanel Error Reason Visible to User

**Test:** Start the Electron app, run a scrape that triggers an error on a firm, open the Discover panel, and confirm the error row shows "● Error — selector_miss" (or the relevant code) as inline text — not only as a tooltip.
**Expected:** The reason code is visible as text in the Error row without hovering.
**Why human:** UI rendering requires running the Electron app; cannot be verified programmatically.

### Gaps Summary

One gap blocks full phase goal achievement:

**The a16z positive regression test is non-functional due to a defective captured fixture.** The `tests/fixtures/adapters/a16z.html` file was captured via `page.content()` before Alpine.js hydration resolved the `:aria-label` directives on portfolio card elements. When replayed by the test harness, Alpine re-evaluates these directives against a missing `item` scope, emits `item is not defined` page errors, and the adapter's `getAttribute('aria-label')` calls return empty strings for all 1,668 card buttons. The adapter returns 0 companies; the positive assertion would fail. The executor skipped the test rather than patching the fixture (correct per plan scope rules), but left the fix as a deferred issue.

**Impact on ADPT-03:** The requirement is "a regression test fixture captures expected output per adapter so future DOM changes are caught before runtime." For a16z, no positive test is running — future selector drift on a16z will NOT be caught by `npm test`. The negative test for a16z does run (proves empty HTML gives 0 companies) but does not prove the current fixture produces correct output.

**Fix:** In `validate-adapters.mjs --capture`, before calling `page.content()` for a16z, bake resolved `aria-label` attributes into the DOM:
```js
await page.evaluate(() => {
  for (const el of document.querySelectorAll('button.group\\/card')) {
    const resolved = el.ariaLabel;
    if (resolved && resolved.trim().length > 0) el.setAttribute('aria-label', resolved);
  }
});
```
Then re-run `--capture` for a16z, replace the fixture, remove `FIXTURE_DEFECT_SKIP['a16z']` from the test, and verify the positive test passes.

---

_Verified: 2026-04-23_
_Verifier: Claude (gsd-verifier)_
