# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Prompt-driven local automation with file-backed state and a separate terminal dashboard

**Key Characteristics:**
- Use checked-in prompt contracts in `.claude/skills/career-ops/SKILL.md` and `modes/*.md` as the top-level control plane. Behavior starts from routing and instructions, not from a web server or `src/` application.
- Keep durable state in local Markdown, YAML, and TSV files such as `cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/pipeline.md`, `data/scan-history.tsv`, `data/applications.md`, `reports/*.md`, and `output/*`.
- Implement operations as single-purpose Node CLIs at repo root, including `scan.mjs`, `generate-pdf.mjs`, `merge-tracker.mjs`, `verify-pipeline.mjs`, `check-liveness.mjs`, and `analyze-patterns.mjs`.
- Treat `dashboard/` as an optional client over the same files rather than a separate backend. The Go TUI reads and writes the tracker artifacts already produced by the prompt and script layers.

## Layers

**Agent Routing And Prompt Layer:**
- Purpose: Route user intent into a specific Career-Ops workflow and define the instructions the AI follows.
- Location: `.claude/skills/career-ops/SKILL.md`, `.opencode/commands/career-ops.md`, `AGENTS.md`, `CLAUDE.md`, `modes/`, `modes/de/`, `modes/fr/`, `modes/ja/`, `modes/pt/`, `modes/ru/`
- Contains: Slash-command routing, shared rules in `modes/_shared.md`, user override slot in `modes/_profile.md`, and mode-specific prompt contracts such as `modes/auto-pipeline.md`, `modes/oferta.md`, `modes/pdf.md`, `modes/scan.md`, `modes/batch.md`, and `modes/tracker.md`
- Depends on: User data files such as `cv.md`, `config/profile.yml`, `article-digest.md`, and `portals.yml`; executable scripts such as `scan.mjs`, `generate-pdf.mjs`, and `merge-tracker.mjs`
- Used by: Claude Code via `.claude/skills/career-ops/SKILL.md` and OpenCode via `.opencode/commands/career-ops.md`

**File-Based Domain State Layer:**
- Purpose: Persist candidate profile, queues, history, and generated outputs without a database.
- Location: `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `data/`, `reports/`, `output/`, `jds/`, `templates/`, `DATA_CONTRACT.md`
- Contains: Candidate profile files, scan queue in `data/pipeline.md`, scan ledger in `data/scan-history.tsv`, tracker table in `data/applications.md`, generated reports in `reports/*.md`, generated PDFs in `output/*`, and canonical statuses in `templates/states.yml`
- Depends on: Local filesystem only
- Used by: Root Node CLIs, batch workers under `batch/`, and dashboard readers in `dashboard/internal/data/career.go`

**Node Automation Layer:**
- Purpose: Execute concrete operations against job boards, Playwright, templates, and local files.
- Location: Root `*.mjs` files including `doctor.mjs`, `scan.mjs`, `generate-pdf.mjs`, `merge-tracker.mjs`, `verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, `check-liveness.mjs`, `cv-sync-check.mjs`, and `update-system.mjs`
- Contains: Standalone CLIs with their own argument parsing, validation, summary output, and exit codes
- Depends on: `package.json`, `templates/cv-template.html`, `templates/states.yml`, `fonts/`, `batch/`, `data/`, `reports/`, `output/`, and runtime libraries such as Playwright
- Used by: Humans through `npm run ...`, prompt-driven agent flows, and batch workers

**Batch Orchestration Layer:**
- Purpose: Run many evaluations through isolated worker executions while keeping tracker writes mergeable and resumable.
- Location: `batch/batch-runner.sh`, `batch/batch-prompt.md`, `batch/batch-input.tsv`, `batch/batch-state.tsv`, `batch/tracker-additions/`, `batch/logs/`
- Contains: Worker prompt contract, shell orchestration, lock files, state rows, queued tracker additions, and per-offer logs
- Depends on: `claude -p`, prompt files under `modes/`, generated reports in `reports/`, tracker target `data/applications.md`, and merge logic in `merge-tracker.mjs`
- Used by: `/career-ops batch` flows and direct shell execution

**Dashboard Presentation Layer:**
- Purpose: Provide an interactive terminal UI for browsing the pipeline, opening reports, and editing statuses.
- Location: `dashboard/main.go`, `dashboard/internal/data/`, `dashboard/internal/model/`, `dashboard/internal/theme/`, `dashboard/internal/ui/screens/`
- Contains: Go entry point, `CareerApplication` and metrics models in `dashboard/internal/model/career.go`, file parsing in `dashboard/internal/data/career.go`, theme setup in `dashboard/internal/theme/theme.go`, and screen logic in `dashboard/internal/ui/screens/pipeline.go` plus `dashboard/internal/ui/screens/viewer.go`
- Depends on: `data/applications.md`, `reports/*.md`, `batch/batch-input.tsv`, `batch/batch-state.tsv`, and the same status vocabulary that the Node scripts enforce
- Used by: Local users building and running the dashboard binary

## Data Flow

**Interactive Evaluation Flow:**

1. `/career-ops` or a raw JD enters through `.claude/skills/career-ops/SKILL.md` or `.opencode/commands/career-ops.md`.
2. The router loads `modes/_shared.md` plus a mode file such as `modes/auto-pipeline.md` or `modes/oferta.md`.
3. The prompt layer reads candidate context from `cv.md`, `config/profile.yml`, `modes/_profile.md`, and optionally `article-digest.md`.
4. The workflow writes a report to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`, may generate a PDF through `generate-pdf.mjs`, and stages a tracker row in `batch/tracker-additions/*.tsv`.
5. `merge-tracker.mjs` merges staged tracker additions into `data/applications.md`, which becomes the canonical tracker for later scripts and the dashboard.

**Portal Discovery Flow:**

1. `scan.mjs` reads `portals.yml`.
2. It detects provider-specific APIs from each company definition, fetches postings, and filters titles using the configured `title_filter`.
3. It deduplicates against `data/scan-history.tsv`, `data/pipeline.md`, and `data/applications.md`.
4. New postings are appended to `data/pipeline.md` and recorded in `data/scan-history.tsv`.

**Batch Evaluation Flow:**

1. `batch/batch-runner.sh` reads `batch/batch-input.tsv` and `batch/batch-prompt.md`.
2. The runner allocates report numbers, updates `batch/batch-state.tsv`, and launches `claude -p` workers under lock files such as `batch/batch-runner.pid` and `batch/.batch-state.lock`.
3. Workers write reports into `reports/` and tracker additions into `batch/tracker-additions/`.
4. `merge-tracker.mjs` normalizes, deduplicates, and merges the pending additions into `data/applications.md`.

**Dashboard Read/Write Flow:**

1. `dashboard/main.go` loads tracker rows from `data/applications.md` through `dashboard/internal/data/career.go`.
2. The data layer enriches rows with report metadata from `reports/*.md` and job URL hints from `batch/batch-input.tsv` and `batch/batch-state.tsv`.
3. `dashboard/internal/ui/screens/pipeline.go` renders grouped and flat lists, while `dashboard/internal/ui/screens/viewer.go` renders full report content.
4. Status edits call `UpdateApplicationStatus` in `dashboard/internal/data/career.go`, which writes the new value back to `applications.md`.

**State Management:**
- Treat the filesystem as the system of record. Markdown tables under `data/` hold human-editable workflow state, TSV files under `data/` and `batch/` hold queue-like state, YAML under `config/` and `templates/` holds configuration, and `reports/` plus `output/` hold generated artifacts.
- There is no long-running service, ORM, or database migration layer. Re-running scripts against files is the normal recovery path.

## Key Abstractions

**Mode Contract:**
- Purpose: Define one user workflow as a prompt module that the router can load.
- Examples: `modes/auto-pipeline.md`, `modes/oferta.md`, `modes/scan.md`, `modes/pdf.md`, `modes/tracker.md`
- Pattern: Load `modes/_shared.md` first for shared rules, then apply mode-specific instructions from a single Markdown file

**Tracker Addition Row:**
- Purpose: Represent an application event as a mergeable unit before it becomes canonical tracker data.
- Examples: `batch/tracker-additions/*.tsv`, `merge-tracker.mjs`, `modes/_shared.md`
- Pattern: Write append-only TSV output first, then normalize and deduplicate during merge into `data/applications.md`

**Canonical Status Vocabulary:**
- Purpose: Keep prompt instructions, merge scripts, validators, and the dashboard aligned on tracker status values.
- Examples: `templates/states.yml`, `verify-pipeline.mjs`, `merge-tracker.mjs`, `dashboard/internal/data/career.go`
- Pattern: Treat `templates/states.yml` as the intended source of truth and keep alias normalization in every runtime aligned with it

**CareerApplication Projection:**
- Purpose: Convert one tracker row plus report-derived enrichments into a UI-friendly record.
- Examples: `dashboard/internal/model/career.go`, `dashboard/internal/data/career.go`, `dashboard/internal/ui/screens/pipeline.go`
- Pattern: Parse the minimal tracker row first, then enrich it from linked report files and batch metadata before rendering

**Liveness Classifier:**
- Purpose: Decide whether a job posting still looks active without using LLM reasoning.
- Examples: `liveness-core.mjs`, `check-liveness.mjs`
- Pattern: Keep the classification logic pure in `liveness-core.mjs` and let Playwright code in `check-liveness.mjs` supply DOM-derived signals

## Entry Points

**Claude Slash Command Router:**
- Location: `.claude/skills/career-ops/SKILL.md`
- Triggers: `/career-ops` invocations and raw JD paste flows in Claude Code
- Responsibilities: Map arguments to modes, decide when raw text becomes `auto-pipeline`, and specify which mode files must be loaded

**OpenCode Command Shim:**
- Location: `.opencode/commands/career-ops.md`
- Triggers: `/career-ops` invocations in OpenCode
- Responsibilities: Forward arguments into the same `career-ops` skill instead of maintaining a second routing system

**Node CLI Scripts:**
- Location: `package.json` plus root files such as `doctor.mjs`, `verify-pipeline.mjs`, `scan.mjs`, `generate-pdf.mjs`, `check-liveness.mjs`, and `update-system.mjs`
- Triggers: `npm run ...`, direct `node <script>.mjs`, or prompt instructions that shell out
- Responsibilities: Validate setup, fetch jobs, generate PDFs, verify tracker integrity, analyze stored data, and maintain local files

**Batch Runner:**
- Location: `batch/batch-runner.sh`
- Triggers: Direct shell execution or batch-mode agent workflows
- Responsibilities: Allocate work across `claude -p` workers, coordinate locks and state, and stage tracker additions for merging

**Dashboard Application:**
- Location: `dashboard/main.go`
- Triggers: `go build`, `go run`, or a compiled `career-dashboard` binary
- Responsibilities: Read tracker and report files, render the TUI, open reports and job URLs, and write tracker status updates

## Error Handling

**Strategy:** Fail fast at script boundaries, validate file contracts early, and prefer compatibility fallbacks over silent corruption.

**Patterns:**
- Resolve project-root-relative paths from the current script file with `fileURLToPath(import.meta.url)` in `scan.mjs`, `verify-pipeline.mjs`, `merge-tracker.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, and `cv-sync-check.mjs`.
- Guard expected files with `existsSync` and exit non-zero on hard failures in `doctor.mjs`, `scan.mjs`, `check-liveness.mjs`, `cv-sync-check.mjs`, and `verify-pipeline.mjs`.
- Support both `data/applications.md` and `applications.md` in `verify-pipeline.mjs`, `merge-tracker.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs`, and `dashboard/internal/data/career.go` to preserve compatibility with older layouts.
- Prevent concurrent batch corruption through `batch/batch-runner.sh` lock files `batch/batch-runner.pid` and `batch/.batch-state.lock`.
- When dashboard status writes fail, `dashboard/main.go` logs a warning to stderr and rebuilds its in-memory pipeline from disk.

## Cross-Cutting Concerns

**Logging:** Use plain stdout and stderr. Examples include summary output in `scan.mjs`, validation messages in `verify-pipeline.mjs`, and warning logs in `dashboard/main.go`.

**Validation:** Centralize operational checks in `doctor.mjs`, `cv-sync-check.mjs`, and `verify-pipeline.mjs`; treat `templates/states.yml` and `DATA_CONTRACT.md` as contract files that other layers must honor.

**Authentication:** No application-level authentication subsystem is present in repo code. External identity is delegated to local AI CLIs, browser sessions used by Playwright, and developer tooling outside the repo.

**User/System Boundary:** Keep personalization in `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `cv.md`, and user data under `data/`, while updatable system behavior stays in `modes/`, root `*.mjs`, `templates/`, and `dashboard/` per `DATA_CONTRACT.md`, `AGENTS.md`, and `CLAUDE.md`.

---

*Architecture analysis: 2026-04-11*
