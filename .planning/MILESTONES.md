# Milestones

## v1.0 — JobEngine v2 MVP (Shipped 2026-04-23)

**Phases:** 1–3 | **Plans:** 14 | **Duration:** 19 days (2026-04-04 → 2026-04-23)

**Delivered:** Secure Electron desktop app with VC portfolio discovery, streaming Claude evaluation, prompt caching, write safety, and full pipeline management — replacing the CLI workflow while preserving all existing file-backed artifacts.

**Key accomplishments:**
1. Secure Electron shell — contextIsolation, sandbox, CSP, 5 read-only IPC channels, react-window virtualization for 740+ tracker rows (Phase 1)
2. Concurrent-write safety — proper-lockfile + write-file-atomic + pendingGuiWrites suppression; 104-write stress test PASS (Phase 2)
3. Streaming Anthropic integration — messages.stream, cache_control prompt caching, mtime context dedup, safeStorage API key (Phase 2)
4. VC portfolio scraper CLI — scrape-vcs.mjs + 10 Playwright adapters + robots.txt compliance + funding/role-match heuristics (Phase 3)
5. Electron main-process VC surface — 8 IPC channels, node-cron scheduler, 6 services, per-runId lock release (Phase 3)
6. Discover panel — virtualized CompanyTable, ScraperHealthPanel, AddFirmModal with HEAD-probe, VcDropAlertBanner (Phase 3)

**Code stats:** 342 files changed, +46,149 / -889 lines

**Known deferred items at close:** 2 (Phase 3 UAT partial: 8 items; Phase 3 verification: human_needed) — see STATE.md Deferred Items

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---

## v1.1 — Live Validation + Analytics (Shipped 2026-04-24)

**Phases:** 4–6 | **Plans:** 9 | **Duration:** 20 days (2026-04-04 → 2026-04-24)

**Delivered:** VC adapter offline regression harness (34/34 tests), Electron auto-update via GitHub Releases, and response-rate analytics dashboard — all autonomous, end-to-end.

**Key accomplishments:**
1. VC adapter validation — `normalizeReason()` canonical error codes, `validate-adapters.mjs`, 10 HTML fixture captures, Playwright regression harness (Phase 4)
2. Electron auto-update — `electron-updater` wired to GitHub Releases, `UpdateBanner` with per-version dismiss via `dismissed-update.json` (Phase 5)
3. Response-rate analytics — `computeAnalytics()` pure aggregation (4 pitfall guards), CSS-only Catppuccin bar chart + funnel table (Phase 6)
4. `AnalyticsPanel` with `isRefresh`-flagged auto-refresh on file change (Phase 6)

**Code stats:** 77 files changed, ~99K insertions (incl. fixture HTML)

**Known deferred items at close:** 6 carried from v1.0 + Phase 4 UAT (1 item) + Phase 5 UAT (5 items)

**Archives:**
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.2 — Setup & CV Management (Shipped 2026-04-27)

**Phases:** 7–8 | **Plans:** 3 | **Duration:** 1 day (2026-04-27)

**Delivered:** Desktop shortcut auto-creation on first packaged AppImage run + in-app CV upload with `.md` direct replace and `.pdf` text extraction, review, and atomic confirm flow.

**Key accomplishments:**
1. Desktop shortcut service — `ensureDesktopShortcut()` writes `~/.local/share/applications/jobengine.desktop` on first packaged run; `existsSync` gate preserves user edits (Phase 7)
2. PDF extraction via `unpdf@1.6.0` — `extractPdfText()` with stat-before-read 10 MB guard; no native bindings (Phase 8)
3. CV update IPC surface — `openCvFilePicker` (native dialog, `.md`/`.pdf` filter), `updateCv` (lockAndWrite + seed-if-missing), `getCvMtime` + typed preload bridges (Phase 8)
4. CV upload UI — `CvUploadModal` (editable review pane), `CvConfirmModal` (mtime-aware confirm), `CvPanel` discriminated-union upload flow with post-write `load()` refresh (Phase 8)

**Code stats:** 30 commits, ~425 insertions, 24 deletions across 10 electron files

**Known deferred items at close:** 11 (DESK-01 × 5, Phase 8 human UAT × 6) — all require packaged build or live Electron app; deferred per project UAT policy

**Archives:**
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/milestones/v1.2-REQUIREMENTS.md`
- `.planning/milestones/v1.2-MILESTONE-AUDIT.md`
