# Requirements — JobEngine v2

## v2 Requirements

### ELEC — Electron App

- [ ] **ELEC-01**: User can launch a local Electron desktop app that opens the job search pipeline (secure baseline: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP, narrow `contextBridge`)
- [ ] **ELEC-02**: User can view the full application tracker — all rows from `data/applications.md` — with virtualized rendering for 740+ entries
- [ ] **ELEC-03**: User can edit the canonical status of any tracker row using a dropdown constrained to `templates/states.yml` values
- [ ] **ELEC-04**: User can open and read any evaluation report from `reports/*.md` rendered as formatted markdown
- [ ] **ELEC-05**: User can view and manage the pipeline inbox (`data/pipeline.md`) — see pending URLs and remove processed entries
- [ ] **ELEC-06**: User can view their CV (`cv.md`) and regenerate the PDF in one click (invokes `generate-pdf.mjs`)
- [ ] **ELEC-07**: User can trigger a portal scan from the GUI (invokes `scan.mjs`) and trigger batch evaluation runs
- [ ] **ELEC-08**: All GUI write operations use concurrent-write safety — `proper-lockfile` + `write-file-atomic`; new tracker entries always go through the TSV-addition pattern (`batch/tracker-additions/` + `merge-tracker.mjs`), never direct writes to `applications.md`

### API — Anthropic Integration

- [ ] **API-01**: User can paste a job URL into the GUI and receive a streaming A-G evaluation report — tokens appear in real time as Claude generates them
- [ ] **API-02**: Evaluation uses Claude prompt caching (`cache_control: { type: "ephemeral", ttl: "1h" }`) on the stable context prefix (`_shared.md` → `oferta.md` → `cv.md` → `article-digest.md` → `_profile.md`); cache-hit status and per-evaluation token cost are visible in the UI
- [ ] **API-03**: User can cancel an in-flight evaluation, and the UI surfaces 429 / 500 / auth errors with a retry option
- [ ] **API-04**: User can configure their Anthropic API key through the GUI — stored via `safeStorage` (or `keytar`) for the GUI path; CLI batch path continues to use `ANTHROPIC_API_KEY` env var
- [ ] **API-05**: Context files (`cv.md`, `modes/_profile.md`, `modes/_shared.md`, `config/profile.yml`) are only re-read when their modification time has changed since the last evaluation (`lib/mtime-cache.mjs` sidecar at `data/.mtime-cache.json`)

### VC — Portfolio Discovery

- [ ] **VC-01**: System can scrape portfolio pages from 10 VC firms (a16z, Sequoia, Benchmark, Accel, General Catalyst, Coatue, Founders Fund, Khosla, Index, Lightspeed) via standalone `scrape-vcs.mjs` — runnable from CLI (`node scrape-vcs.mjs`) and from Electron GUI; output written to `data/vc-companies.tsv`
- [ ] **VC-02**: Scraper runs on a monthly cadence by default (configurable); respects robots.txt, serializes requests with delays, and stores a per-firm baseline count to alert on unexpected drops
- [ ] **VC-03**: System can filter discovered companies to those with funding announced within the last 12 months AND active job listings matching the user's target roles from `config/profile.yml`
- [ ] **VC-04**: User can browse filtered VC companies in a discovery view in the Electron GUI — company name, firm, funding signal, and a "Promote to pipeline" button that adds the company's careers URL to `data/pipeline.md`
- [ ] **VC-05**: User can see scraper health in the GUI — per-firm last-run timestamp, company count, and an alert when a firm's count drops >20% (DOM drift signal)

---

## v2 Deferred (v3+)

- Inline report editing in GUI — read-only in v2
- Electron auto-update (`electron-updater`) — manual GitHub Releases for v2.0
- Funding detection via Crunchbase API — heuristics (RSS, press releases, blog probes) in v2
- Interview prep panel in GUI
- Response-rate analytics dashboard
- Global paste-to-evaluate (OS-level shortcut)
- Go TUI deprecation — coexists with Electron

---

## Out of Scope

- Auto-submit applications — user always reviews before Submit (ethical constraint from v1)
- Cloud sync or remote state — all data stays local
- Mobile app — desktop-only (Electron)
- Command palette, OS notifications, vim shortcuts — not needed per user
- Multi-language mode support in GUI — English-only; existing non-English mode files remain in the repo but are not surfaced in the Electron app
- SQLite or any database — file-backed state preserved

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| ELEC-01 | Phase 1 — Electron Shell |
| ELEC-02, ELEC-03, ELEC-04, ELEC-05 | Phase 1 — Electron Shell |
| ELEC-08 | Phase 2 — Write Safety |
| ELEC-06, ELEC-07 | Phase 3 — CLI Parity |
| API-01, API-02, API-03, API-04 | Phase 3 — Anthropic Integration |
| API-05 | Phase 4 — Smart File Reads |
| VC-01, VC-02 | Phase 5 — VC Scraper |
| VC-03 | Phase 6 — Company Filtering |
| VC-04, VC-05 | Phase 6 — VC Discovery UI |

---

## Validated (from v1 — existing capabilities)

- ✓ Job offer evaluation with A–F/G scoring — `modes/oferta.md`
- ✓ CV generation: HTML→PDF via Playwright — `generate-pdf.mjs`
- ✓ Application tracker (Markdown table + TSV merge) — `data/applications.md`, `merge-tracker.mjs`
- ✓ Batch processing: parallel evaluations via `claude -p` — `batch/batch-runner.sh`
- ✓ Portal scanning: Greenhouse/Ashby/Lever APIs, zero LLM cost — `scan.mjs`
- ✓ Pipeline/status tracking with canonical states — `templates/states.yml`
- ✓ Multi-language modes (EN, DE, FR, JA, PT, RU) — `modes/*/`
- ✓ Pattern analysis and follow-up cadence — `analyze-patterns.mjs`, `followup-cadence.mjs`
- ✓ Go TUI dashboard (Bubble Tea) — `dashboard/`
- ✓ Offer liveness verification — `check-liveness.mjs`, `liveness-core.mjs`
- ✓ Update system — `update-system.mjs`
- ✓ Pipeline health checks — `verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs`
