# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- No Jest, Vitest, or native Go `*_test.go` suite is checked in.
- The repo uses script-based verification instead: `doctor.mjs`, `verify-pipeline.mjs`, `cv-sync-check.mjs`, `check-liveness.mjs`, and `test-all.mjs`.
- Config: Not applicable. No `jest.config.*`, `vitest.config.*`, or coverage config files are present.

**Assertion Library:**
- None. `test-all.mjs` uses hand-rolled assertion helpers (`pass`, `fail`, `warn`) and direct `if` conditions.
- Most verification scripts rely on exit codes plus human-readable stdout/stderr instead of framework matchers.

**Run Commands:**
```bash
npm run doctor             # Validate Node, dependencies, Playwright, and required files/directories
npm run verify             # Run `verify-pipeline.mjs`
node cv-sync-check.mjs     # Validate CV/profile consistency and prompt hygiene
node check-liveness.mjs <url1> [url2]  # Real-browser liveness verification with Playwright
node test-all.mjs          # Full custom smoke suite
node test-all.mjs --quick  # Same suite without the dashboard build step
cd dashboard && go build ./...  # Dashboard compile smoke test
```
- `package.json` does not define `npm test` or `npm run coverage`; use the explicit script names above.

## Test File Organization

**Location:**
- Verification code lives at the project root as executable `.mjs` files rather than co-located `*.test.*` files.
- The TUI dashboard under `dashboard/` has no `*_test.go`; quality signal there is a successful `go build`.
- Sample inputs live under `examples/` and are used as human or script fixtures rather than framework-managed fixture folders.

**Naming:**
- Integrity checks use descriptive executable names: `verify-pipeline.mjs`, `cv-sync-check.mjs`, `check-liveness.mjs`, `doctor.mjs`.
- The broad smoke harness is named `test-all.mjs`.
- Shared pure logic that can be exercised directly sits next to its executable wrapper, as with `liveness-core.mjs` and `check-liveness.mjs`.

**Structure:**
```text
/home/desachri/JobEngine/
├── doctor.mjs
├── verify-pipeline.mjs
├── cv-sync-check.mjs
├── check-liveness.mjs
├── liveness-core.mjs
├── test-all.mjs
├── examples/
│   ├── ats-normalization-test.md
│   ├── sample-report.md
│   └── cv-example.md
└── dashboard/            # build-only verification, no native test files
```

## Verification Scripts

**Repository and Setup Checks:**
- `doctor.mjs` validates prerequisites: Node version, `node_modules`, Playwright Chromium, `cv.md`, `config/profile.yml`, `portals.yml`, fonts, and core directories.
- `cv-sync-check.mjs` checks user setup quality: required profile fields, suspicious hardcoded metrics in `modes/_shared.md` and `batch/batch-prompt.md`, and stale `article-digest.md`.

**Pipeline and Data Checks:**
- `verify-pipeline.mjs` validates tracker integrity for `data/applications.md` or the fallback root `applications.md`.
- It checks canonical statuses, duplicate company-role pairs, report link existence, score format, pipe-delimited row format, pending `batch/tracker-additions/*.tsv`, and markdown bold leakage in scores.
- `merge-tracker.mjs` can run `verify-pipeline.mjs` after merges when invoked with `--verify`.

**Behavioral Checks:**
- `check-liveness.mjs` launches Playwright and uses `liveness-core.mjs` to classify active vs expired job pages.
- `test-all.mjs` acts as the umbrella smoke suite. It covers syntax checks, script execution, liveness classification, dashboard build, data-contract checks, privacy/path scans, mode integrity, `CLAUDE.md` integrity, and `VERSION` format.

## Test Structure

**Suite Organization:**
```javascript
let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

const scripts = [
  { name: 'verify-pipeline.mjs', expectExit: 0 },
  { name: 'update-system.mjs check', expectExit: 0 },
];

for (const { name, allowFail } of scripts) {
  const result = run(`node ${name} 2>&1`);
  if (result !== null) pass(`${name} runs OK`);
  else if (allowFail) warn(`${name} exited with error (expected without user data)`);
  else fail(`${name} crashed`);
}
```
This is the real pattern from `test-all.mjs`: numbered sections, local counters, and shell-command smoke checks instead of a test framework DSL.

**Patterns:**
- Organize checks by concern area and print a summary section at the end. `test-all.mjs` numbers sections `1` through `10`; `verify-pipeline.mjs` groups validations with comment headers and a final health summary.
- Use real files from the repo instead of synthetic temp directories where practical. `verify-pipeline.mjs`, `cv-sync-check.mjs`, and `doctor.mjs` all read the actual workspace.
- Allow empty-data setups to pass gracefully when that behavior is intentional. `verify-pipeline.mjs` exits `0` with a note when no applications tracker exists yet.

## Mocking

**Framework:** None.

**Patterns:**
```javascript
const { classifyLiveness } = await import(pathToFileURL(join(ROOT, 'liveness-core.mjs')).href);

const activeWorkdayPage = classifyLiveness({
  finalUrl: 'https://example.workday.com/job/123',
  bodyText: [
    '663 JOBS FOUND',
    'Senior AI Engineer',
    'Join our applied AI team to ship production systems...',
  ].join('\n'),
  applyControls: ['Apply for this Job'],
});
```
`test-all.mjs` uses inline literals as fixtures for pure logic instead of mocks, spies, or framework doubles.

**What to Mock:**
- Extract and test pure classifiers or parsers with inline object literals, following the `liveness-core.mjs` pattern.
- If adding new reusable logic, separate it from file I/O first so it can be imported directly into `test-all.mjs` or another lightweight harness.

**What NOT to Mock:**
- Do not replace Playwright with generic fetch for liveness verification. `CLAUDE.md`, `docs/CODEX.md`, and `check-liveness.mjs` all establish real-browser verification as the project rule.
- Existing integrity scripts intentionally read real workspace files like `data/applications.md`, `templates/states.yml`, and `modes/_shared.md`; future checks should keep validating the actual contract files.

## Fixtures and Factories

**Test Data:**
```javascript
const expiredChromeApply = classifyLiveness({
  finalUrl: 'https://example.com/jobs/closed-role',
  bodyText: 'Company Careers\nApply\nThe job you are looking for is no longer open.',
  applyControls: [],
});
```
- Inline object fixtures in `test-all.mjs` are the main unit-style pattern.
- Markdown fixture files exist for manual and regression-style verification:
  - `examples/ats-normalization-test.md` for ATS text normalization in `generate-pdf.mjs`
  - `examples/sample-report.md` for report shape reference
  - `examples/cv-example.md` and `examples/dual-track-engineer-instructor/cv.md` for CV structure examples

**Location:**
- Inline fixtures live inside `test-all.mjs`.
- Human-readable sample artifacts live under `examples/`.
- The user workspace itself is part of the verification surface for `doctor.mjs`, `verify-pipeline.mjs`, and `cv-sync-check.mjs`.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not applicable: the repo does not configure a coverage reporter.
```
- There is no `coverage` script in `package.json`, no Jest/Vitest config, and no `go test ./...` suite.
- Coverage is behavioral rather than line-based: repository invariants, CLI execution, file-contract validation, and build checks.
- Current signal from this workspace on 2026-04-11:
  - `npm run verify` exited `0`
  - `node doctor.mjs` exited `0`
  - `node test-all.mjs --quick` exited `1`
- `test-all.mjs --quick` is useful as a smoke harness, but its syntax-check section currently reported failures for every root `.mjs` file even though a direct `node --check analyze-patterns.mjs` succeeded in the same workspace. Treat it as supplemental until that discrepancy is resolved.

## Test Types

**Unit Tests:**
- Minimal and embedded. The clearest unit-style example is `liveness-core.mjs`, which is exercised in-process by `test-all.mjs` with inline inputs.
- New pure logic should follow that model: extract the logic into an importable module, then add direct assertions in `test-all.mjs` or a sibling script.

**Integration Tests:**
- This is the dominant style. `verify-pipeline.mjs`, `cv-sync-check.mjs`, `doctor.mjs`, `merge-tracker.mjs --verify`, and `scan.mjs` all validate behavior against real files, real CLI calls, and real environment prerequisites.
- The dashboard’s current integration gate is compilation via `go build`, not interactive TUI automation.

**E2E Tests:**
- No dedicated E2E framework is configured.
- `check-liveness.mjs` is the closest E2E check because it launches Chromium and verifies live page behavior with Playwright.
- PDF generation in `generate-pdf.mjs` is also exercised through the real browser runtime rather than a mock renderer.

## Common Patterns

**Async Testing:**
```javascript
try {
  const { classifyLiveness } = await import(pathToFileURL(join(ROOT, 'liveness-core.mjs')).href);
  const result = classifyLiveness({ finalUrl, bodyText, applyControls });
  if (result.result === 'active') pass('Visible apply controls still keep real job pages active');
} catch (e) {
  fail(`Liveness classification tests crashed: ${e.message}`);
}
```
- Async verification usually reuses production modules or CLIs directly instead of a separate harness library.

**Error Testing:**
```javascript
const result = run('node verify-pipeline.mjs 2>&1');
if (result !== null) {
  pass('verify-pipeline.mjs runs OK');
} else {
  fail('verify-pipeline.mjs crashed');
}
```
- Non-zero process exit is the main failure signal.
- Scripts often encode intentional warnings vs failures through exit code design. For example, `verify-pipeline.mjs` treats a missing tracker as a clean startup condition, while `check-liveness.mjs` exits `1` for any expired or uncertain URL.

---

*Testing analysis: 2026-04-11*
