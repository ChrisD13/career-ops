# Phase 4: VC Adapter Validation - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/adapters.test.mjs` | test | request-response | `tests/scan.test.mjs` | exact |
| `validate-adapters.mjs` | utility/script | batch | `scrape-vcs.mjs` | exact |
| `tests/fixtures/adapters/{firm}.html` (×10) | fixture | file-I/O | `tests/fixtures/scanner/` | structural |
| `scrapers/health.mjs` (modified) | utility | transform | same file (current state) | self |
| `scrape-vcs.mjs` (modified) | script | batch | same file (current state) | self |
| `electron/src/renderer/components/ScraperHealthPanel.tsx` (modified) | component | request-response | same file (current state) | self |

---

## Pattern Assignments

### `tests/adapters.test.mjs` (test, request-response)

**Analog:** `tests/scan.test.mjs`

**Imports pattern** (`tests/scan.test.mjs` lines 1-22):
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
```

**Fixtures directory resolution** (`tests/scan.test.mjs` lines 21-22):
```javascript
const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'scanner');
```
For adapters, replace `'scanner'` with `'adapters'` — same pattern.

**Core test structure** (`tests/scan.test.mjs` lines 28-54, simplified):
```javascript
test('detectApi recognizes supported ATS patterns', () => {
  assert.deepEqual(
    detectApi({ careers_url: 'https://jobs.ashbyhq.com/example' }),
    { type: 'ashby', url: '...' },
  );
});
```
The pattern is a top-level `test()` call with a descriptive string and a synchronous or async callback. `adapters.test.mjs` uses the same structure but with `async` callbacks (Playwright is async) and `before()`/`after()` lifecycle hooks from `node:test`.

**Import note for `before`/`after`:** `scan.test.mjs` does not use lifecycle hooks because it has no shared browser. `adapters.test.mjs` needs them. `node:test` exports `before` and `after` — import like:
```javascript
import { before, after, test } from 'node:test';
```
This is the same module already used by `scan.test.mjs`; the extended import list is the only delta.

**Adapter function contract** (`scrapers/adapters/a16z.mjs` lines 1-23):
```javascript
export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    // ... selector evaluation ...
    return companies;
  } finally {
    await page.close();
  }
}
```
Every adapter (except `benchmark.mjs`) follows this exact signature. Tests call: `adapter(ctx, { log: () => {}, firm: FIRM })`. The `firm` object must supply `portfolio_url` (used in `page.goto()`) and `name` (used in log messages). The test's `ctx.route(firm.portfolio_url, ...)` intercept must be registered before the adapter call — the route fires when the adapter's own `page.goto()` runs.

**Benchmark no-op contract** (`scrapers/adapters/benchmark.mjs` lines 1-4):
```javascript
export default async function scrape(_context, { log, firm }) {
  log(`[${firm.name}] Benchmark has no public portfolio page — ...`);
  return [];
}
```
`benchmark.mjs` never calls `page.goto()` and never uses `context`. Its test verifies the no-op return: `assert.deepEqual(companies, [])`. A real context (not `null`) should still be passed per best practice — just don't register any route for it.

**Adapter registry keys** (`scrapers/adapters/index.mjs` lines 32-44):
```javascript
const adapters = {
  'a16z': a16z,
  'Sequoia': sequoia,
  'Benchmark': benchmark,
  'Accel': accel,
  'General Catalyst': generalCatalyst,
  'Coatue': coatue,
  'Founders Fund': foundersFund,
  'Khosla': khosla,
  'Index': indexVentures,
  'Lightspeed': lightspeed,
  __generic__: generic,
};
```
These are the `firm.name` values passed to each adapter. Tests must use the same `firm.name` string so adapter log messages are accurate. Note the naming inconsistency flagged below.

---

### `validate-adapters.mjs` (script, batch)

**Analog:** `scrape-vcs.mjs`

**Shebang + JSDoc header** (`scrape-vcs.mjs` lines 1-16):
```javascript
#!/usr/bin/env node

/**
 * scrape-vcs.mjs — VC portfolio discovery scraper
 *
 * Usage:
 *   node scrape-vcs.mjs                  # scrape all enabled firms
 *   node scrape-vcs.mjs --dry-run        # preview without writing
 *   node scrape-vcs.mjs --firm a16z      # scrape a single firm
 */
```
Copy this structure for `validate-adapters.mjs`, adapting description and usage examples (`--capture`, `--firm`).

**CLI flag parsing** (`scrape-vcs.mjs` lines 37-40):
```javascript
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const firmFlagIdx = args.indexOf('--firm');
const firmFilter = firmFlagIdx !== -1 ? (args[firmFlagIdx + 1] ?? '').toLowerCase() : null;
```
`validate-adapters.mjs` replaces `--dry-run` with `--capture` but uses the identical `args.includes()` pattern. `--firm` filter reuses the same `indexOf` pattern.

**YAML config load** (`scrape-vcs.mjs` lines 47-57):
```javascript
const firmsDoc = yaml.load(readFileSync(CONFIG_PATH, 'utf-8'));
let firms;
if (firmFilter) {
  firms = (firmsDoc?.firms ?? []).filter(f => f.name.toLowerCase().includes(firmFilter));
  if (firms.length === 0) {
    console.error(`Error: no firms match --firm ${firmFilter}`);
    process.exit(1);
  }
} else {
  firms = (firmsDoc?.firms ?? []).filter(f => f.enabled !== false && f.portfolio_url);
}
```
`validate-adapters.mjs` copies this exactly. The default filter (`enabled !== false && f.portfolio_url`) naturally excludes Benchmark (no `portfolio_url` set, or `enabled: false`).

**Playwright setup** (`scrape-vcs.mjs` lines 72-73):
```javascript
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ userAgent: USER_AGENT });
```
`validate-adapters.mjs` uses `headless: true` without a custom `userAgent` (it's a developer tool, not a production scraper). The `USER_AGENT` import from `scrapers/robots.mjs` can be omitted.

**Firm iteration with error handling** (`scrape-vcs.mjs` lines 78-121):
```javascript
for (const firm of firms) {
  try {
    // ... adapter call ...
    healthUpdates.push({ name: firm.name, status: 'OK', count: discovered.length });
  } catch (err) {
    console.error(`[${firm.name}] error: ${err.message}`);
    healthUpdates.push({ name: firm.name, status: 'Error', reason: err.message, count: 0 });
  }
  await randomDelay();
}
```
`validate-adapters.mjs` uses the same `for...of` + `try/catch` structure. Replace `healthUpdates.push(...)` with `console.log()` output. Replace `err.message` with `normalizeReason(err)`. Omit `randomDelay()` or keep it — the `--capture` path only runs after a successful scrape and opens a separate page.

**Guard against missing config file** (`scrape-vcs.mjs` lines 42-46):
```javascript
if (!existsSync(CONFIG_PATH)) {
  console.error(`Error: ${CONFIG_PATH} not found. Copy from config/vc-firms.example.yml first.`);
  process.exit(1);
}
```
Copy this guard into `validate-adapters.mjs` for the same `CONFIG_PATH`.

**Top-level await pattern** (`scrape-vcs.mjs` lines 151-157):
```javascript
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal:', err?.stack ?? err?.message ?? err);
    process.exit(1);
  });
}
export { main };
```
`validate-adapters.mjs` is a standalone script (not imported by other modules), so the simpler `main().catch(...)` pattern without the `isDirectRun` guard is acceptable. But copying the guard adds no cost and keeps consistency.

---

### `tests/fixtures/adapters/{firm}.html` (×10) (fixture, file-I/O)

**Analog:** `tests/fixtures/scanner/` directory (structural)

**Directory convention** (`tests/scan.test.mjs` lines 21-22):
```javascript
const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'scanner');
```
Fixture files live under `tests/fixtures/{category}/`. The new category is `adapters`. Files are loaded with `readFileSync(join(fixturesDir, '{firm}.html'), 'utf-8')`.

**Fixture file naming — PLANNER NOTE (naming inconsistency to resolve):**
The `--capture` naming function in RESEARCH.md uses `firm.name.toLowerCase().replace(/\s+/g, '-')`, which produces:
- `a16z.html` (registry key: `'a16z'`)
- `sequoia.html` (registry key: `'Sequoia'`)
- `benchmark.html` (registry key: `'Benchmark'`)
- `accel.html` (registry key: `'Accel'`)
- `general-catalyst.html` (registry key: `'General Catalyst'`)
- `coatue.html` (registry key: `'Coatue'`)
- `founders-fund.html` (registry key: `'Founders Fund'`)
- `khosla.html` (registry key: `'Khosla'`)
- **`index.html`** (registry key: `'Index'`) ← naming collision risk; RESEARCH.md recommends `index-ventures.html`
- `lightspeed.html` (registry key: `'Lightspeed'`)

The planner must decide whether to use `index.html` (matches `firm.name` transform) or `index-ventures.html` (clearer, matches RESEARCH.md recommendation). The test code that loads the fixture must use whatever name is chosen consistently.

**Benchmark fixture is a minimal stub:** `benchmark.mjs` never calls `page.goto()`, so no real HTML needs to be captured. A minimal stub `<html><body></body></html>` is sufficient. The test does not use the fixture file for benchmark (no route is registered).

---

### `scrapers/health.mjs` (modified — add `normalizeReason()`)

**Analog:** Same file (current state)

**Current exports** (`scrapers/health.mjs` lines 5-37):
```javascript
export function readHealth(path) { ... }
export async function writeHealth(path, firmUpdates) { ... }
```

**Current import block** (`scrapers/health.mjs` lines 1-3):
```javascript
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import writeFileAtomic from 'write-file-atomic';
```
No new imports are needed for `normalizeReason()` — it takes an `Error` object and returns a string.

**Where to insert `normalizeReason()`:** Add as a new named export before `readHealth()` (line 5). The function is pure — no file I/O, no external deps.

**The `reason` field write pattern** (`scrapers/health.mjs` lines 31-33):
```javascript
byName.set(upd.name, {
  ...
  ...(upd.reason ? { reason: upd.reason } : {}),
});
```
`writeHealth()` already conditionally writes `reason` — it accepts whatever string is passed in `upd.reason`. The `normalizeReason()` function normalizes the string before it reaches `writeHealth()`, not inside it. No changes to `writeHealth()` itself are needed.

---

### `scrape-vcs.mjs` (modified — 3 callsites)

**Analog:** Same file (current state)

**Import line to update** (`scrape-vcs.mjs` line 25):
```javascript
import { writeHealth } from './scrapers/health.mjs';
```
Change to:
```javascript
import { writeHealth, normalizeReason } from './scrapers/health.mjs';
```

**Callsite 1 — robots.txt disallow** (`scrape-vcs.mjs` line 84):
```javascript
healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots.txt disallow', count: 0 });
```
This is a boolean condition from `checkAllowed()`, not a thrown error. `normalizeReason()` is NOT used here. Change the string directly to `'robots_block'`.

**Callsite 2 — adapter returns 0 companies** (`scrape-vcs.mjs` line 115):
```javascript
healthUpdates.push({ name: firm.name, status: 'OK', count: discovered.length });
```
This pushes `OK` even when `discovered.length === 0`. Replace with a conditional: when `discovered.length === 0`, push `Error` with `reason: normalizeReason(null)` (returns `'selector_miss'`); otherwise push `OK` as before. This is behavior change BC-1.

**Callsite 3 — thrown error** (`scrape-vcs.mjs` line 118):
```javascript
healthUpdates.push({ name: firm.name, status: 'Error', reason: err.message, count: 0 });
```
Replace `err.message` with `normalizeReason(err)`. This is behavior change BC-2.

---

### `electron/src/renderer/components/ScraperHealthPanel.tsx` (modified — reason text)

**Analog:** Same file (current state)

**Current status cell** (`ScraperHealthPanel.tsx` lines 57-62):
```tsx
<td className="px-3 py-1">
  <span className="inline-flex items-center gap-2">
    <HealthStatusDot status={f.status} reason={f.reason} />
    <span>{f.status}</span>
  </span>
</td>
```

**Styling conventions from the same file** (`ScraperHealthPanel.tsx` lines 35, 37, 49):
- Text size: `text-label` (used for secondary text throughout this component)
- Red color: `ctp-red` (Catppuccin palette, consistent with `HealthStatusDot` COLORS)
- Spacing: `ml-1` (matches `gap-2` pattern in sibling spans)

**Change:** Add a conditional `<span>` after the existing `<span>{f.status}</span>` that renders `f.reason` text only for Error rows. Insert:
```tsx
{f.status === 'Error' && f.reason && (
  <span className="text-ctp-red ml-1 text-label">{f.reason}</span>
)}
```

**Type reference** — `VcFirmHealth` type (imported at `ScraperHealthPanel.tsx` line 4) already includes `reason?: string` (confirmed by `HealthStatusDot` accepting `reason?: string` at `HealthStatusDot.tsx` line 1). No type changes needed.

---

## Shared Patterns

### Playwright Browser Setup
**Source:** `scrape-vcs.mjs` lines 72-73
**Apply to:** `tests/adapters.test.mjs` (`before()` hook), `validate-adapters.mjs` (top-level)
```javascript
const browser = await chromium.launch({ headless: true });
// scrape-vcs.mjs adds userAgent — tests/validate-adapters.mjs can omit it
```

### YAML Config Loading
**Source:** `scrape-vcs.mjs` lines 47-57
**Apply to:** `validate-adapters.mjs` (load `config/vc-firms.yml`, filter enabled firms)
```javascript
const firmsDoc = yaml.load(readFileSync(CONFIG_PATH, 'utf-8'));
const firms = (firmsDoc?.firms ?? []).filter(f => f.enabled !== false && f.portfolio_url);
```

### CLI Flag Parsing
**Source:** `scrape-vcs.mjs` lines 37-40
**Apply to:** `validate-adapters.mjs` (`--capture`, `--firm`)
```javascript
const args = process.argv.slice(2);
const captureFlag = args.includes('--capture');
const firmFlagIdx = args.indexOf('--firm');
const firmFilter = firmFlagIdx !== -1 ? (args[firmFlagIdx + 1] ?? '').toLowerCase() : null;
```

### Atomic Write
**Source:** `scrapers/health.mjs` lines 1, 36
**Apply to:** `scrapers/health.mjs` is already the atomic write site; `validate-adapters.mjs` captures fixture HTML using `writeFileSync` (synchronous, sufficient for developer tool)
```javascript
import writeFileAtomic from 'write-file-atomic';
// ...
await writeFileAtomic(path, JSON.stringify(...));
```

### Test File Path Convention
**Source:** `tests/scan.test.mjs` lines 21-22
**Apply to:** `tests/adapters.test.mjs`
```javascript
const here = dirname(fileURLToPath(import.meta.url));
// Load fixture: readFileSync(join(here, 'fixtures', 'adapters', '{firm}.html'), 'utf-8')
```

### Catppuccin UI Color Tokens
**Source:** `ScraperHealthPanel.tsx` throughout; `HealthStatusDot.tsx` line 3
**Apply to:** New `<span>` in `ScraperHealthPanel.tsx` Error reason rendering
```typescript
// Error red: text-ctp-red
// Secondary text size: text-label
// Spacing: ml-1
```

---

## No Analog Found

All files have analogs. No novel patterns without codebase precedent.

---

## Implementation Notes for Planner

### BC-1: Empty-result behavior change (scrape-vcs.mjs line 115)
Current `{status: 'OK', count: 0}` becomes `{status: 'Error', reason: 'selector_miss', count: 0}`. The first run after this change may show more Error states than expected for sites that were previously silently returning 0 companies. This is intentional and correct per CONTEXT.md.

### BC-2/BC-3: Reason string change
`err.message` (raw stack traces) → canonical code. Downstream consumers of `data/vc-health.json` reading `reason` will see new values (`selector_miss`, `timeout`, `robots_block`, `network_error`).

### Fixture naming for 'Index' firm
Adapter registry key is `'Index'` (`adapters/index.mjs` line 41). The `firm.name.toLowerCase()` transform produces `index.html`. RESEARCH.md recommends `index-ventures.html` for clarity. Planner must pick one and use it consistently in both `tests/adapters.test.mjs` (fixture load) and `validate-adapters.mjs` (fixture save). Recommendation: use `index-ventures.html` and map it explicitly (hardcode the filename rather than deriving from `firm.name`).

### `validate-adapters.mjs` and `package.json`
Add `"validate:adapters": "node validate-adapters.mjs"` to the `scripts` block in `package.json`. Current scripts block is at lines 5-21.

### `npm test` picks up `adapters.test.mjs` automatically
`package.json` line 7: `"test": "node --test tests/*.test.mjs"`. The glob picks up any `*.test.mjs` file. No changes needed to `package.json` for the test file.

---

## Metadata

**Analog search scope:** `tests/`, `scrapers/`, `electron/src/renderer/components/`, root scripts
**Files read:** `tests/scan.test.mjs`, `scrape-vcs.mjs`, `scrapers/health.mjs`, `electron/src/renderer/components/ScraperHealthPanel.tsx`, `electron/src/renderer/components/HealthStatusDot.tsx`, `scrapers/adapters/a16z.mjs`, `scrapers/adapters/benchmark.mjs`, `scrapers/adapters/index.mjs`, `package.json`
**Pattern extraction date:** 2026-04-23
