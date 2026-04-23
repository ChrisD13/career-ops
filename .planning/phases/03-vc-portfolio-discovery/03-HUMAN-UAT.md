---
status: partial
phase: 03-vc-portfolio-discovery
source: [03-VERIFICATION.md]
started: 2026-04-23T00:00:00Z
updated: 2026-04-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Discover Panel Renders
expected: Launch Electron, click 'Discover' (6th sidebar, Compass icon). Panel renders with filter toggle, collapsed health accordion, no console errors.
result: [pending]

### 2. Run Scan Streams to Ops Drawer
expected: Click 'Run scan now' in Discover panel. OperationsLogDrawer shows live scraper output with teal 'VC Scrape' op badge.
result: [pending]

### 3. Promote End-to-End
expected: Click 'Promote' on a company row. 'Promoting…' → 'Promoted ✓'; data/pipeline.md gains the careers URL; TSV row has promoted=true.
result: [pending]

### 4. Add Firm Happy Path
expected: Add a firm with a reachable URL. Modal closes, firm persists to config/vc-firms.yml.
result: [pending]

### 5. Add Firm Failed Probe + Save Anyway
expected: Add a firm with an unreachable URL. Yellow probe-error banner appears; 'Save anyway' retries with bypassProbe=true and saves.
result: [pending]

### 6. Settings VC Scraper Section
expected: Open Settings. VC Scraper section visible after ModelSelect with schedule selector and 'Run scan now' button.
result: [pending]

### 7. Drop Alert Banner
expected: Create data/vc-health.json with company_count < 80% of baseline_count. Yellow/red banner appears above Discover table.
result: [pending]

### 8. Real Scrape (Single Firm)
expected: Run npm install at project root, then node scrape-vcs.mjs --firm a16z. data/vc-companies.tsv and data/vc-health.json populated.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
