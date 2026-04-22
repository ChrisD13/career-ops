# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Job Board APIs:**
- Greenhouse Boards API - structured job discovery in `scan.mjs`, with concrete board URLs configured in `templates/portals.example.yml` and resolved from user `portals.yml`.
  - SDK/Client: Node 18 `fetch` plus `parseGreenhouse` in `scan.mjs`
  - Auth: None detected; public endpoints such as `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
- Ashby Posting API - auto-detected from `jobs.ashbyhq.com/{slug}` URLs in `scan.mjs`.
  - SDK/Client: Node 18 `fetch` plus `parseAshby` in `scan.mjs`
  - Auth: None detected; public endpoint `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`
- Lever Postings API - auto-detected from `jobs.lever.co/{slug}` URLs in `scan.mjs`.
  - SDK/Client: Node 18 `fetch` plus `parseLever` in `scan.mjs`
  - Auth: None detected; public endpoint `https://api.lever.co/v0/postings/{slug}`

**Career Pages And Search Sources:**
- Direct company careers pages - `templates/portals.example.yml` tracks many custom `careers_url` values such as `https://openai.com/careers`, `https://retool.com/careers`, and other public portals.
  - SDK/Client: Playwright/browser-tool workflow documented in `modes/scan.md`; repo-side browser automation exists in `check-liveness.mjs`
  - Auth: None detected; public sites only
- Broad search-source discovery - `templates/portals.example.yml` includes search queries for Wellfound, Workable, RemoteFront, Remotive, WeWorkRemotely, Working Nomads, YC Jobs, and other public boards.
  - SDK/Client: Agent WebSearch + Playwright workflow described in `modes/scan.md`
  - Auth: None detected
- Current implementation boundary - the committed `scan.mjs` only scans companies whose `careers_url` can be mapped to Greenhouse, Ashby, or Lever APIs. Non-API `careers_url` entries and WebSearch discovery are currently mode/instruction-driven through `modes/scan.md`, not executed by `scan.mjs` itself.

**Repository Update Services:**
- GitHub raw content and releases API - version checks and changelog lookup in `update-system.mjs`.
  - SDK/Client: Node 18 `fetch`
  - Auth: None for public read endpoints `https://raw.githubusercontent.com/...` and `https://api.github.com/repos/.../releases/latest`
- Canonical upstream git remote - safe system-file updates pull from `https://github.com/santifer/career-ops.git` in `update-system.mjs`.
  - SDK/Client: `git` CLI through `execFileSync`
  - Auth: Local git credentials/config outside the repo, if required by the user environment

**AI Runtime Integrations:**
- Claude CLI / Claude Code - batch evaluation is delegated to `claude -p` workers from `batch/batch-runner.sh`; routing and expected mode loading are defined in `.claude/skills/career-ops/SKILL.md` and `CLAUDE.md`.
  - SDK/Client: External `claude` CLI process
  - Auth: Handled by the user's Claude CLI environment; no token storage in repo files
- OpenCode and Codex clients - command wrappers and routing docs exist in `.opencode/commands/career-ops*.md`, `AGENTS.md`, and `docs/CODEX.md`.
  - SDK/Client: Host AI client, not a local JS dependency
  - Auth: Handled by the host client environment

**Optional Design Tooling:**
- Canva connector workflow - optional visual-CV generation path in `modes/pdf.md` and `modes/_shared.md`.
  - SDK/Client: External connector / MCP capability only; no local Canva package is installed in `package.json`
  - Auth: External connector credentials, not stored in repo files

## Data Storage

**Databases:**
- None
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local filesystem only
  - User/candidate inputs: `cv.md`, `article-digest.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`
  - Operational state: `data/pipeline.md`, `data/applications.md`, `data/scan-history.tsv`, `data/follow-ups.md`, `batch/batch-state.tsv`, `batch/tracker-additions/*.tsv`
  - Outputs: `reports/*.md`, `output/*.pdf`, `jds/*.md`

**Caching:**
- None
- `data/scan-history.tsv` in `scan.mjs` acts as a dedup/history ledger rather than a cache service.

## Authentication & Identity

**Auth Provider:**
- None
  - Implementation: Candidate identity is file-backed in `config/profile.yml`; public ATS endpoints in `scan.mjs` do not require credentials; separately authenticated tools such as `claude` CLI or the optional Canva connector are expected to manage auth outside the repo.

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Script stdout/stderr for `scan.mjs`, `doctor.mjs`, `verify-pipeline.mjs`, `cv-sync-check.mjs`, `followup-cadence.mjs`, and `update-system.mjs`
- Per-offer batch logs under `batch/logs/` from `batch/batch-runner.sh`
- File-based audit trails in `data/scan-history.tsv` and `batch/batch-state.tsv`

## CI/CD & Deployment

**Hosting:**
- Local-only CLI/TUI tool. No deployed web app, API server, or hosting platform config is present.

**CI Pipeline:**
- None detected under `.github/`; the repo contains issue templates, funding metadata, security contact docs, and a PR template, but no GitHub Actions workflow files.
- Manual verification path is `npm run verify`, `node test-all.mjs`, and `go build` inside `dashboard/`.

## Environment Configuration

**Required env vars:**
- None detected in the committed JavaScript or Go application code.
- Optional Nix-shell variables from `flake.nix`: `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`
- `.envrc` exists at the repo root for local shell setup; contents were not inspected.

**Secrets location:**
- No secrets directory or secret-loading code path was detected in the repository.
- External credentials are expected to live in the user's local CLI/tooling environment rather than checked-in files.

## Webhooks & Callbacks

**Incoming:**
- None detected. There is no HTTP server, webhook endpoint, or callback listener in `*.mjs`, `dashboard/**/*.go`, or `.github/`.

**Outgoing:**
- None as webhook callbacks.
- The codebase uses pull-style outbound requests only: ATS job-feed fetches in `scan.mjs`, GitHub version/release reads in `update-system.mjs`, and browser navigation to public job pages in `check-liveness.mjs`.

---

*Integration audit: 2026-04-11*
