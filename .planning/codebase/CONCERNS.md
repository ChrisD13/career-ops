# Codebase Concerns

**Analysis Date:** 2026-04-11

## Tech Debt

**Markdown tracker as shared database:**
- Issue: `data/applications.md` is the system of record, but it is parsed and rewritten independently in `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `verify-pipeline.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, and `dashboard/internal/data/career.go`.
- Files: `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `verify-pipeline.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, `dashboard/internal/data/career.go`
- Impact: any formatting drift, embedded pipe character, or column reorder can break deduplication, analytics, dashboard rendering, and repair scripts at once.
- Fix approach: centralize tracker parsing/writing in one library, or move the canonical store to TSV/JSON/SQLite and render Markdown as a derived artifact.

**Canonical status rules are duplicated instead of loaded from one source:**
- Issue: status aliases and canonical values are hardcoded in multiple places even though `templates/states.yml` exists as the documented source of truth.
- Files: `templates/states.yml`, `merge-tracker.mjs`, `verify-pipeline.mjs`, `normalize-statuses.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, `dashboard/internal/data/career.go`
- Impact: behavior can drift between merge, verify, analytics, and dashboard paths; `verify-pipeline.mjs` even declares `STATES_FILE` but validates against hardcoded arrays.
- Fix approach: load `templates/states.yml` once and share normalization helpers across Node and Go consumers.

**Large monolithic entrypoints with mixed concerns:**
- Issue: orchestration, parsing, business rules, I/O, and CLI output live in single large files.
- Files: `batch/batch-runner.sh`, `analyze-patterns.mjs`, `followup-cadence.mjs`, `dashboard/internal/data/career.go`, `dashboard/internal/ui/screens/pipeline.go`
- Impact: small behavior changes require high-context edits, increase regression risk, and make unit-level verification difficult.
- Fix approach: split each path into parser, domain logic, and I/O layers with fixture-backed tests.

**Documentation contract drift:**
- Issue: user-customization instructions are inconsistent across project docs. `CLAUDE.md` and `AGENTS.md` route personalization to `config/profile.yml` and `modes/_profile.md`, while `docs/CUSTOMIZATION.md` and `README.md` still instruct users to edit `modes/_shared.md`.
- Files: `CLAUDE.md`, `AGENTS.md`, `DATA_CONTRACT.md`, `docs/CUSTOMIZATION.md`, `README.md`
- Impact: users can put personal data into auto-updated system files and lose it on update, or contributors can preserve conflicting rules.
- Fix approach: align all docs around the data contract and add a validation check that rejects user-specific edits to `modes/_shared.md`.

## Known Bugs

**Dashboard scan-history lookup uses the wrong path:**
- Symptoms: applications that rely on scan history for URL recovery do not get a `JobURL`, so the dashboard cannot open the original posting even when `data/scan-history.tsv` exists.
- Files: `dashboard/internal/data/career.go`, `scan.mjs`, `DATA_CONTRACT.md`
- Trigger: any dashboard record without a report-header URL or batch mapping fallback.
- Workaround: rely on report-header URLs or batch mappings; a root-level `scan-history.tsv` file would also satisfy the broken lookup, but that bypasses the documented layout.

**Dashboard status changes can rewrite the wrong text:**
- Symptoms: inline status updates in the TUI replace the first matching status string in the entire Markdown row instead of targeting the status column.
- Files: `dashboard/internal/data/career.go`
- Trigger: `UpdateApplicationStatus` matches the row by report number, then `replaceStatusInLine` uses `strings.Replace(line, oldStatus, newStatus, 1)` on the full line.
- Workaround: edit `data/applications.md` manually when the row contains repeated status-like text or unexpected formatting.

**Scanner assumes `data/pipeline.md` already exists:**
- Symptoms: `node scan.mjs` can discover jobs and create `data/scan-history.tsv`, then fail when it tries to append new offers because `appendToPipeline()` always reads `data/pipeline.md` first.
- Files: `scan.mjs`, `doctor.mjs`, `CLAUDE.md`
- Trigger: running the scanner on a setup that has `portals.yml` but no initialized `data/pipeline.md`.
- Workaround: create `data/pipeline.md` manually with the expected section headers before running the scanner.

**Scanner behavior does not match the documented 3-level discovery design:**
- Symptoms: companies without an Ashby, Lever, or Greenhouse-detectable API are skipped entirely, even though the mode contract says tracked company pages are scanned first with Playwright and search queries are additive.
- Files: `scan.mjs`, `modes/scan.md`, `README.md`
- Trigger: any `tracked_companies` entry that has only a normal `careers_url` or depends on WebSearch/Playwright discovery.
- Workaround: configure only API-detectable boards, or run the interactive scan flow through an agent rather than the standalone script.

## Security Considerations

**Batch evaluation runs with broad local privileges:**
- Risk: `batch/batch-runner.sh` launches `claude -p --dangerously-skip-permissions` and injects URL-derived values into a generated system prompt. The worker then reads local candidate files and writes reports, PDFs, and tracker additions.
- Files: `batch/batch-runner.sh`, `batch/batch-prompt.md`, `.claude/skills/career-ops/SKILL.md`
- Current mitigation: prompt-level rules such as “read-only” guidance for some files, per-run logs in `batch/logs/`, and a shell lock to prevent duplicate runners.
- Recommendations: remove `--dangerously-skip-permissions`, constrain writes to an allowlisted workspace, validate worker output before merge, and sanitize interpolated prompt values beyond the current `sed` delimiter escaping.

**Updater trusts live upstream state and installs dependencies without a committed lockfile:**
- Risk: `update-system.mjs` fetches `main` from `https://github.com/santifer/career-ops.git`, checks out an allowlisted set of paths, and runs `npm install --silent`. `.gitignore` excludes `package-lock.json`, so dependency resolution is not reproducible.
- Files: `update-system.mjs`, `.gitignore`, `package.json`
- Current mitigation: `SYSTEM_PATHS` and `USER_PATHS` allowlists, a lockfile for the update process itself (`.update-lock`), and a rollback branch.
- Recommendations: update from signed tags or release tarballs, commit `package-lock.json`, switch updater installs to `npm ci`, and record the exact upstream revision that was applied.

**Backup files for personal tracker data are not ignored:**
- Risk: repair scripts create `data/applications.md.bak`, but `.gitignore` ignores only `data/applications.md`, not backup variants.
- Files: `normalize-statuses.mjs`, `dedup-tracker.mjs`, `.gitignore`
- Current mitigation: none in the repository rules.
- Recommendations: ignore `data/*.bak` and other generated backups, or write backups into an already ignored temp directory.

## Performance Bottlenecks

**Dashboard startup does eager report parsing despite a lazy-load model:**
- Problem: `dashboard/internal/ui/screens/pipeline.go` defines `PipelineLoadReportMsg` for lazy summary loading, but `dashboard/main.go` loops over every application and parses every report on startup.
- Files: `dashboard/main.go`, `dashboard/internal/ui/screens/pipeline.go`, `dashboard/internal/data/career.go`
- Cause: all report summaries are batch-loaded before the UI starts.
- Improvement path: load only visible rows on first render, then cache on demand or build a small metadata index beside each report.

**Analytics scripts scale linearly with tracker size and report count:**
- Problem: `analyze-patterns.mjs` and `followup-cadence.mjs` reread the full tracker and linked reports for every invocation.
- Files: `analyze-patterns.mjs`, `followup-cadence.mjs`, `reports/`
- Cause: no cached metadata or precomputed index; Markdown reports are reparsed from scratch every run.
- Improvement path: store extracted report metadata in a sidecar file or derive analytics from structured tracker/report data.

**Whole-file rewrites for tracker maintenance:**
- Problem: merge, dedup, normalization, and dashboard status updates rewrite the full tracker file even for single-row changes.
- Files: `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `dashboard/internal/data/career.go`
- Cause: the tracker is treated as mutable text, not structured data.
- Improvement path: switch to append-safe structured storage and generate Markdown views separately.

## Fragile Areas

**Tracker merge and repair path:**
- Files: `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `verify-pipeline.mjs`
- Why fragile: each script uses its own parsing, fuzzy matching, and write-back rules; `merge-tracker.mjs` also emits raw Markdown rows without escaping pipe characters in free-text fields.
- Safe modification: change tracker columns, row formatting, and duplicate rules only after updating every consumer and running fixture-based roundtrip tests.
- Test coverage: no dedicated fixture suite for tracker parsing or corruption recovery is present.

**Dashboard data enrichment and mutation path:**
- Files: `dashboard/internal/data/career.go`, `dashboard/main.go`
- Why fragile: the dashboard mixes compatibility fallbacks, fuzzy URL recovery, startup-time report parsing, and direct Markdown mutation.
- Safe modification: isolate parsing from mutation, add golden-file fixtures for tracker/report inputs, and verify the fallback order for `JobURL` enrichment before changing file paths.
- Test coverage: no Go tests are present under `dashboard/`.

**Scanner implementation versus scanner contract:**
- Files: `scan.mjs`, `modes/scan.md`, `templates/portals.example.yml`, `README.md`
- Why fragile: the runtime script is API-only, while the documented behavior depends on Playwright page scraping, WebSearch discovery, and liveness checks for Level 3 results.
- Safe modification: either narrow the documented contract to the API-only implementation or add integration tests that prove each discovery level works against fixtures.
- Test coverage: no scanner fixtures or integration tests are present.

**Customization and update boundary:**
- Files: `README.md`, `docs/CUSTOMIZATION.md`, `CLAUDE.md`, `AGENTS.md`, `DATA_CONTRACT.md`, `update-system.mjs`
- Why fragile: docs disagree about which files are safe for personalization, while the updater aggressively replaces system-layer files.
- Safe modification: update all customization docs and the updater contract together; do not change one without the others.
- Test coverage: no automated check enforces that documentation and updater allowlists stay aligned.

## Scaling Limits

**Flat-file pipeline data model:**
- Current capacity: acceptable for a single user and modest history depth; the repo itself advertises hundreds of evaluations in `README.md`.
- Limit: startup time, analytics latency, and tracker maintenance cost all grow with the number of reports and tracker rows because parsing and rewrites are O(n) over text files.
- Scaling path: move canonical state to SQLite or structured JSONL and derive Markdown/TSV views for humans and LLM prompts.

**Single-host shell orchestration for batch work:**
- Current capacity: local parallel runs with a small number of workers, coordinated by `batch/batch-runner.sh` and lock directories in `batch/`.
- Limit: lock recovery is manual, state rewrites are file-based, and the runner is not safe for multi-host or distributed execution.
- Scaling path: use a structured job queue with durable per-job state, explicit leases, and resumable artifacts.

## Dependencies at Risk

**Playwright:**
- Risk: PDF generation and liveness checks depend on a local Chromium install and the Playwright runtime, but there is no committed lockfile and no CI workflow exercising browser-dependent paths.
- Impact: `generate-pdf.mjs` and `check-liveness.mjs` can fail differently across machines or after dependency drift.
- Migration plan: commit a lockfile, add browser-install verification to automated checks, and isolate browser-dependent tests so regressions are visible before release.

**Claude CLI as an undeclared runtime dependency:**
- Risk: batch automation depends on `claude` being on `PATH`, but that dependency is not represented in `package.json` and is only checked at runtime inside `batch/batch-runner.sh`.
- Impact: batch mode is harder to validate, harder to document precisely, and impossible to cover with standard package-manager tooling.
- Migration plan: document the CLI dependency as a first-class requirement and add a smoke check that is separate from application logic.

## Missing Critical Features

**Automated CI execution:**
- Problem: `.github/` contains templates and security metadata, but no workflow runs the repo’s checks on push or pull request.
- Blocks: early detection of parser regressions, dashboard build failures, and cross-platform setup issues.

**Fixture-backed parser tests for canonical data files:**
- Problem: there is no authoritative set of sample `applications.md`, `pipeline.md`, `scan-history.tsv`, and report fixtures that every parser must pass.
- Blocks: safe evolution of tracker columns, report formats, multilingual modes, and dashboard enrichment logic.

**Enforced schema for user-generated artifacts:**
- Problem: tracker lines, reports, and follow-up files are validated only after the fact, and validation itself is text-heuristic based.
- Blocks: confident automation around merges, status updates, and analytics.

## Test Coverage Gaps

**No conventional test suite or CI-backed execution path:**
- What's not tested: there are no `*.test.*` or `*.spec.*` files, `package.json` exposes no `test` script, and `.github/` has no workflow running `test-all.mjs` or `verify-pipeline.mjs`.
- Files: `package.json`, `test-all.mjs`, `.github/`
- Risk: regressions reach users unless someone manually runs the ad hoc scripts.
- Priority: High

**Tracker parser and writer roundtrips are untested:**
- What's not tested: free-text escaping, pipe characters inside notes, duplicate detection edge cases, and compatibility between merge/dedup/normalize/verify scripts.
- Files: `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `verify-pipeline.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`
- Risk: silent data corruption or analytics drift in the main user dataset.
- Priority: High

**Dashboard data-path and mutation logic are untested:**
- What's not tested: `scan-history.tsv` fallback loading, report summary caching, and inline status updates.
- Files: `dashboard/internal/data/career.go`, `dashboard/main.go`, `dashboard/internal/ui/screens/pipeline.go`
- Risk: broken links, incorrect status mutations, and slow startup behavior persist unnoticed.
- Priority: High

**Scanner first-run and non-API portal flows are untested:**
- What's not tested: missing `data/pipeline.md`, tracked companies without API detection, and the documented Playwright/WebSearch discovery path.
- Files: `scan.mjs`, `modes/scan.md`, `doctor.mjs`
- Risk: the scanner fails on fresh setups or silently misses configured companies.
- Priority: High

**Updater and batch trust boundaries are untested:**
- What's not tested: updater safety around dependency installation, user-data backup leakage, prompt interpolation edge cases, and least-privilege behavior in batch workers.
- Files: `update-system.mjs`, `batch/batch-runner.sh`, `.gitignore`
- Risk: supply-chain drift, local data exposure, or unsafe worker behavior can slip through without detection.
- Priority: Medium

---

*Concerns audit: 2026-04-11*
