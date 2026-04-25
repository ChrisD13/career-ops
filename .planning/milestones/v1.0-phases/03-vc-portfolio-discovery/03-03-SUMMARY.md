---
phase: 03
plan: 03
subsystem: electron-renderer
tags: [vc-discovery, react, ui, virtualization, electron]
dependency_graph:
  requires: [03-02]
  provides: [discover-panel, add-firm-modal, vc-scraper-settings, sidebar-discover-entry]
  affects: [electron/src/renderer/App.tsx, electron/src/renderer/components/Sidebar.tsx, electron/src/renderer/components/SettingsSlideOver.tsx]
tech_stack:
  added: [ctp-teal color token]
  patterns: [FixedSizeList virtualization, React hooks rules compliance, probe-then-override modal flow]
key_files:
  created:
    - electron/src/renderer/components/FundingSignalBadge.tsx
    - electron/src/renderer/components/RoleMatchBadge.tsx
    - electron/src/renderer/components/HealthStatusDot.tsx
    - electron/src/renderer/components/VcDropAlertBanner.tsx
    - electron/src/renderer/components/DiscoverFilterToggle.tsx
    - electron/src/renderer/components/ScraperHealthPanel.tsx
    - electron/src/renderer/components/CompanyRow.tsx
    - electron/src/renderer/components/CompanyTable.tsx
    - electron/src/renderer/components/DiscoverPanel.tsx
    - electron/src/renderer/components/AddFirmButton.tsx
    - electron/src/renderer/components/AddFirmModal.tsx
    - electron/src/renderer/components/VcScraperSection.tsx
  modified:
    - electron/src/renderer/components/OpBadge.tsx
    - electron/src/renderer/styles/globals.css
    - electron/tailwind.config.js
    - electron/src/renderer/components/SettingsSlideOver.tsx
    - electron/src/renderer/components/Sidebar.tsx
    - electron/src/renderer/App.tsx
    - electron/src/preload/types.ts
decisions:
  - "Used ctp-teal for op-badge--scrape (not mauve) to distinguish from batch which already uses mauve"
  - "Moved matchedCount useMemo before early returns in DiscoverPanel to comply with React Rules of Hooks"
  - "Created AddFirmButton stub in Task 2 commit to unblock TypeScript compilation before Task 3 full implementation"
  - "Fixed runVcScrape return type in types.ts to include optional error field matching IPC handler behavior"
metrics:
  duration: "~75 minutes"
  completed: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 12
  files_modified: 7
---

# Phase 3 Plan 3: Discover Panel UI — End-to-End VC Portfolio Discovery Surface Summary

**One-liner:** Virtualized 5-column Discover panel with VC drop-alert banner, scraper health accordion, Add Firm modal with HEAD-probe + bypass flow, and Settings cron scheduler section — wired to Plan 02's IPC surface.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Primitives + hook + OpBadge extension | aca84e0 | FundingSignalBadge, RoleMatchBadge, HealthStatusDot, VcDropAlertBanner, DiscoverFilterToggle, ScraperHealthPanel, OpBadge, globals.css, tailwind.config.js |
| 2 | CompanyRow + CompanyTable + DiscoverPanel | 2b924d4 | CompanyRow, CompanyTable, DiscoverPanel, AddFirmButton (stub) |
| 3 | Add Firm modal + Settings VC section + Sidebar + App wiring | fb4df3a | AddFirmButton (full), AddFirmModal, VcScraperSection, SettingsSlideOver, Sidebar, App.tsx, types.ts |

## Components Built

### Primitive Leaf Components (Task 1)

- **FundingSignalBadge**: Green pill showing 'Blog' / 'Press' / 'Signal' with date tooltip; grey dash when empty
- **RoleMatchBadge**: Sky pill showing match count with keyword tooltip; grey dash when empty
- **HealthStatusDot**: 8px colored dot — green OK, yellow Stale, red Error — with reason tooltip
- **VcDropAlertBanner**: 40px dismissible banner; computes worst-drop internally; yellow at 20-40% drop, red at >40% drop (D-11)
- **DiscoverFilterToggle**: Two-segment radio-group toggle — Matched (default per D-07) / All — with live counts
- **ScraperHealthPanel**: Accordion collapsed by default (D-10); per-firm table with status dot, last run, company count vs baseline

### Table Components (Task 2)

- **CompanyRow**: ListChildComponentProps row with 5 cells; Promote button has 3 states: idle ('Promote' + Send icon), in-flight ('Promoting…' + Loader2 spin), done ('Promoted ✓' + Check); company name links to careers_url with noopener noreferrer
- **CompanyTable**: FixedSizeList virtualization, 36px row height, 36px sticky header, ResizeObserver for dynamic height, 5 columnheaders matching UI-SPEC widths (Company 280px, Firm 140px, Funding Signal 160px, Role Match 140px, Actions flex)
- **DiscoverPanel**: Orchestrates full panel — loads readVcCompanies + readVcHealth, subscribes to onFilesChanged, manages filter state (default 'matched'), manages promotingKeys Set, renders VcDropAlertBanner + ScraperHealthPanel + CompanyTable + empty states

### Modal + Settings + Wiring (Task 3)

- **AddFirmButton**: Thin stateful wrapper owning modal open/close; renders Plus button + conditional AddFirmModal
- **AddFirmModal**: 480px centered dialog; 3 fields (name required, portfolio_url required, keywords optional comma-separated); Escape handler; backdrop-click dismiss with e.target === e.currentTarget guard; probe-failed state shows yellow warning + 'Save anyway' button that retries with bypassProbe=true; auto-focuses name field on mount
- **VcScraperSection**: Settings section with 3 preset schedule options + Custom cron input (shown when custom selected); onBlur save; 'Run scan now' button; Saving… / Saved / error feedback
- **SettingsSlideOver**: VcScraperSection appended after ModelSelect
- **Sidebar**: Compass icon added to imports; PanelId union widened to include 'discover'; Discover added as 6th ITEMS entry
- **App.tsx**: DiscoverPanel imported; scrapeActive useMemo added; handleRunScrape callback added; case 'discover' branch added to renderPanel switch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React Rules of Hooks violation in DiscoverPanel**
- **Found during:** Task 2 implementation
- **Issue:** Plan's code sample called `useMemo` for `matchedCount` after early-return guards (`if (state.kind === 'loading')`, `if (state.kind === 'error')`), violating React's Rules of Hooks
- **Fix:** Moved all derived value computations (`rows`, `firms`, `matchedCount`, `filtered`) unconditionally before the early returns
- **Files modified:** `electron/src/renderer/components/DiscoverPanel.tsx`
- **Commit:** 2b924d4

**2. [Rule 1 - Bug] Fixed runVcScrape return type missing optional error field**
- **Found during:** Task 3 TypeScript compile check
- **Issue:** `types.ts` declared `runVcScrape: () => Promise<{ runId: string }>` but IPC handler returns `{ runId: string; error?: string }` (matching runBatch pattern). App.tsx and VcScraperSection both access `.error`
- **Fix:** Updated `ElectronAPI.runVcScrape` return type to `Promise<{ runId: string; error?: string }>`
- **Files modified:** `electron/src/preload/types.ts`
- **Commit:** fb4df3a

**3. [Rule 3 - Blocking] CSS target was globals.css not index.css**
- **Found during:** Task 1 Step 9
- **Issue:** Plan frontmatter lists `electron/src/renderer/index.css` as a file to modify, but op-badge rules live in `electron/src/renderer/styles/globals.css`
- **Fix:** Added `op-badge--scrape` rule to `styles/globals.css`; grep check `grep -rq "op-badge--scrape" src/renderer/` passes regardless
- **Files modified:** `electron/src/renderer/styles/globals.css`
- **Commit:** aca84e0

**4. [Rule 1 - Bug] op-badge--scrape color changed from mauve to teal**
- **Found during:** Task 1 Step 9
- **Issue:** Plan suggested ctp-mauve but batch already uses mauve — visual collision
- **Fix:** Used ctp-teal (Catppuccin Mocha #94e2d5) for scrape badge. Added --ctp-teal CSS variable and tailwind color token
- **Files modified:** `electron/src/renderer/styles/globals.css`, `electron/tailwind.config.js`
- **Commit:** aca84e0

**5. [Rule 3 - Blocking] node-cron not installed in electron node_modules**
- **Found during:** Task 3 npm run build
- **Issue:** Plan 02 added node-cron to package.json but `npm install` was not run; build failed with "failed to resolve import node-cron from scheduler.ts"
- **Fix:** Ran `npm install --legacy-peer-deps node-cron` in the main repo's electron directory (worktree symlinks to it)
- **Commit:** fb4df3a (documented in commit message)

**6. [Rule 1 - Bug] OpBadge label was 'Scrape' not 'VC Scrape'**
- **Found during:** Task 1 verification — Plan 02 had already widened the kind union but set label to 'Scrape'
- **Fix:** Updated LABELS map from `scrape: 'Scrape'` to `scrape: 'VC Scrape'`
- **Files modified:** `electron/src/renderer/components/OpBadge.tsx`
- **Commit:** aca84e0

### Structural Note

Plan 02 had already widened the `OpRun.kind` union in `useOperationsLog.ts` and `OpBadge.tsx` to include 'scrape' before this plan started. Task 1 Steps 7 and 8 in this plan were therefore already satisfied — only the label correction was needed.

## Threat Surface Scan

All scraped company names, firm names, funding_signal, and role_matches are rendered as React text children (never `dangerouslySetInnerHTML`). External links in CompanyRow use `target="_blank" rel="noopener noreferrer"`. No new network endpoints or auth paths introduced. Threat model items T-03-18 through T-03-24 are mitigated as designed.

## Known Stubs

None. All data sources are wired to live IPC calls:
- `readVcCompanies()` → populated from TSV written by scraper CLI (Plan 01)
- `readVcHealth()` → populated from health.json written by scraper CLI (Plan 01)
- `promoteToPipeline()` → appends to data/pipeline.md (Plan 02)
- `addVcFirm()` → validates and writes to firms.yml (Plan 02)

## Self-Check

### Files Exist
- electron/src/renderer/components/FundingSignalBadge.tsx: FOUND
- electron/src/renderer/components/RoleMatchBadge.tsx: FOUND
- electron/src/renderer/components/HealthStatusDot.tsx: FOUND
- electron/src/renderer/components/VcDropAlertBanner.tsx: FOUND
- electron/src/renderer/components/DiscoverFilterToggle.tsx: FOUND
- electron/src/renderer/components/ScraperHealthPanel.tsx: FOUND
- electron/src/renderer/components/CompanyRow.tsx: FOUND
- electron/src/renderer/components/CompanyTable.tsx: FOUND
- electron/src/renderer/components/DiscoverPanel.tsx: FOUND
- electron/src/renderer/components/AddFirmButton.tsx: FOUND
- electron/src/renderer/components/AddFirmModal.tsx: FOUND
- electron/src/renderer/components/VcScraperSection.tsx: FOUND

### Commits Exist
- aca84e0: Task 1 primitives
- 2b924d4: Task 2 table + panel
- fb4df3a: Task 3 modal + wiring

### TypeScript + Build
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS (renderer bundle 900KB, main 554KB)

## Self-Check: PASSED
