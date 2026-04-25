---
phase: 03-vc-portfolio-discovery
fixed_at: 2026-04-23T00:00:00Z
review_path: .planning/phases/03-vc-portfolio-discovery/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-23
**Source review:** .planning/phases/03-vc-portfolio-discovery/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `scrapeActive` lock stuck when other operations are running concurrently

**Files modified:** `electron/src/main/services/process-runner.ts`, `electron/src/main/services/scheduler.ts`
**Commit:** ed8dd00
**Applied fix:** Added optional `onExit` callback to `StartOpOpts` in `process-runner.ts`, wired to both `child.on('exit')` and `child.on('error')` handlers. Rewrote `scheduler.ts` to pass `onExit` directly to `startOp` — the callback clears the safety timer and sets `scrapeActive = false` when the specific scrape process exits. Removed the `pendingReleases` map, the `setInterval` polling loop, and the `activeOpsCount` import entirely. `stopScheduler` also simplified accordingly.

Note: The REVIEW's primary fix suggestion (using `win.webContents.once('ipc-message', ...)`) was not applied — that event fires for renderer-to-main messages, not main-to-renderer. The REVIEW's alternative approach (per-runId exit callback from process-runner) was used instead.

**Status:** fixed: requires human verification

### WR-02: SSRF guard misses the `172.16.0.0/12` private range

**Files modified:** `electron/src/main/services/url-probe.ts`
**Commit:** d9bbe5a
**Applied fix:** Added `172\.(1[6-9]|2[0-9]|3[01])\.` to `PRIVATE_HOST_RE` regex, covering the full 172.16.0.0–172.31.255.255 RFC1918 block.

### WR-03: TSV dedup key collision on firm/company names containing spaces

**Files modified:** `scrapers/tsv-writer.mjs`
**Commit:** a2b8229
**Applied fix:** Changed dedup key separator from space to tab in both the `existing` loop and the `fresh` loop in `mergeCompanies`. Tab is safe since `writeCompaniesTsv` already strips tabs from field values on write.

### WR-04: Stale `defaultValue` on custom cron input

**Files modified:** `electron/src/renderer/components/VcScraperSection.tsx`
**Commit:** a890fc9
**Applied fix:** Added `key={`custom-cron-${interval}`}` to the custom cron `<input>`. React will remount the input whenever `interval` changes, ensuring `defaultValue` always reflects the current saved value when custom mode activates.

### WR-05: Probe-failure detection relies on fragile substring match

**Files modified:** `electron/src/preload/types.ts`, `electron/src/main/ipc-handlers.ts`, `electron/src/renderer/components/AddFirmModal.tsx`
**Commit:** e0db080
**Applied fix:** Added `kind?: 'probe' | 'save'` discriminator to `AddFirmResult` interface in `types.ts`. In `ipc-handlers.ts`, the probe failure path now returns `kind: 'probe'` and the save error path returns `kind: 'save'`. In `AddFirmModal.tsx`, `doSubmit` now checks `result.kind === 'probe'` instead of the fragile substring match on error text. This eliminates false classification of save errors that incidentally mention URLs in their message.

Note: The strict-only approach (`typeof result.probeStatus !== 'undefined'`) was not used because `probeStatus` is undefined for probe failures from invalid URL, scheme error, private host, timeout, and network error paths — those would have lost the "Save anyway" option.

**Status:** fixed: requires human verification

---

_Fixed: 2026-04-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
