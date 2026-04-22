# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- JavaScript (ES modules, `.mjs`) - the core automation layer lives in `scan.mjs`, `generate-pdf.mjs`, `doctor.mjs`, `verify-pipeline.mjs`, `merge-tracker.mjs`, `cv-sync-check.mjs`, `followup-cadence.mjs`, `analyze-patterns.mjs`, and `update-system.mjs`.

**Secondary:**
- Go 1.24.2 - optional terminal dashboard in `dashboard/main.go` and `dashboard/internal/**`, pinned in `dashboard/go.mod`.
- Bash - batch orchestration and worker management in `batch/batch-runner.sh`.
- YAML, Markdown, TSV, HTML - file-backed configuration and content in `config/profile.yml`, `portals.yml`, `templates/portals.example.yml`, `data/*.md`, `data/*.tsv`, `reports/*.md`, and `templates/cv-template.html`.

## Runtime

**Environment:**
- Node.js 18+ - required by `doctor.mjs`, `docs/SETUP.md`, and `docs/CODEX.md`; all root scripts run under Node.
- Go 1.24.2 - required only for `dashboard/`, from `dashboard/go.mod`.
- Optional Nix dev shell - `flake.nix` provisions `nodejs`, `bun`, `coreutils`, and `playwright-driver.browsers`.

**Package Manager:**
- npm (version not pinned in `package.json`) - root package manager for the Node toolchain.
- Lockfile: `package-lock.json` present.
- Go modules - `dashboard/go.mod` and `dashboard/go.sum` manage the dashboard dependencies separately.

## Frameworks

**Core:**
- Agent-driven local CLI workflow - routing and operational rules live in `CLAUDE.md`, `AGENTS.md`, `.claude/skills/career-ops/SKILL.md`, and `modes/*.md`. This repo is not built on Express, Next.js, or another web framework.
- Playwright 1.58.1 - browser automation and rendering imported in `generate-pdf.mjs`, `check-liveness.mjs`, and `doctor.mjs`; declared in `package.json`.
- Bubble Tea 1.3.10 - Go TUI event loop in `dashboard/main.go`.
- Lip Gloss 1.1.0 - Go TUI styling in `dashboard/internal/theme/theme.go` and `dashboard/internal/theme/catppuccin.go`.

**Testing:**
- No Jest, Vitest, Mocha, or Go test suite detected.
- Repository validation is script-based: `test-all.mjs` runs syntax checks, smoke tests, liveness classification tests, and a dashboard build.

**Build/Dev:**
- npm scripts in `package.json` wrap the operational scripts: `doctor`, `verify`, `normalize`, `dedup`, `merge`, `pdf`, `sync-check`, `update`, `liveness`, and `scan`.
- The Go dashboard is built directly with `go build`, as documented in `README.md`, `docs/SETUP.md`, and `docs/CODEX.md`.
- `flake.nix` provides an optional reproducible shell and pins Playwright browser binaries to the Nix package version.

## Key Dependencies

**Critical:**
- `playwright@^1.58.1` - Chromium automation for HTML-to-PDF rendering in `generate-pdf.mjs`, page liveness checks in `check-liveness.mjs`, and prerequisite validation in `doctor.mjs`.
- `js-yaml@^4.1.1` - parses `portals.yml` / `templates/portals.example.yml` in `scan.mjs`.

**Infrastructure:**
- `github.com/charmbracelet/bubbletea v1.3.10` - dashboard UI runtime in `dashboard/main.go`.
- `github.com/charmbracelet/lipgloss v1.1.0` - dashboard styling primitives in `dashboard/internal/theme/*`.
- Node built-ins (`fetch`, `AbortController`, `fs`, `path`, `child_process`) do most of the heavy lifting in `scan.mjs`, `update-system.mjs`, `merge-tracker.mjs`, and the other root scripts. There is no HTTP client abstraction like Axios or an ORM/database driver.

## Configuration

**Environment:**
- The system is primarily file-configured, not env-configured. User and runtime state live in `cv.md`, `article-digest.md`, `config/profile.yml`, `portals.yml`, `data/pipeline.md`, `data/scan-history.tsv`, `data/applications.md`, `reports/`, and `output/`.
- `DATA_CONTRACT.md` explicitly separates update-safe system files from user-owned data files.
- No required application secrets or `.env`-driven settings are referenced in the committed Node or Go code.
- `.envrc` exists at the repo root; treat it as local shell bootstrap only. Its contents were not inspected.
- Optional Nix shell variables come from `flake.nix`: `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`, and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`.

**Build:**
- Root Node manifest: `package.json`.
- Root Node lockfile: `package-lock.json`.
- Go module manifest: `dashboard/go.mod`.
- Optional reproducible shell: `flake.nix` and `flake.lock`.
- Agent/command routing: `.claude/skills/career-ops/SKILL.md` and `.opencode/commands/career-ops*.md`.
- Presentation assets for PDF generation: `templates/cv-template.html` plus self-hosted fonts in `fonts/`.

## Platform Requirements

**Development:**
- Node.js 18+ with `npm install` for all root scripts, per `docs/SETUP.md` and `docs/CODEX.md`.
- Playwright Chromium installed via `npx playwright install chromium` for `generate-pdf.mjs`, `check-liveness.mjs`, and `doctor.mjs`.
- Go toolchain for `dashboard/` builds; `docs/CODEX.md` says Go 1.21+ is sufficient, while `dashboard/go.mod` currently pins Go 1.24.2.
- `claude` CLI is required only for `batch/batch-runner.sh`; the rest of the repository scripts do not call Anthropic or OpenAI SDKs directly.

**Production:**
- Local workstation / CLI execution only. No deployed web service, container target, or server runtime was detected.
- Persistent artifacts stay on disk in `data/`, `reports/`, and `output/`.
- Optional compiled local binary for the dashboard comes from `dashboard/`.

---

*Stack analysis: 2026-04-11*
