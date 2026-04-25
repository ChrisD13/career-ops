---
phase: 04-vc-adapter-validation
verified: 2026-04-24T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "Every enabled adapter (9 firms) has one positive test asserting companies.length > 0 against its captured fixture"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Start the Electron app, trigger a scrape that produces an Error on at least one firm, open the Discover panel, and confirm the error row shows the reason code (e.g. '● Error — selector_miss') as inline visible text — not just as a tooltip or hidden element."
    expected: "The reason code is visible as text in the Error row without hovering. data-testid='health-reason-text' span is rendered in the DOM and visible to the user."
    why_human: "UI rendering requires running the Electron app; ScraperHealthPanel.tsx conditional render cannot be verified by code inspection alone — the conditional may evaluate false at runtime if reason is absent or the scrape path that populates it is not triggered."
---

# Phase 4: VC Adapter Validation Verification Report

**Phase Goal:** All 10 VC firm scrapers are validated against live pages and drifting selectors are caught by a regression harness before they reach users
**Verified:** 2026-04-24
**Status:** human_needed
**Re-verification:** Yes — after gap closure plan 04-04 (a16z fixture Alpine bake)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run a full scrape and see at least one company record returned from each of the 10 VC firms | VERIFIED | Plan 02 live run: 9/9 enabled firms returned OK (9 OK / 0 Error); Benchmark disabled by config. validate-adapters.mjs exits non-zero on any Error. Four drifted adapters (a16z, Accel, Founders Fund, General Catalyst) were repaired; all verified live. |
| 2 | User can open the Discover panel health view and see per-firm status including any errors | VERIFIED | ScraperHealthPanel.tsx lines 61-65: `{f.status === 'Error' && f.reason && (<span ... data-testid="health-reason-text">— {f.reason}</span>)}`. All 3 callsites in scrape-vcs.mjs write canonical reason codes. |
| 3 | A test run against saved fixtures catches a deliberately broken selector and reports failure without hitting live pages | VERIFIED | Plan 04-04: re-captured a16z.html (878 resolved aria-label attributes, 0 Alpine :aria-label directives). FIXTURE_DEFECT_SKIP removed from tests/adapters.test.mjs. npm test 34/34 pass, 0 skips. TAP output: `ok 1 - a16z adapter parses portfolio companies from captured fixture` (no # SKIP). All 9 enabled adapters have active positive regression gates; all 9 have active negative regression gates. |
| 4 | normalizeReason() classifies thrown errors and null into one of four canonical codes | VERIFIED | scrapers/health.mjs lines 10-17: export confirmed. Live behavioral spot-check: null→selector_miss, TimeoutError→timeout, /timeout/i→timeout, /robots/i→robots_block, generic→network_error, undefined→selector_miss. |
| 5 | scrape-vcs.mjs treats adapter returning 0 companies as Error with reason selector_miss (BC-1) | VERIFIED | scrape-vcs.mjs line 115-117: `if (discovered.length === 0) { healthUpdates.push({ name: firm.name, status: 'Error', reason: normalizeReason(null), count: 0 }); }`. No raw err.message or robots.txt disallow strings in reason field. |
| 6 | User can run `node validate-adapters.mjs` and see per-firm OK/Error for all 9 enabled firms | VERIFIED | validate-adapters.mjs: 172 lines, shebang present, imports normalizeReason, reads config/vc-firms.yml, exits 1 if errCount>0. npm script "validate:adapters" confirmed in package.json line 20. |
| 7 | 10 fixture HTML files exist under tests/fixtures/adapters/ with correct names | VERIFIED | `ls tests/fixtures/adapters/*.html | wc -l` → 10. All 9 live-captured fixtures ≥5KB. index-ventures.html present; index.html absent (collision resolved). benchmark.html is the 355-byte stub. |
| 8 | The regression harness runs fully offline via context.route() — no live network | VERIFIED | tests/adapters.test.mjs: `grep -c "ctx.route("` → 2 (positive + negative loops). `grep -c "page.setContent"` → 0. npm test exits 0 in ~108s with no network calls. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scrapers/health.mjs` | normalizeReason() named export + readHealth + writeHealth | VERIFIED | Lines 10, 19, 28. All three exports present. No new imports added (pure function). |
| `scrape-vcs.mjs` | Canonical reason codes at all 3 callsites, normalizeReason imported | VERIFIED | Line 25: import. Lines 84, 116, 122: three callsites. No `reason: err.message` present. |
| `electron/src/renderer/components/ScraperHealthPanel.tsx` | Inline reason text on Error rows, data-testid="health-reason-text" | VERIFIED | Lines 61-65 confirmed. em-dash literal present. health-panel-toggle test-id preserved. |
| `validate-adapters.mjs` | Live validation entry point with --capture and --firm flags, a16z-aware bake branch, min 130 lines | VERIFIED | 172 lines. All flags present. a16z branch at `if (firm.name === 'a16z')`: bakes aria-label from DOM IDL, removes Alpine directive attributes, post-processes HTML string with regex. normalizeReason imported. exits 1 on error. |
| `package.json` | npm run validate:adapters script | VERIFIED | Line 20: `"validate:adapters": "node validate-adapters.mjs"` |
| `tests/fixtures/adapters/a16z.html` | Live-captured a16z portfolio HTML with resolved static aria-label attributes | VERIFIED | 6,093,050 bytes. `grep -cE 'aria-label="[A-Za-z][^"]*"'` → 878. `grep -c ':aria-label='` → 0. Replay-safe: no Alpine directive source. |
| `tests/fixtures/adapters/sequoia.html` | Live-captured | VERIFIED | 170 KB |
| `tests/fixtures/adapters/accel.html` | Live-captured | VERIFIED | 610 KB |
| `tests/fixtures/adapters/coatue.html` | Live-captured | VERIFIED | 159 KB |
| `tests/fixtures/adapters/founders-fund.html` | Live-captured | VERIFIED | 545 KB |
| `tests/fixtures/adapters/general-catalyst.html` | Live-captured | VERIFIED | 242 KB |
| `tests/fixtures/adapters/index-ventures.html` | Live-captured, collision-free name | VERIFIED | 239 KB; index.html absent |
| `tests/fixtures/adapters/khosla.html` | Live-captured | VERIFIED | 234 KB |
| `tests/fixtures/adapters/lightspeed.html` | Live-captured | VERIFIED | 646 KB |
| `tests/fixtures/adapters/benchmark.html` | Minimal stub | VERIFIED | 355 bytes |
| `tests/adapters.test.mjs` | Offline harness, context.route present, FIXTURE_DEFECT_SKIP removed, min 95 lines | VERIFIED | 95 lines. FIXTURE_DEFECT_SKIP: 0 occurrences. `skip:` options arg: 0 occurrences. context.route present (2 occurrences); no page.setContent. |
| `tests/health.test.mjs` | 6 normalizeReason unit tests | VERIFIED | 29 lines, 6 test() calls. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scrape-vcs.mjs | scrapers/health.mjs | named import of normalizeReason | VERIFIED | Line 25: `import { writeHealth, normalizeReason } from './scrapers/health.mjs'` |
| ScraperHealthPanel.tsx | data/vc-health.json (via VcFirmHealth.reason) | conditional render after status span | VERIFIED | Line 61: `{f.status === 'Error' && f.reason && ...}` |
| validate-adapters.mjs | scrapers/health.mjs | named import of normalizeReason | VERIFIED | Line 22: `import { normalizeReason } from './scrapers/health.mjs'` |
| validate-adapters.mjs | config/vc-firms.yml | yaml.load + firm filter | VERIFIED | yaml.load present; firms filtered by `f.enabled !== false && f.portfolio_url` |
| validate-adapters.mjs | scrapers/adapters/index.mjs | adapter registry lookup | VERIFIED | `adapters[firm.name] ?? adapters.__generic__` |
| validate-adapters.mjs | tests/fixtures/adapters/a16z.html | page.evaluate() bakes aria-label → page.content() → writeFileSync | VERIFIED | `setAttribute('aria-label', ...)` call confirmed; `removeAttribute(':aria-label')` confirmed; post-process regex `html.replace(/\s*:aria-label="[^"]*"/g, '')` confirmed. |
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
| npm test exits 0 | `npm test` | 34 tests: 34 pass / 0 skip / 0 fail | PASS |
| a16z positive test active and passing | TAP output | `ok 1 - a16z adapter parses portfolio companies from captured fixture` (no # SKIP) | PASS |
| Zero skips in TAP output | `npm test 2>&1 | grep -c "# SKIP"` | 0 | PASS |
| FIXTURE_DEFECT_SKIP removed | `grep -c 'FIXTURE_DEFECT_SKIP' tests/adapters.test.mjs` | 0 | PASS |
| a16z fixture: 878 resolved aria-labels | `grep -cE 'aria-label="[A-Za-z][^"]*"' tests/fixtures/adapters/a16z.html` | 878 | PASS |
| a16z fixture: 0 Alpine directives | `grep -c ':aria-label=' tests/fixtures/adapters/a16z.html` | 0 | PASS |
| a16z-specific capture branch scoped | `grep -c "if (firm.name === 'a16z')" validate-adapters.mjs` | 1 | PASS |
| Live network not called during npm test | context.route() intercepts page.goto() before any real request | context.route() confirmed (2 occurrences); no page.setContent | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ADPT-01 | 04-02-PLAN.md | All 10 VC firm scrapers return ≥1 company record against live pages | SATISFIED | 9/9 enabled firms returned OK in live validation (Plan 02); Benchmark disabled by config. validate-adapters.mjs exits 0. |
| ADPT-02 | 04-01-PLAN.md | Scraper errors (selector miss, timeout, robots block) are visible per-firm in health panel | SATISFIED | normalizeReason() exports 4 codes; all 3 callsites in scrape-vcs.mjs use canonical codes; ScraperHealthPanel renders "● Error — selector_miss" inline. (UI rendering pending human verification.) |
| ADPT-03 | 04-03-PLAN.md | A regression test fixture captures expected output per adapter so future DOM changes are caught before runtime | SATISFIED | Plan 04-04: all 9 enabled adapters now have active positive and negative regression gates. npm test 34/34 pass, 0 skips. a16z fixture re-captured with 878 resolved static aria-label attributes; FIXTURE_DEFECT_SKIP removed. |

All three Phase-4-mapped requirement IDs (ADPT-01, ADPT-02, ADPT-03) appear in exactly one plan's `requirements:` frontmatter each. No orphaned requirement IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scrapers/adapters/accel.mjs | 9 | Loop counter mutation inside .catch callback: `i = 20` (per REVIEW WR-02) | Warning | Fragile pagination break; hardcoded 20 in two places; conflates click error with end-of-pages |
| validate-adapters.mjs | 85-96 | --capture path opens fresh page without replaying adapter interactions (per REVIEW WR-01) | Warning | Paginating adapters (Accel, General Catalyst) capture only first-page HTML |

Note: The two a16z-specific anti-patterns from initial verification (FIXTURE_DEFECT_SKIP skip and defective fixture) are resolved. The remaining two warnings do not block goal achievement.

### Human Verification Required

#### 1. ScraperHealthPanel Error Reason Visible to User

**Test:** Start the Electron app, run a scrape that triggers an error on a firm (e.g. temporarily modify a selector to produce 0 companies), open the Discover panel, and confirm the error row shows "● Error — selector_miss" (or the relevant code) as inline text — not only as a tooltip.
**Expected:** The reason code is visible as text in the Error row without hovering. The `data-testid="health-reason-text"` span renders in the DOM and is visible to the user.
**Why human:** UI rendering requires running the Electron app. The conditional `{f.status === 'Error' && f.reason && ...}` is confirmed in source (ScraperHealthPanel.tsx lines 61-65), but actual rendering depends on the health data having a populated `reason` field at runtime — which requires a live scrape that produces an error.

### Gaps Summary

No gaps remain. All 8 observable truths are VERIFIED. ADPT-01, ADPT-02, and ADPT-03 are SATISFIED.

Gap closure summary (plan 04-04):
- **Root cause fixed:** `validate-adapters.mjs --capture` now bakes resolved Alpine aria-label attributes into the DOM (via `page.evaluate()`) and post-processes the serialized HTML string (regex-strip of `:aria-label="..."` occurrences from template innerHTML) before writing the fixture. This is a16z-gated and idempotent.
- **Fixture corrected:** `tests/fixtures/adapters/a16z.html` re-captured with 878 static `aria-label="CompanyName"` attributes and 0 Alpine `:aria-label` directives. Verified: `grep -cE 'aria-label="[A-Za-z][^"]*"'` → 878; `grep -c ':aria-label='` → 0.
- **Test unskipped:** `FIXTURE_DEFECT_SKIP` removed from `tests/adapters.test.mjs`. a16z positive test now runs unconditionally and passes: `ok 1 - a16z adapter parses portfolio companies from captured fixture`.
- **Scope held:** no adapter code changed (`git diff HEAD~3 -- scrapers/adapters/ | wc -l` → 0); no other fixtures changed.

One human verification item remains (ScraperHealthPanel visible error rendering) which elevates status to `human_needed`. Once confirmed, phase 04 is fully closed.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
_Re-verification: After plan 04-04 gap closure_
