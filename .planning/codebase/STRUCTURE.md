# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```text
career-ops/
├── .claude/skills/career-ops/   # Claude skill router and mode loader
├── .opencode/commands/          # OpenCode command shims
├── batch/                       # Batch worker prompt, runner, logs, tracker additions
├── config/                      # Profile template and local profile file
├── dashboard/                   # Standalone Go TUI
├── data/                        # Pipeline queue and tracker data
├── docs/                        # Human-facing documentation
├── fonts/                       # PDF font assets
├── jds/                         # Saved local job descriptions
├── modes/                       # Shared and per-mode prompt files, plus locale packs
├── output/                      # Generated PDFs
├── reports/                     # Generated evaluation reports
├── templates/                   # HTML and YAML templates
├── *.mjs                        # Root Node automation CLIs
└── AGENTS.md / CLAUDE.md        # Agent behavior and routing rules
```

## Directory Purposes

**`.claude/skills/career-ops/`:**
- Purpose: Define the Claude-side router for Career-Ops.
- Contains: The slash-command skill entry file `.claude/skills/career-ops/SKILL.md`.
- Key files: `.claude/skills/career-ops/SKILL.md`

**`.opencode/commands/`:**
- Purpose: Expose the same router to OpenCode without duplicating business logic.
- Contains: Thin command wrappers that call the Claude skill.
- Key files: `.opencode/commands/career-ops.md`

**`modes/`:**
- Purpose: Hold the prompt contracts that define each workflow.
- Contains: Shared context in `modes/_shared.md`, user overrides in `modes/_profile.md`, default mode files such as `modes/auto-pipeline.md`, `modes/oferta.md`, `modes/pdf.md`, `modes/scan.md`, and language packs under `modes/de/`, `modes/fr/`, `modes/ja/`, `modes/pt/`, and `modes/ru/`.
- Key files: `modes/_shared.md`, `modes/_profile.md`, `modes/auto-pipeline.md`, `modes/scan.md`, `modes/oferta.md`, `modes/pdf.md`, `modes/tracker.md`

**`batch/`:**
- Purpose: Isolate batch-evaluation orchestration from interactive flows.
- Contains: Worker prompt template, orchestrator shell script, per-offer logs, pending tracker additions, and state files when batch runs are active.
- Key files: `batch/batch-runner.sh`, `batch/batch-prompt.md`, `batch/logs/.gitkeep`, `batch/tracker-additions/.gitkeep`

**`dashboard/`:**
- Purpose: Package the optional Go terminal UI as a separate executable.
- Contains: `main.go`, `go.mod`, and `internal/` packages for parsing, models, theme, and screens.
- Key files: `dashboard/main.go`, `dashboard/go.mod`

**`dashboard/internal/data/`:**
- Purpose: Parse tracker/report files and handle status updates for the dashboard.
- Contains: Filesystem parsers, status normalization, metrics, URL enrichment, and update helpers.
- Key files: `dashboard/internal/data/career.go`

**`dashboard/internal/model/`:**
- Purpose: Define the dashboard's in-memory data structures.
- Contains: View models for tracker rows and aggregate metrics.
- Key files: `dashboard/internal/model/career.go`

**`dashboard/internal/ui/screens/`:**
- Purpose: Render Bubble Tea screens and interaction flows.
- Contains: Pipeline list UI, preview rendering, report viewer, keybindings, and status picker behavior.
- Key files: `dashboard/internal/ui/screens/pipeline.go`, `dashboard/internal/ui/screens/viewer.go`

**`dashboard/internal/theme/`:**
- Purpose: Centralize dashboard color and theme definitions.
- Contains: Theme constructors and palette files.
- Key files: `dashboard/internal/theme/theme.go`, `dashboard/internal/theme/catppuccin.go`

**`config/`:**
- Purpose: Store profile templates and the local user profile.
- Contains: Checked-in example config plus the real local profile file.
- Key files: `config/profile.example.yml`, `config/profile.yml`

**`data/`:**
- Purpose: Hold queue and tracker files used by the automation flows.
- Contains: `data/pipeline.md` and `data/scan-history.tsv` in the current workspace; scripts also expect `data/applications.md` and `data/follow-ups.md` when those flows are in use.
- Key files: `data/pipeline.md`, `data/scan-history.tsv`, `data/applications.md`, `data/follow-ups.md`

**`templates/`:**
- Purpose: Keep shared templates and canonical vocabularies out of script bodies.
- Contains: CV HTML template, example portal config, and canonical tracker states.
- Key files: `templates/cv-template.html`, `templates/portals.example.yml`, `templates/states.yml`

**`reports/`:**
- Purpose: Store generated evaluation reports.
- Contains: Report markdown files named by numeric prefix, company slug, and ISO date. The current workspace contains only `reports/.gitkeep`.
- Key files: `reports/.gitkeep`, `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`

**`output/`:**
- Purpose: Store generated PDFs and related deliverables.
- Contains: Generated CV PDFs. The current workspace contains only `output/.gitkeep`.
- Key files: `output/.gitkeep`

**`jds/`:**
- Purpose: Store local copies of job descriptions when a public URL is not enough or not available.
- Contains: Markdown copies of JDs; the current workspace contains only `jds/.gitkeep`.
- Key files: `jds/.gitkeep`

**`docs/`:**
- Purpose: Hold human-oriented setup, customization, and reference documentation.
- Contains: Architecture notes, setup docs, imagery, and Codex-specific guidance.
- Key files: `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/CUSTOMIZATION.md`, `docs/CODEX.md`

## Key File Locations

**Entry Points:**
- `.claude/skills/career-ops/SKILL.md`: Main Claude router for all Career-Ops modes
- `.opencode/commands/career-ops.md`: OpenCode wrapper that forwards into the same skill
- `package.json`: Declares npm entry scripts such as `doctor`, `verify`, `pdf`, `scan`, and `update`
- `batch/batch-runner.sh`: Batch execution entry point for `claude -p` workers
- `dashboard/main.go`: Entry point for the standalone Go dashboard

**Configuration:**
- `AGENTS.md`: Codex-specific routing summary and behavior constraints
- `CLAUDE.md`: Main agent instructions, onboarding flow, and data-handling rules
- `DATA_CONTRACT.md`: Defines the boundary between user-owned and auto-updatable files
- `config/profile.example.yml`: Checked-in profile template
- `config/profile.yml`: Local user profile used by prompt flows
- `templates/portals.example.yml`: Example scanner configuration
- `portals.yml`: Local scanner configuration used by `scan.mjs`
- `templates/states.yml`: Canonical tracker status vocabulary

**Core Logic:**
- `scan.mjs`: Direct API scanner for Greenhouse, Ashby, and Lever
- `generate-pdf.mjs`: HTML-to-PDF pipeline via Playwright
- `merge-tracker.mjs`: Merge and deduplicate pending tracker additions
- `verify-pipeline.mjs`: Validate tracker integrity and report links
- `check-liveness.mjs`: Playwright CLI for job-link liveness checks
- `liveness-core.mjs`: Reusable URL classification helper
- `analyze-patterns.mjs`: Report/tracker analytics over historical applications
- `followup-cadence.mjs`: Follow-up timing analysis over active applications
- `dashboard/internal/data/career.go`: Dashboard parser and status update logic

**Testing:**
- `test-all.mjs`: Top-level verification runner detected in the repo
- `doctor.mjs`: Setup validation script used as an operational preflight check
- `verify-pipeline.mjs`: Data integrity validation for tracker/report consistency
- No dedicated `__tests__/`, `*.test.*`, or `*.spec.*` tree is detected in the current repository layout

## Naming Conventions

**Files:**
- Root Node scripts use kebab-case verb or noun phrases with `.mjs`, such as `generate-pdf.mjs`, `merge-tracker.mjs`, `normalize-statuses.mjs`, `followup-cadence.mjs`, and `check-liveness.mjs`.
- Mode files are lowercase Markdown names. Shared or user-override prompt files use a leading underscore, as in `modes/_shared.md` and `modes/_profile.md`.
- Default mode names preserve the existing product vocabulary rather than forcing one language. Examples include `modes/oferta.md`, `modes/contacto.md`, `modes/interview-prep.md`, and `modes/auto-pipeline.md`.
- Localized mode packs live under short locale directories and keep local-language filenames, such as `modes/de/angebot.md`, `modes/fr/postuler.md`, and `modes/ja/kyujin.md`.
- Generated reports follow the prompt contract `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`.
- Pending tracker additions use one `.tsv` file per entry in `batch/tracker-additions/`.
- Go source files use focused nouns inside package directories, such as `dashboard/internal/data/career.go` and `dashboard/internal/ui/screens/pipeline.go`.

**Directories:**
- Keep Node CLI code at project root. The current repo does not use a `src/` tree for JavaScript.
- Keep dashboard packages under `dashboard/internal/{data,model,theme,ui/screens}` to separate parsing, models, styling, and screen rendering.
- Keep user workflow state in the dedicated data directories `data/`, `reports/`, `output/`, and `jds/` instead of mixing generated artifacts into code directories.

## Where to Add New Code

**New Feature:**
- Prompt-driven workflow change: add or update a mode file under `modes/`, then register the route in `.claude/skills/career-ops/SKILL.md`. If OpenCode needs a direct command surface, mirror the command in `.opencode/commands/`.
- New Node automation: add a new top-level `*.mjs` script beside the existing CLIs. Wire it into `package.json` if it should be runnable through `npm run`.
- Batch-only behavior: keep orchestration changes in `batch/batch-runner.sh` and worker behavior changes in `batch/batch-prompt.md`.
- Tests: extend `test-all.mjs` or add another top-level verifier script. The repo does not have a dedicated test directory pattern to follow.

**New Component/Module:**
- Dashboard data parsing or status logic: `dashboard/internal/data/`
- Dashboard models: `dashboard/internal/model/`
- Dashboard screens and interaction logic: `dashboard/internal/ui/screens/`
- Dashboard palette or reusable styling: `dashboard/internal/theme/`

**Utilities:**
- Shared Node helper reused by multiple CLIs: create a small root-level module next to the scripts, following the existing pattern in `liveness-core.mjs`.
- Shared static config or templates: place them in `templates/` instead of hardcoding values into prompt files or scripts.
- User-specific customization: write only to `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, or `portals.yml`. Do not place personalization in `modes/_shared.md`.

## Special Directories

**`data/`:**
- Purpose: Live user workflow state such as pipeline queue and tracker tables
- Generated: Yes, user-managed
- Committed: No for active data files; only placeholders like `data/.gitkeep` are committed

**`reports/`:**
- Purpose: Generated evaluation reports linked from the tracker
- Generated: Yes
- Committed: Only `reports/.gitkeep` is committed; actual report files are gitignored

**`output/`:**
- Purpose: Generated PDF artifacts
- Generated: Yes
- Committed: Only `output/.gitkeep` is committed; generated PDFs are gitignored

**`batch/tracker-additions/`:**
- Purpose: Queue of pending TSV tracker writes produced by workers before merge
- Generated: Yes
- Committed: Only `batch/tracker-additions/.gitkeep` is committed; actual TSV additions are gitignored

**`dashboard/internal/`:**
- Purpose: Private Go packages for the TUI application
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Generated GSD reference documents consumed by planning and execution commands
- Generated: Yes
- Committed: Yes when maintained as project intelligence

---

*Structure analysis: 2026-04-11*
