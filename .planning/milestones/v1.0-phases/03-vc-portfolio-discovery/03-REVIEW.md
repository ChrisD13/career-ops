---
phase: 03-vc-portfolio-discovery
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 54
files_reviewed_list:
  - config/vc-firms.example.yml
  - config/vc-firms.yml
  - electron/package.json
  - electron/src/main/index.ts
  - electron/src/main/ipc-handlers.ts
  - electron/src/main/services/preferences.ts
  - electron/src/main/services/process-runner.ts
  - electron/src/main/services/promote.ts
  - electron/src/main/services/scheduler.ts
  - electron/src/main/services/url-probe.ts
  - electron/src/main/services/vc-companies.ts
  - electron/src/main/services/vc-firms.ts
  - electron/src/main/services/vc-health.ts
  - electron/src/main/watcher.ts
  - electron/src/preload/index.ts
  - electron/src/preload/types.ts
  - electron/src/renderer/App.tsx
  - electron/src/renderer/components/AddFirmButton.tsx
  - electron/src/renderer/components/AddFirmModal.tsx
  - electron/src/renderer/components/CompanyRow.tsx
  - electron/src/renderer/components/CompanyTable.tsx
  - electron/src/renderer/components/DiscoverFilterToggle.tsx
  - electron/src/renderer/components/DiscoverPanel.tsx
  - electron/src/renderer/components/FundingSignalBadge.tsx
  - electron/src/renderer/components/HealthStatusDot.tsx
  - electron/src/renderer/components/OpBadge.tsx
  - electron/src/renderer/components/RoleMatchBadge.tsx
  - electron/src/renderer/components/ScraperHealthPanel.tsx
  - electron/src/renderer/components/SettingsSlideOver.tsx
  - electron/src/renderer/components/Sidebar.tsx
  - electron/src/renderer/components/VcDropAlertBanner.tsx
  - electron/src/renderer/components/VcScraperSection.tsx
  - electron/src/renderer/hooks/useOperationsLog.ts
  - electron/src/renderer/styles/globals.css
  - electron/tailwind.config.js
  - package.json
  - scrape-vcs.mjs
  - scrapers/adapters/a16z.mjs
  - scrapers/adapters/accel.mjs
  - scrapers/adapters/benchmark.mjs
  - scrapers/adapters/coatue.mjs
  - scrapers/adapters/founders-fund.mjs
  - scrapers/adapters/general-catalyst.mjs
  - scrapers/adapters/index-ventures.mjs
  - scrapers/adapters/index.mjs
  - scrapers/adapters/khosla.mjs
  - scrapers/adapters/lightspeed.mjs
  - scrapers/adapters/sequoia.mjs
  - scrapers/funding-detector.mjs
  - scrapers/health.mjs
  - scrapers/robots.mjs
  - scrapers/role-matcher.mjs
  - scrapers/tsv-writer.mjs
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 54
**Status:** issues_found

## Summary

Phase 3 adds the VC Portfolio Discovery feature: a Playwright-based scraper (`scrape-vcs.mjs`) that crawls ten pre-configured VC firm portfolios, enriches discovered companies with funding signals (RSS/Google News) and ATS role-match probes, writes results to `data/vc-companies.tsv` and `data/vc-health.json`, and surfaces them in a new Electron Discover panel. The IPC layer is well-validated (Zod schemas on all incoming payloads, contextIsolation + sandbox enforced, file paths whitelisted). Atomic writes and a lockfile-based queue prevent data corruption.

Five warnings require attention before shipping:

1. The `scrapeActive` lock release is coupled to the global op count, not the specific scrape process — a concurrent scan/batch holds up the lock.
2. The SSRF guard in `url-probe.ts` omits the `172.16.0.0/12` RFC1918 range.
3. The TSV dedup key uses a space separator, enabling silent row collisions on firm/company names containing spaces.
4. The custom cron input in `VcScraperSection` uses `defaultValue`, so it goes stale when the controlled value changes.
5. Probe-failure detection in `AddFirmModal` uses fragile substring matching rather than the structured `probeStatus` field.

No critical (crash, auth bypass, data loss) issues found.

## Warnings

### WR-01: `scrapeActive` lock stuck when other operations are running concurrently

**File:** `electron/src/main/services/scheduler.ts:44-50`
**Issue:** The polling loop releases `scrapeActive` only when `activeOpsCount() === 0`. `activeOpsCount()` counts all op kinds (`scan`, `batch`, `pdf`, `scrape`). If a long-running `scan` or `batch` is in flight at the time the scrape subprocess finishes, the scrape lock stays set until all unrelated ops also finish — blocking any subsequent manual or scheduled scrape for up to 60 minutes (until the safety timer fires). The 60-minute backstop prevents permanent stuckness, but a user who triggers a scan right after a scrape will see "Scan already in progress" until the safety timer expires or all other ops complete.

**Fix:** Track per-runId process exit via the existing `op:done` IPC event rather than polling global op count. The `pendingReleases` map already holds the release function keyed by `runId`; wire it to the process-runner's `exit` event:

```typescript
// In triggerScrape, after startOp:
const release = (): void => { scrapeActive = false }
const safetyTimer = setTimeout(release, 60 * 60 * 1000)

// Listen for the specific runId's done event instead of polling global count
win.webContents.once('ipc-message', (_e, ch, payload) => {
  if (ch === 'op:done' && payload?.runId === runId) {
    clearTimeout(safetyTimer)
    release()
  }
})
```

Alternatively, expose a per-runId exit callback from `process-runner.ts` and call it from the `child.on('exit')` handler directly (cleaner than IPC round-trip).

---

### WR-02: SSRF guard misses the `172.16.0.0/12` private range

**File:** `electron/src/main/services/url-probe.ts:4`
**Issue:** `PRIVATE_HOST_RE` covers `10.x`, `192.168.x`, `169.254.x` (link-local), and loopback, but omits `172.16.x` through `172.31.x` — a standard RFC1918 block. A crafted portfolio URL pointing at `172.20.0.1` would pass the guard and trigger a live HEAD request from the main process. The threat model is reduced for a desktop app (no server exposure), but the guard is explicitly documented as preventing SSRF and the gap contradicts that claim.

**Fix:**
```typescript
const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i
```

---

### WR-03: TSV dedup key collision on firm/company names containing spaces

**File:** `scrapers/tsv-writer.mjs:36`
**Issue:** `mergeCompanies` builds the dedup key as `` `${row.firm} ${row.company}` `` (space-separated). A firm named `"A B"` with company `"C"` produces the same key as firm `"A"` with company `"B C"`. On collision the later entry silently overwrites the earlier one, which can flip the `promoted` flag from `true` to `false` for a legitimate entry or suppress a real company from the results.

**Fix:** Use a separator that cannot appear in either field. Since the TSV format already strips tabs from values (line 28), a tab separator is safe:
```javascript
const key = `${row.firm}\t${row.company}`
```

---

### WR-04: Stale `defaultValue` on custom cron input

**File:** `electron/src/renderer/components/VcScraperSection.tsx:67`
**Issue:** The custom cron expression `<input>` uses `defaultValue={interval}`, which React only reads at mount time. When the component mounts with a preset value and the user later selects "Custom" from the dropdown, the input renders with the initially-mounted `interval` string (the default `'0 9 1 * *'`) rather than the current `interval` state. If the user saved a custom expression previously, they will see the wrong starting value.

**Fix:** Use a controlled input with `value` and `onChange`, or add a `key` prop that changes when the custom-mode activates to force a remount:

```tsx
<input
  type="text"
  key={`custom-cron-${interval}`}
  defaultValue={interval}
  onBlur={(e) => void save(e.currentTarget.value)}
  ...
/>
```

The `key` approach preserves the uncontrolled pattern while ensuring the displayed value is always correct when the input first appears.

---

### WR-05: Probe-failure detection relies on fragile substring match

**File:** `electron/src/renderer/components/AddFirmModal.tsx:42-44`
**Issue:** `doSubmit` determines whether a failure is a probe failure (should show "Save anyway") vs. a save error (no bypass option) by checking `typeof result.probeStatus !== 'undefined'` OR `result.error?.toLowerCase().includes('probe')` OR `result.error?.toLowerCase().includes('url')`. The fallback substring checks on `error` text are fragile: any save error that incidentally mentions a URL (e.g., "Firm 'MyURL Corp' already exists") would be misclassified as a probe failure, incorrectly presenting the "Save anyway" bypass option.

**Fix:** The IPC response already includes `probeStatus` as the canonical signal. Rely solely on its presence:

```typescript
if (typeof result.probeStatus !== 'undefined') {
  setSubmit({ kind: 'probe-failed', error: result.error ?? 'URL verification failed', probeStatus: result.probeStatus })
} else {
  setSubmit({ kind: 'save-error', error: result.error ?? 'Failed to save' })
}
```

If the backend can fail a probe without sending `probeStatus`, add `kind: 'probe' | 'save'` to the `AddFirmResult` type for explicit discrimination.

---

## Info

### IN-01: `scrape-vcs.mjs` crashes on YAML entries without a `name` field when `--firm` filter is used

**File:** `scrape-vcs.mjs:51`
**Issue:** The `--firm` filter path calls `f.name.toLowerCase()` on each firm entry without guarding against undefined/null `name`. The normal (non-filter) path (`f.enabled !== false && f.portfolio_url`) avoids this because malformed entries are skipped by the portfolio_url check, and `listFirms` in the Electron service filters empty names. But the `--firm` path iterates the raw YAML array and will throw `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` if any entry lacks a `name` field.

**Fix:**
```javascript
firms = (firmsDoc?.firms ?? []).filter(f => f.name && f.name.toLowerCase().includes(firmFilter));
```

---

### IN-02: Hardcoded default cron expression duplicates `DEFAULT_VC_INTERVAL`

**File:** `electron/src/renderer/components/VcScraperSection.tsx:10`
**Issue:** The component initializes `interval` state with the hardcoded string `'0 9 1 * *'`. The canonical default is `DEFAULT_VC_INTERVAL` in `electron/src/main/services/preferences.ts:8`. If the default ever changes in preferences, the renderer's initial display will be wrong for the brief moment before `getVcScrapeInterval` resolves.

**Fix:** The `useEffect` fetch on mount will set the correct value quickly; the risk is low. Still, exposing `DEFAULT_VC_INTERVAL` through a shared constants file (or through the `getVcScrapeInterval` IPC response) would eliminate the duplication.

---

### IN-03: Loop-index mutation inside catch callback is fragile

**File:** `scrapers/adapters/accel.mjs:9`, `scrapers/adapters/coatue.mjs:8`
**Issue:** Both adapters break out of their "Load More" loop by mutating the loop index inside a `catch` callback: `await btn.click().catch(() => { i = 20; })`. This works but is non-idiomatic and relies on closure capture of a `let` variable that happens to be the loop counter. If the loop bound ever changes, the break condition must be updated in two places. A named-flag or `break`-with-try/catch pattern is easier to maintain.

**Fix:**
```javascript
let loadMoreFailed = false
for (let i = 0; i < 20 && !loadMoreFailed; i++) {
  const btn = page.locator('button:has-text("Load More"), button:has-text("Load more")').first()
  if (!(await btn.isVisible().catch(() => false))) break
  await btn.click().catch(() => { loadMoreFailed = true })
  if (!loadMoreFailed) await page.waitForTimeout(1000)
}
```

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
