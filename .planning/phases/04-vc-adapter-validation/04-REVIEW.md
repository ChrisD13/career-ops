---
phase: 04-vc-adapter-validation
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - electron/src/renderer/components/ScraperHealthPanel.tsx
  - package.json
  - scrape-vcs.mjs
  - scrapers/adapters/a16z.mjs
  - scrapers/adapters/accel.mjs
  - scrapers/adapters/founders-fund.mjs
  - scrapers/adapters/general-catalyst.mjs
  - scrapers/health.mjs
  - tests/adapters.test.mjs
  - tests/health.test.mjs
  - validate-adapters.mjs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 4 added `normalizeReason()` in `scrapers/health.mjs`, wired three callsites in `scrape-vcs.mjs`, surfaced the reason field in `ScraperHealthPanel.tsx`, introduced `validate-adapters.mjs` for live validation with an optional `--capture` mode, and created `tests/adapters.test.mjs` as an offline Playwright harness.

The new code is generally clean. `normalizeReason()` is well-tested (6 cases covering null, undefined, name-based dispatch, message-based dispatch, and fallback). The test harness uses per-test browser contexts correctly to prevent route-leak cross-contamination. The known a16z fixture defect is properly documented and skipped with a pointer to the summary.

Two warnings exist: one in the `--capture` flow of `validate-adapters.mjs` (fixtures captured without replaying adapter interactions) and one in `accel.mjs` (mutating the loop counter from inside a `.catch` callback). Three info-level items round out the findings.

---

## Warnings

### WR-01: `--capture` path opens a fresh page without replaying adapter interactions

**File:** `validate-adapters.mjs:85-96`

**Issue:** The `--capture` flow runs the adapter on one page (which may click "Load All", loop through "Load More", or paginate), then opens a *second* brand-new page and calls `page.goto()` + `page.content()` without any of those interactions. Fixtures for `Accel` (which paginates via a "Load More" loop) and `General Catalyst` (which iterates up to 15 pages) will therefore capture only the first-page HTML. When replayed in `tests/adapters.test.mjs`, the fixture presents less content than production, so the adapter's positive test only validates against a shallow snapshot. This is the same root-cause shape as the Plan 02 a16z fixture defect documented in the test file at lines 42-50.

**Fix:** After the adapter returns successfully, reuse the *existing* page rather than navigating a new one. Because the adapter closes its own page in the `finally` block, the simplest approach is to capture HTML from within the adapter itself (or before `page.close()`) and return it alongside the companies array — or pass a `capture` flag into the adapter so it serializes `page.content()` before closing. A lighter alternative for accel/gc-style adapters is to capture per-page within the loop and concatenate. At minimum, document in `validate-adapters.mjs` that the captured fixture may be shallower than a full run for paginating adapters:

```js
// TODO: --capture for paginating adapters (Accel, General Catalyst) captures only
// the first page because the second goto() does not replay Load More / pagination.
// Fixture files for these adapters represent a subset of the live portfolio.
```

---

### WR-02: Loop counter mutated inside `.catch` callback to break iteration

**File:** `scrapers/adapters/accel.mjs:9`

**Issue:** `await btn.click().catch(() => { i = 20; })` sets the outer `for` variable from inside the `.catch` callback as a control-flow mechanism. This is fragile: the cap `20` is hardcoded in two places (the loop bound and the assignment), so changing one without the other silently changes behavior. It also conflates "click threw an error" with "no more pages" — a transient click failure will prematurely terminate pagination.

```js
for (let i = 0; i < 20; i++) {
  const btn = page.locator('button:has-text("Load More"), button:has-text("Load more")').first();
  if (!(await btn.isVisible().catch(() => false))) break;
  await btn.click().catch(() => { i = 20; });   // <-- mutates loop counter
  await page.waitForTimeout(1000);
}
```

**Fix:** Use a boolean flag for the break condition and let click errors propagate or be handled separately:

```js
let stop = false;
for (let i = 0; i < 20 && !stop; i++) {
  const btn = page.locator('button:has-text("Load More"), button:has-text("Load more")').first();
  if (!(await btn.isVisible().catch(() => false))) break;
  try {
    await btn.click();
  } catch {
    stop = true;  // click failed — treat as no more pages
  }
  await page.waitForTimeout(1000);
}
```

---

## Info

### IN-01: `robots_block` hardcoded inline instead of routed through `normalizeReason()`

**File:** `scrape-vcs.mjs:84`

**Issue:** Line 84 pushes `reason: 'robots_block'` as a string literal, while lines 116 and 122 correctly call `normalizeReason()`. The stated goal of Phase 4 was a single source of truth for reason codes. The literal string happens to match today's enum, but a future rename of the canonical value in `health.mjs` would produce a silent mismatch.

**Fix:** Route all three reason assignments through `normalizeReason()` consistently. For the robots-block case a typed sentinel error works cleanly:

```js
// line 84 — instead of:
healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots_block', count: 0 });

// use:
const robotsErr = new Error('robots disallow');
healthUpdates.push({ name: firm.name, status: 'Error', reason: normalizeReason(robotsErr), count: 0 });
```

Alternatively, export the canonical reason strings as constants from `health.mjs` so callers can reference them without constructing synthetic errors.

---

### IN-02: `reason` displayed only for `status === 'Error'` in `ScraperHealthPanel`

**File:** `electron/src/renderer/components/ScraperHealthPanel.tsx:61-65`

**Issue:** The render guard is `f.status === 'Error' && f.reason`. The `VcFirmHealth` type declares `reason?: string` with no constraint tying it to a specific status, and `writeHealth` in `health.mjs` spreads `reason` onto records regardless of status. If a future status (e.g., `'Stale'`) gains a reason field, it will be silently swallowed in the UI. Not a bug today, but the consumer is more fragile than it needs to be.

**Fix:** Render reason whenever it is present, independent of status:

```tsx
{f.reason && (
  <span className="text-ctp-subtext text-label" data-testid="health-reason-text">
    — {f.reason}
  </span>
)}
```

---

### IN-03: General Catalyst adapter uses a broad `.company` selector

**File:** `scrapers/adapters/general-catalyst.mjs:10`

**Issue:** The selector string `'a[href*="/companies/"], .portfolio-company, .company'` includes `.company` as a fallback. That class name is generic enough to match navigation chrome, footers, or unrelated sections if the site redesigns. The selector is last in the chain, so it only activates if the first two match nothing — low immediate risk, but it has produced noise in other VC portfolio scrapers in this codebase.

**Fix:** Tighten to the most specific known selectors and document the fallback:

```js
// Remove the generic .company fallback or scope it:
'a[href*="/companies/"], .portfolio-company'
// If a third fallback is needed, scope it: '.portfolio-section .company'
```

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
