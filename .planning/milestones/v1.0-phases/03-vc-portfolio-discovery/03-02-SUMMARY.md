---
phase: 03
plan: 02
subsystem: electron-main
tags: [ipc, node-cron, scheduler, vc-discovery, electron-main, services]
dependency_graph:
  requires: [03-01]
  provides: [03-03]
  affects: [electron/src/main, electron/src/preload]
tech_stack:
  added: [node-cron@4.2.1, @types/node-cron@3.0.11]
  patterns: [lockAndWrite-atomic-write, zod-ipc-validation, single-flight-lock, cron-scheduler, SSRF-guard, HEAD-probe]
key_files:
  created:
    - electron/src/main/services/url-probe.ts
    - electron/src/main/services/vc-companies.ts
    - electron/src/main/services/vc-health.ts
    - electron/src/main/services/vc-firms.ts
    - electron/src/main/services/promote.ts
    - electron/src/main/services/scheduler.ts
  modified:
    - electron/package.json
    - electron/src/main/services/preferences.ts
    - electron/src/main/services/process-runner.ts
    - electron/src/main/watcher.ts
    - electron/src/preload/types.ts
    - electron/src/preload/index.ts
    - electron/src/main/ipc-handlers.ts
    - electron/src/main/index.ts
    - electron/src/renderer/components/OpBadge.tsx
    - electron/src/renderer/hooks/useOperationsLog.ts
decisions:
  - "node-cron 4.2.1 TaskOptions does not include 'scheduled' property — removed from cron.schedule() calls (task starts by default). @types/node-cron is for v2/v3 and conflicts with package's own types; package's ESM types are used by TypeScript."
  - "Scheduler release mechanism uses setInterval polling activeOpsCount() every 2s + 60-minute safety timer. pollInterval handle captured and cleared in stopScheduler() to enable clean shutdown."
  - "Cron expression stored directly in preferences.json (not string alias 'weekly'/'monthly'/'manual-only'). DEFAULT_VC_INTERVAL = '0 9 1 * *' (monthly, 1st at 09:00)."
metrics:
  duration_minutes: 14
  completed_date: "2026-04-23"
  tasks_completed: 3
  files_changed: 14
---

# Phase 3 Plan 02: Electron Main-Process Surface for VC Discovery — Summary

Electron main-process wiring for Plan 01's `scrape-vcs.mjs` CLI: 8 new IPC channels with zod validation, 6 new main-process services, extended preload bridge and types, node-cron scheduler integrated into app lifecycle, and file watcher extended to cover new VC data files.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend preload types + bridge + process-runner + preferences + watcher | a0968d1 | package.json, types.ts, index.ts (preload), preferences.ts, process-runner.ts, watcher.ts, OpBadge.tsx, useOperationsLog.ts |
| 2 | Write 6 main-process services | 32f7e0b | scheduler.ts, vc-firms.ts, vc-companies.ts, vc-health.ts, promote.ts, url-probe.ts |
| 3 | Wire 8 IPC handlers + bootstrap scheduler | c45314c | ipc-handlers.ts, index.ts (main) |

## What Was Built

### IPC Contract (8 new channels)

| Channel | Handler Location | Validation |
|---------|-----------------|------------|
| `runVcScrape` | ipc-handlers.ts | none (no payload) |
| `readVcCompanies` | ipc-handlers.ts | none (no payload) |
| `readVcHealth` | ipc-handlers.ts | none (no payload) |
| `promoteToPipeline` | ipc-handlers.ts | PromoteSchema (firm, company, careersUrl) |
| `listVcFirms` | ipc-handlers.ts | none (no payload) |
| `addVcFirm` | ipc-handlers.ts | VcFirmSchema (name regex, url, keywords, bypassProbe) |
| `getVcScrapeInterval` | ipc-handlers.ts | none (no payload) |
| `setVcScrapeInterval` | ipc-handlers.ts | CronSchema + cron.validate in preferences |

### Services Created

- **url-probe.ts**: HEAD probe with SSRF guard (PRIVATE_HOST_RE for private IPs/loopback, http/https-only scheme check, `AbortSignal.timeout(5000)`)
- **vc-companies.ts**: TSV parser (8-column contract matching Plan 01 scraper output); atomic `markPromoted` via `lockAndWrite`
- **vc-health.ts**: JSON parser for `data/vc-health.json` with graceful fallback on malformed data
- **vc-firms.ts**: YAML CRUD for `config/vc-firms.yml`; `addFirm` uses `lockAndWrite` with case-insensitive duplicate-name guard
- **promote.ts**: Appends careers URL to `data/pipeline.md` via `lockAndWrite` with URL dedup; calls `markPromoted` after successful write
- **scheduler.ts**: node-cron 4.x monthly scheduler with single-flight `scrapeActive` flag; polling-based release (activeOpsCount check every 2s) + 60-minute safety timer backstop; `pollInterval` handle captured for clean shutdown

### Scheduler Lifecycle

- `initScheduler(projectRoot, win)` called in `app.whenReady` after watcher setup
- `stopScheduler()` called in both `mainWindow.on('closed')` and `app.on('before-quit')`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended kind union in OpBadge.tsx and useOperationsLog.ts**
- **Found during:** Task 1 — typecheck after adding 'scrape' to OpOutputPayload/OpDonePayload kind union
- **Issue:** `OpBadge.tsx` had hardcoded `kind: 'scan' | 'batch' | 'pdf'` prop type; `OpRun` in `useOperationsLog.ts` had same literal union; both rejected kind='scrape' from the now-extended payloads
- **Fix:** Extended both to `'scan' | 'batch' | 'pdf' | 'scrape'`; added `'Scrape'` label to OpBadge LABELS map
- **Files modified:** `electron/src/renderer/components/OpBadge.tsx`, `electron/src/renderer/hooks/useOperationsLog.ts`
- **Commit:** a0968d1

**2. [Rule 1 - Bug] Removed unsupported `scheduled` option from node-cron 4.x `cron.schedule()` calls**
- **Found during:** Task 2 — typecheck after creating scheduler.ts
- **Issue:** node-cron 4.2.1's own `TaskOptions` type does not include `scheduled` property (that's a v2/v3 option). The `@types/node-cron` package targets v2/v3 and conflicts with the package's bundled ESM types. TypeScript resolved to the package's own types and rejected `{ scheduled: true }`.
- **Fix:** Removed `{ scheduled: true }` option — `cron.schedule()` starts the task automatically by default in v4
- **Files modified:** `electron/src/main/services/scheduler.ts`
- **Commit:** 32f7e0b

**3. [Rule 2 - Enhancement] Captured setInterval handle in scheduler.ts for clean shutdown**
- **Found during:** Task 2 — reviewing scheduler implementation
- **Issue:** Plan's `setInterval(...).unref()` pattern didn't capture the handle, so `stopScheduler()` couldn't cancel the polling loop
- **Fix:** Captured handle in `pollInterval` module variable; `stopScheduler()` calls `clearInterval(pollInterval)` and nulls the reference
- **Files modified:** `electron/src/main/services/scheduler.ts`
- **Commit:** 32f7e0b

## Known Stubs

None. This plan delivers pure main-process infrastructure — no UI components and no data-dependent rendering. The 8 IPC handlers return real data from the filesystem (or empty defaults if files don't exist yet).

## Threat Surface Scan

All threat mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-03-09 (SSRF via url-probe) | PRIVATE_HOST_RE + scheme check + AbortSignal.timeout(5000) |
| T-03-10 (TSV/pipeline tampering) | lockAndWrite throughout vc-companies.ts + promote.ts |
| T-03-11 (YAML rewrite tampering) | lockAndWrite + duplicate-name guard in vc-firms.ts |
| T-03-12 (IPC payload injection) | VcFirmSchema with name regex + length bounds |
| T-03-13 (cron DoS) | CronSchema length bounds + cron.validate in preferences.setVcScrapeInterval |
| T-03-14 (scrapeActive stickiness) | Polling + 60-min safety timer; handle captured for clean clearInterval |
| T-03-16 (IPC spoofing) | All 3 mutating handlers use .parse() with strict schemas |
| T-03-17 (pipeline.md append) | lockAndWrite + URL dedup in promote.ts |

No new threat surface found beyond what the plan's threat model already covers.

## Self-Check: PASSED
