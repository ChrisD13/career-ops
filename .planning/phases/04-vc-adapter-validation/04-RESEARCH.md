# Phase 4: VC Adapter Validation - Research

**Researched:** 2026-04-23
**Domain:** Playwright fixture-based adapter testing, Node built-in test runner, VC scraper health reporting
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fixtures stored at `tests/fixtures/adapters/{firm-name}.html` — follows existing `tests/fixtures/scanner/` pattern
- Broken-selector detection via `page.setContent()` with fixture HTML — Playwright loads local HTML without network, exercises real parsing path
- Harness entry point: `tests/adapters.test.mjs` — fits `npm test` (Node test runner picks up `tests/*.test.mjs` automatically)
- Tests use a real Playwright browser launch with `page.setContent()` — exercises full adapter parsing path, not mocked
- Dedicated `validate-adapters.mjs` script — separate from `npm test` since it hits real sites and is slow; not part of CI by default
- Failure threshold: 0 companies returned = Error, ≥1 company = OK
- If adapter drift found during validation, fix selectors in this phase
- `validate-adapters.mjs --capture` saves fresh HTML to `tests/fixtures/adapters/` after a successful live run
- Canonical reason codes: `selector_miss`, `timeout`, `robots_block`, `network_error` — standardized in `scrapers/health.mjs`
- ScraperHealthPanel: surface `reason` as visible text in Error rows (currently tooltip-only via HealthStatusDot) — minor enhancement
- Reason-code mapping lives in `scrapers/health.mjs` — single source where health is written and enriched
- All 10 firms get fixture HTML files (captured via `--capture` run)
- Fixture tests verify structure only: `name` is non-empty string and array is non-empty — not brittle count matching
- `npm test` stays fully offline (fixture-only); live validation is `validate-adapters.mjs`

### Claude's Discretion
- Exact fixture HTML file naming (e.g., `a16z.html` vs `a16z-portfolio.html`)
- Whether `validate-adapters.mjs` outputs results to stdout only or also writes a summary JSON
- Specific Playwright `page.setContent()` vs `page.route()` approach for fixture injection (whichever is cleaner per adapter)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

> **Discretion resolution — fixture injection method:** CONTEXT.md Locked Decisions mention `page.setContent()`, but CONTEXT.md Claude's Discretion explicitly delegates the choice of `page.setContent()` vs `page.route()` to research. Research chose `context.route()`. Reason: all 10 adapters internally call `page.goto(firm.portfolio_url, ...)` — `setContent()` cannot intercept that call and would leave the adapter navigating the live site. `context.route()` intercepts `page.goto()` transparently; adapter code runs unchanged. Empirically verified. The Locked Decision's intent ("exercises full adapter parsing path, not mocked") is satisfied more completely by `context.route()`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADPT-01 | All 10 VC firm scrapers return ≥1 company record against live pages | `validate-adapters.mjs` runs live scrape with ≥1 threshold; selector fixes applied to drifted adapters |
| ADPT-02 | Scraper errors (selector miss, timeout, robots block) are visible per-firm in the Discover health panel | `normalizeReason()` in `scrapers/health.mjs` produces canonical codes; `ScraperHealthPanel.tsx` renders reason text in Error rows |
| ADPT-03 | A regression test fixture captures expected output per adapter so future DOM changes are caught before runtime | `tests/adapters.test.mjs` with `context.route()` + fixture HTML files; broken-selector variant test included |
</phase_requirements>

## Summary

Phase 4 validates all 10 VC firm scrapers against live pages and establishes a fixture-based regression harness so selector drift is detected before it reaches users. The work has three distinct tracks: (1) a fixture harness in `tests/adapters.test.mjs` using Playwright's `context.route()` to intercept the existing `page.goto()` call inside each adapter, (2) a standalone `validate-adapters.mjs` script that runs all adapters against live sites with a `--capture` flag to refresh fixtures, and (3) canonical error reason codes standardized in `scrapers/health.mjs` with minor `ScraperHealthPanel.tsx` rendering enhancement.

The critical technical insight is that `context.route()` (not `page.setContent()`) is the correct fixture injection mechanism. All 10 adapters call `page.goto(firm.portfolio_url, ...)` internally — if the test calls `page.setContent()` after the adapter's `page.goto()`, the adapter has already navigated to the live site and defeated isolation. `context.route()` intercepts `page.goto()` before the network hits, returning the fixture HTML at the exact URL the adapter expects. This preserves origin-based filtering logic (e.g., coatue.mjs filters `!a.href.includes('coatue.com')` which requires the page origin to match `portfolio_url`). Empirically verified: `context.route()` intercept works correctly with the a16z selector pattern (VERIFIED via local test run).

Benchmark (`benchmark.mjs`) is a special case — it never calls `page.goto()`, returns `[]` immediately, and has no public portfolio URL. Its fixture test should verify the no-op contract (returns empty array) rather than a selector-based parse.

**Primary recommendation:** Use `context.route(firm.portfolio_url, route => route.fulfill({ body: fixtureHtml, contentType: 'text/html' }))` in `before()`/`beforeEach()` setup so each adapter test runs the adapter unchanged against local HTML.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fixture-based adapter tests | Test layer (Node process) | — | Tests exercise scraper logic in isolation from network |
| Live adapter validation | Script layer (Node process) | — | Hits real VC pages; separate from CI, runs on demand |
| Error reason classification | `scrapers/health.mjs` | `scrape-vcs.mjs` | Normalization at write site; caller passes raw error, health module classifies |
| Health panel reason rendering | Frontend (React) | — | `ScraperHealthPanel.tsx` reads `vc-health.json` via IPC; renders reason text inline |
| Fixture HTML capture | `validate-adapters.mjs` | — | `--capture` flag runs fresh live scrape and saves resulting page HTML |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.1 (installed: 1.59.1) | Browser automation for adapter testing and live validation | Already used by all 10 adapters; `context.route()` intercept is official API [VERIFIED: local `playwright --version`] |
| node:test | built-in (Node 22.22.2) | Test runner for `tests/adapters.test.mjs` | Already used by `scan.test.mjs` and `statuses.test.mjs`; `before()`/`after()` hooks confirmed in Node 22 [VERIFIED: local test] |
| node:assert/strict | built-in | Assertions in tests | Established project pattern from existing test files |
| write-file-atomic | already in project | Atomic writes for fixture capture | Already used in `scrapers/health.mjs` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | already in project | Parse `config/vc-firms.yml` in `validate-adapters.mjs` | Load firm configs to get `portfolio_url` for each adapter |
| node:fs | built-in | Read fixture HTML in tests; write captured fixtures | Fixture read in `before()`, fixture write in `--capture` path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `context.route()` | `page.setContent()` | `setContent()` runs AFTER `page.goto()` in adapters — adapter has already navigated live; `route()` intercepts before network. `setContent()` also breaks origin-based link filtering because document origin becomes `about:blank` |
| Single shared context | Per-test `browser.newContext()` | Shared context lets route registrations from one test leak to another; new context per test/firm is cleaner |

**Installation:** No new packages needed — Playwright and Node built-ins cover all requirements.

**Version verification:** Playwright 1.59.1 installed, package.json specifies `^1.58.1`. [VERIFIED: `npx playwright --version`]

## Architecture Patterns

### System Architecture Diagram

```
npm test
  └── tests/adapters.test.mjs
        ├── before(): chromium.launch() → browser
        ├── per-firm test:
        │     ├── browser.newContext() → ctx
        │     ├── ctx.route(portfolio_url, fulfill(fixtureHtml))
        │     ├── adapter(ctx, {log, firm}) → companies[]
        │     ├── assert: companies.length > 0
        │     └── ctx.close()
        └── after(): browser.close()

node validate-adapters.mjs
  ├── chromium.launch() → browser
  ├── per-firm (sequential):
  │     ├── adapter(context, {log, firm}) → companies[]
  │     ├── classify error → normalizeReason()
  │     ├── print: [firm] OK (N) | Error: selector_miss
  │     └── if --capture: page.goto(url) + page.content() → fixtures/adapters/{firm}.html
  └── browser.close()

scrape-vcs.mjs (existing, enhanced)
  ├── robots_block path: hardcoded reason 'robots_block' (no error thrown)
  └── on thrown error: normalizeReason(err) → canonical code
        └── writeHealth(path, [{name, status, reason: canonicalCode, count}])

ScraperHealthPanel.tsx (existing, enhanced)
  └── Error rows: show reason text inline (not tooltip-only)
```

### Recommended Project Structure
```
tests/
├── adapters.test.mjs          # new — fixture-based adapter tests (npm test)
├── fixtures/
│   ├── scanner/               # existing
│   └── adapters/              # new
│       ├── a16z.html
│       ├── sequoia.html
│       ├── accel.html
│       ├── coatue.html
│       ├── founders-fund.html
│       ├── general-catalyst.html
│       ├── index-ventures.html
│       ├── khosla.html
│       ├── lightspeed.html
│       └── benchmark.html     # minimal stub (benchmark is no-op)
validate-adapters.mjs           # new — live validation + --capture
scrapers/
└── health.mjs                 # enhanced — adds normalizeReason()
electron/src/renderer/components/
└── ScraperHealthPanel.tsx      # enhanced — reason text in Error rows
```

### Pattern 1: context.route() Fixture Injection
**What:** Intercept `page.goto()` inside the adapter before any network call
**When to use:** Every adapter fixture test — adapter code runs unchanged
**Example:**
```javascript
// Source: Playwright docs + empirically verified in project
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import a16z from '../scrapers/adapters/a16z.mjs';

const FIRM = { name: 'a16z', portfolio_url: 'https://a16z.com/portfolio/' };
const fixtureHtml = readFileSync('tests/fixtures/adapters/a16z.html', 'utf-8');

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser.close(); });

test('a16z adapter parses portfolio companies from fixture', async () => {
  const ctx = await browser.newContext();
  await ctx.route(FIRM.portfolio_url, route =>
    route.fulfill({ contentType: 'text/html', body: fixtureHtml })
  );
  const companies = await a16z(ctx, { log: () => {}, firm: FIRM });
  assert.ok(Array.isArray(companies));
  assert.ok(companies.length > 0, 'adapter returned no companies — selector drift?');
  assert.ok(typeof companies[0].name === 'string' && companies[0].name.length > 0);
  await ctx.close();
});

test('a16z adapter returns empty array when selector does not match', async () => {
  const ctx = await browser.newContext();
  // Stripped HTML — no company cards
  const brokenHtml = '<html><body><p>No portfolio companies here.</p></body></html>';
  await ctx.route(FIRM.portfolio_url, route =>
    route.fulfill({ contentType: 'text/html', body: brokenHtml })
  );
  const companies = await a16z(ctx, { log: () => {}, firm: FIRM });
  assert.deepEqual(companies, []);
  await ctx.close();
});
```

### Pattern 2: normalizeReason() in scrapers/health.mjs
**What:** Classify raw error messages into canonical reason codes
**When to use:** In `scrape-vcs.mjs` before calling `writeHealth()`, and in `validate-adapters.mjs`
**Example:**
```javascript
// Source: [ASSUMED] — pattern derived from existing health.mjs + CONTEXT.md decisions

/**
 * Classify a raw error or condition into a canonical reason code.
 * @param {Error|null} err — thrown error, or null if adapter returned 0 companies
 * @returns {'selector_miss'|'timeout'|'robots_block'|'network_error'}
 */
export function normalizeReason(err) {
  if (!err) return 'selector_miss';  // adapter ran but returned 0 companies
  const msg = err.message ?? '';
  if (/timeout/i.test(msg) || err.name === 'TimeoutError') return 'timeout';
  if (/robots/i.test(msg)) return 'robots_block';
  return 'network_error';
}
```

**Integration in scrape-vcs.mjs — three callsites:**
```javascript
import { writeHealth, normalizeReason } from './scrapers/health.mjs';

// Callsite 1: robots.txt disallow (no thrown error — hardcode the reason directly)
// Current: healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots.txt disallow', count: 0 });
// Change to:
healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots_block', count: 0 });

// Callsite 2: 0-company result (new behavior — currently pushes OK with count: 0)
// Current: healthUpdates.push({ name: firm.name, status: 'OK', count: discovered.length });
// Change to:
if (discovered.length === 0) {
  healthUpdates.push({ name: firm.name, status: 'Error', reason: normalizeReason(null), count: 0 });
} else {
  healthUpdates.push({ name: firm.name, status: 'OK', count: discovered.length });
}

// Callsite 3: thrown error (replace raw err.message with normalized code)
// Current: healthUpdates.push({ name: firm.name, status: 'Error', reason: err.message, count: 0 });
// Change to:
healthUpdates.push({ name: firm.name, status: 'Error', reason: normalizeReason(err), count: 0 });
```

**Note:** The robots callsite (Callsite 1) does NOT use `normalizeReason()` — it's a boolean condition from `checkAllowed()`, not a thrown error. Pass `'robots_block'` directly.

### Pattern 3: validate-adapters.mjs with --capture Flag
**What:** Run all adapters against live sites; optionally save fresh fixture HTML
**When to use:** `node validate-adapters.mjs` (validate) or `node validate-adapters.mjs --capture` (refresh fixtures)
**Example:**
```javascript
// Source: [ASSUMED] — pattern derived from scrape-vcs.mjs CLI flag pattern
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { readFileSync } from 'node:fs';
import adapters from './scrapers/adapters/index.mjs';
import { normalizeReason } from './scrapers/health.mjs';

const capture = process.argv.includes('--capture');
const firmArg = process.argv.find((a, i) => process.argv[i-1] === '--firm');
const firms = yaml.load(readFileSync('config/vc-firms.yml', 'utf-8')).firms
  .filter(f => f.enabled !== false && f.portfolio_url)
  .filter(f => !firmArg || f.name.toLowerCase().includes(firmArg.toLowerCase()));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

for (const firm of firms) {
  try {
    const adapter = adapters[firm.name] ?? adapters.__generic__;
    const companies = await adapter(context, { log: console.log, firm });
    const status = companies.length > 0 ? 'OK' : 'Error';
    const reason = companies.length === 0 ? 'selector_miss' : '';
    console.log(`[${firm.name}] ${status}${reason ? ': ' + reason : ''} (${companies.length} companies)`);

    if (capture && companies.length > 0) {
      // Navigate fresh to capture HTML after successful scrape
      // Note: adapter closes its page in finally{}, so we open a separate page here
      const page = await context.newPage();
      await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 45000 });
      const html = await page.content();
      mkdirSync('tests/fixtures/adapters', { recursive: true });
      writeFileSync(`tests/fixtures/adapters/${firm.name.toLowerCase().replace(/\s+/g, '-')}.html`, html);
      console.log(`  Fixture saved: tests/fixtures/adapters/${firm.name.toLowerCase().replace(/\s+/g, '-')}.html`);
      await page.close();
    }
  } catch (err) {
    const reason = normalizeReason(err);
    console.log(`[${firm.name}] Error: ${reason} — ${err.message}`);
  }
}

await browser.close();
```

### Pattern 4: Benchmark No-Op Test
**What:** Benchmark has no public portfolio page — test the no-op contract
**When to use:** Benchmark entry in `tests/adapters.test.mjs`
```javascript
import benchmark from '../scrapers/adapters/benchmark.mjs';

test('benchmark adapter is a no-op (no public portfolio page)', async () => {
  // benchmark.mjs never calls page.goto() — context not used
  const firms = { name: 'Benchmark', portfolio_url: '' };
  const companies = await benchmark(null, { log: () => {}, firm: firms });
  assert.deepEqual(companies, []);
});
```

### Pattern 5: ScraperHealthPanel Reason Text
**What:** Surface `reason` as visible text in Error rows, not just tooltip
**When to use:** Error row rendering in `ScraperHealthPanel.tsx`
**Current:** `<HealthStatusDot status={f.status} reason={f.reason} />` shows reason as `title` attribute only
**Change:** Add `{f.status === 'Error' && f.reason && <span className="text-ctp-red ml-1 text-label">{f.reason}</span>}` after the status span

### Anti-Patterns to Avoid
- **Calling `page.setContent()` in tests:** Adapters call `page.goto()` internally — `setContent()` runs AFTER goto, so the adapter already navigated the live site. Use `context.route()` instead.
- **Sharing browser context across tests:** Route registrations leak between tests. Create a new `browser.newContext()` per test (or per firm).
- **Exact company count assertions:** Counts change as portfolios grow. Assert `length > 0` only.
- **Capturing HTML mid-adapter-execution:** The adapter closes the page after returning. Capture HTML in a separate `page.goto()` + `page.content()` call in the `--capture` path.
- **Raw `err.message` in health.json:** Passes PII-like content (stack traces, internal URLs) to the UI. Use `normalizeReason()` to produce clean canonical codes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network intercept for tests | Custom HTTP server or mock framework | `context.route()` + `route.fulfill()` | Official Playwright API, zero setup, works with existing `page.goto()` calls [VERIFIED] |
| Async test lifecycle | Manual setup/teardown variables | `before()`/`after()` from `node:test` | Confirmed in Node 22.22.2; clean and already established |
| HTML file write | Custom buffering | `node:fs` `writeFileSync` | Simple, synchronous, no race conditions during capture |

**Key insight:** Playwright's route interception is designed exactly for this pattern — intercepting real network calls in tests without modifying application code.

## Behavior Changes This Phase Introduces

> These are deliberate semantic changes to existing production behavior, not assumptions. Planner must create explicit tasks for each.

| # | Current Behavior | New Behavior | Files Changed | Impact |
|---|-----------------|--------------|---------------|--------|
| BC-1 | `scrape-vcs.mjs` records `{status: 'OK', count: 0}` when adapter returns empty array — treated as success | `{status: 'Error', reason: 'selector_miss', count: 0}` — treated as failure, visible in health panel | `scrape-vcs.mjs` | Health panel now shows Error for empty-result adapters; baseline_count logic in `writeHealth()` (only updates on OK) is unaffected |
| BC-2 | `scrape-vcs.mjs` records `{reason: err.message}` — raw stack trace or message in `vc-health.json` | `{reason: normalizeReason(err)}` — one of four canonical codes | `scrape-vcs.mjs`, `scrapers/health.mjs` | Health panel shows human-readable reason; downstream consumers of `vc-health.json` reading `reason` will see new values |
| BC-3 | `scrape-vcs.mjs` records `{reason: 'robots.txt disallow'}` — custom string | `{reason: 'robots_block'}` — canonical code | `scrape-vcs.mjs` | Same as BC-2; note this callsite bypasses `normalizeReason()` and hardcodes `'robots_block'` directly |

**Planner note on BC-1:** Temporarily zero companies can be a transient maintenance page response (returns 200 OK with no company cards). This is the correct behavior per CONTEXT.md ("0 companies = Error") but the team should be aware that the first scrape run after this change may show more Error states than expected for sites that were previously silently returning 0.

## Adapter Brittleness Audit

Based on reading all 10 adapter files [VERIFIED: codebase read]:

| Adapter | Selector Strategy | Brittleness Notes |
|---------|-----------------|-------------------|
| a16z | `article[data-portfolio-company], .portfolio-company, .company-card, li.portfolio__item` | OR chain — one leg can rot silently while others match. Fixture must use the currently-live selector branch. |
| sequoia | `a[href*="/companies/"]` | Stable pattern; `waitForSelector` adds resilience |
| benchmark | no-op (no public page) | Returns `[]` always; test verifies no-op contract only |
| accel | `a[href*="/companies/"], article.company, .company-tile` + "Load More" loop | OR chain + pagination. Fixture covers one-page state only. "Load More" is live-only behavior. |
| general-catalyst | `a[href*="/companies/"], .portfolio-company, .company` + pagination `?page=N` | Pagination loop (15 pages) cannot be fixture-tested for full coverage; test covers page 1 only. |
| coatue | `a[href^="http"]` + text-length filter + "Load More" loop | Very broad selector — any external link section change affects output. High false-positive risk. |
| founders-fund | `a[href*="/company/"], a[href*="/companies/"]` | OR chain. Note `/company/` vs `/companies/` — different from most. |
| khosla | `a[href^="http"]` + text-length filter | Same broad pattern as coatue — high false-positive risk |
| index-ventures | `a[href*="/companies/"], .company-card a` | Reasonable; `.company-card a` fallback |
| lightspeed | `.company, .portfolio-company, a[href*="/company/"]` + long timeout (45s) | OR chain; 45s timeout suggests SPA hydration issues |

**Selector drift risk ranking (high to low):** coatue, khosla (broad `a[href^="http"]`), a16z/accel/lightspeed (OR chains), general-catalyst/founders-fund/index-ventures (specific but navigated), sequoia (stable).

## Common Pitfalls

### Pitfall 1: page.setContent() After page.goto()
**What goes wrong:** Test creates a page, calls `page.setContent(fixture)`, then calls `adapter(context, ...)` — but the adapter immediately calls `page.goto(portfolio_url)`, navigating away from the fixture. Test hits the live site.
**Why it happens:** Confusing "set page content" with "intercept navigation."
**How to avoid:** Register `context.route(portfolio_url, ...)` BEFORE calling the adapter. The route intercept fires when the adapter calls `page.goto()`.
**Warning signs:** Tests pass inconsistently; test duration matches live scrape (~30s) rather than fixture load (~1s).

### Pitfall 2: Shared Browser Context Leaking Routes
**What goes wrong:** Test 1 registers `context.route('https://a16z.com/portfolio/', ...)`. Test 2 for Sequoia runs in the same context — if Sequoia's adapter accidentally matches a16z route, fixture HTML is served instead.
**Why it happens:** `context.route()` persists for the lifetime of the context.
**How to avoid:** Create `browser.newContext()` per test (or at minimum per firm). Close it after.
**Warning signs:** Adapter returns 0 companies on a valid fixture; route logging shows unexpected intercepts.

### Pitfall 3: Benchmark Test Passing Null Context
**What goes wrong:** `benchmark.mjs` never uses `context`, so passing `null` works — but if the adapter is accidentally changed to use context, test silently breaks with a null reference.
**Why it happens:** No-op adapters tempt shortcuts.
**How to avoid:** Still create a real context for benchmark, just don't register a route. The no-op test verifies the empty return contract, not route behavior.

### Pitfall 4: --capture Saving Mid-Adapter HTML
**What goes wrong:** Trying to capture `page.content()` inside the adapter execution — but adapters call `page.close()` in `finally`. Content is lost.
**Why it happens:** Reusing the adapter's internal page lifecycle.
**How to avoid:** After a successful live run, open a fresh page, navigate to `firm.portfolio_url`, call `page.content()`, write to fixture. Keep capture logic entirely outside adapter code.

### Pitfall 5: Pagination Adapters Appear to Work but Only Cover Page 1
**What goes wrong:** general-catalyst adapter loops `?page=1..15`. Fixture covers page 1 only. Test passes with ≥1 company, but pages 2-15 behavior is not covered by fixtures.
**Why it happens:** Single-fixture design inherently captures one page state.
**How to avoid:** Document this limitation; accept that pagination is live-only behavior. Fixture test covers: "can adapter parse at least one page?" which is the primary regression check.

### Pitfall 6: OR-Selector Adapters — Fixture Tests Miss Drift on Inactive Branches
**What goes wrong:** a16z adapter has 4 selectors chained with `,`. Fixture HTML matches `article[data-portfolio-company]`. Live site changes to use `.company-card` instead. Test still passes (fixture still has `article[data-portfolio-company]`). Drift undetected until production run.
**Why it happens:** OR selectors make fixtures only as specific as the HTML they contain.
**How to avoid:** Fixture HTML must use only the selector branch currently active on the live site. Run `--capture` to refresh fixtures after any live site change. Accept that OR-selector adapters have inherently weaker regression coverage.

## Code Examples

Verified patterns from official sources and codebase inspection:

### Node test before/after hooks (verified working in Node 22.22.2)
```javascript
// Source: Verified locally — node:test v22.22.2
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser.close(); });

test('example', async () => {
  const ctx = await browser.newContext();
  // ... test using ctx ...
  await ctx.close();
});
```

### context.route() intercept (verified working with a16z adapter pattern)
```javascript
// Source: Verified locally — Playwright 1.59.1 in project
const ctx = await browser.newContext();
await ctx.route('https://a16z.com/portfolio/', route =>
  route.fulfill({ contentType: 'text/html', body: fixtureHtml })
);
// adapter's page.goto() is intercepted — no network call made
const companies = await a16z(ctx, { log: () => {}, firm: FIRM });
assert.ok(companies.length > 0);
await ctx.close();
```

### Broken-selector "empty fixture" test pattern
```javascript
// Source: [ASSUMED] — derived from CONTEXT.md "mutated fixture" spec
test('a16z returns empty array when selectors do not match', async () => {
  const ctx = await browser.newContext();
  await ctx.route(FIRM.portfolio_url, route =>
    route.fulfill({ contentType: 'text/html', body: '<html><body><p>No portfolio.</p></body></html>' })
  );
  const companies = await a16z(ctx, { log: () => {}, firm: FIRM });
  assert.deepEqual(companies, []);
  await ctx.close();
});
```

### Fixture HTML naming convention (Claude's discretion — recommend)
Use kebab-case firm name matching adapter registry key:
- `a16z.html` (key: `'a16z'`)
- `sequoia.html` (key: `'Sequoia'` — normalize to lowercase)
- `benchmark.html` (minimal stub only)
- `accel.html`, `general-catalyst.html`, `coatue.html`, `founders-fund.html`
- `khosla.html`, `index-ventures.html`, `lightspeed.html`

Naming function: `firm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock page object | `context.route()` real browser with intercept | Playwright ~1.10+ | Tests exercise real browser rendering, not mock DOM |
| `page.setContent()` for isolation | `context.route()` + `page.goto()` preserved | Always available | Adapter code runs unchanged; origin-based filtering preserved |
| Error reason = raw `err.message` | Canonical reason codes (`selector_miss`, etc.) | This phase | Consistent UI display; no stack traces surfaced to user |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `normalizeReason()` should be a new export from `scrapers/health.mjs` (not inline in `scrape-vcs.mjs`) | Pattern 2 | Low — location is an implementation detail; either works |
| A2 | Fixture file naming uses kebab-case firm name (`founders-fund.html`, `general-catalyst.html`, `index-ventures.html`) | Code Examples | Low — naming is Claude's discretion; adjust at planning |
| A3 | `validate-adapters.mjs` outputs to stdout only (no summary JSON) | Pattern 3 | Low — stdout sufficient for manual runs; JSON optional per CONTEXT.md discretion |
| A4 | Benchmark fixture is a minimal HTML stub (not a captured real page) since benchmark never navigates | Pattern 4 | Medium — if planner wants consistency across all 10 firms; stub is correct given no-op contract |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (A1-A4 are low-risk implementation details, not user-facing decisions.)

## Open Questions (RESOLVED)

1. **Benchmark in `validate-adapters.mjs`**
   - What we know: `benchmark.mjs` always returns `[]` with no network call; config marks it `enabled: false`
   - What's unclear: Should `validate-adapters.mjs` skip Benchmark (it's disabled in config), or run it explicitly to verify the no-op contract?
   - Recommendation: Skip it in `validate-adapters.mjs` (it filters `f.enabled !== false && f.portfolio_url`); include the no-op test in `tests/adapters.test.mjs` for contract coverage
   - RESOLVED: Plans 02 + 03 implement this split — skipped in live validation, tested in harness

2. **validate-adapters.mjs --capture for pagination adapters**
   - What we know: general-catalyst and accel have "Load More" / pagination loops in their adapters
   - What's unclear: After adapter completes, the page is closed. The `--capture` path opens a fresh page and calls `page.goto()` without the pagination loop — it captures page 1 only
   - Recommendation: Accept page-1-only capture; document in comments; the fixture test for GC/Accel covers the "can parse at least one page" contract
   - RESOLVED: Plan 02 Task 2 documents page-1-only limitation in capture step comments

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Playwright | Adapter tests, live validation | Yes | 1.59.1 (project) | — |
| Node.js | All scripts and tests | Yes | 22.22.2 | — |
| Chromium (Playwright) | Browser launch in tests | Yes | Bundled with Playwright | — |
| `config/vc-firms.yml` | `validate-adapters.mjs` | Yes (present in repo) | — | Falls back to example yml with warning |

**Missing dependencies with no fallback:** None.

## Security Domain

Security enforcement is enabled (absent = enabled). This phase involves only local fixture files, local browser execution, and enhancement of existing scraping infrastructure. ASVS applicability is minimal.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth involved in scraping or testing |
| V3 Session Management | No | No sessions; local-only execution |
| V4 Access Control | No | Tests run locally; no multi-user concern |
| V5 Input Validation | Low | Fixture HTML is developer-controlled input; adapter output validated by type checks |
| V6 Cryptography | No | No encryption needed |

**Relevant threat:** `normalizeReason()` prevents raw error messages (which may contain internal file paths or stack traces) from being surfaced in the Electron UI health panel. The canonical reason codes are the control here.

## Sources

### Primary (HIGH confidence)
- Local codebase read — all 10 adapter files, `scrapers/health.mjs`, `scrape-vcs.mjs`, `tests/scan.test.mjs`, `ScraperHealthPanel.tsx`, `HealthStatusDot.tsx` [VERIFIED: file read]
- Local runtime verification — `context.route()` intercept working with a16z selector pattern [VERIFIED: live test run]
- Local runtime verification — `node:test` `before()`/`after()` hooks working in Node 22.22.2 [VERIFIED: live test run]
- `npx playwright --version` → 1.59.1 [VERIFIED]
- `node --version` → 22.22.2 [VERIFIED]

### Secondary (MEDIUM confidence)
- Playwright route/fulfill API pattern — consistent with Playwright documentation conventions [ASSUMED training, structure verified locally]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright and Node built-ins already in project, verified versions
- Architecture: HIGH — `context.route()` pattern empirically verified with actual adapter selectors
- Pitfalls: HIGH — derived from reading all 10 adapter files and local test execution
- Adapter brittleness: HIGH — read from source files directly

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (adapter selectors may drift with live site changes; fixture HTML captured via `--capture` will be the living reference)
