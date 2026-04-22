# Research Summary — JobEngine v2

**Inputs:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH (Electron/Anthropic/caching verified against official docs; VC scraping per-firm behavior verified for 2 of 10 firms, flagged for Phase 5 probing)

---

## Executive Summary

JobEngine v2 is a **third client** layered onto the existing file-backed system — not a rewrite. The filesystem (cv.md, modes/, data/, reports/, config/) stays canonical; the Electron GUI, the existing Go TUI, and the `claude -p` batch path all read/write the same artifacts. Every architectural decision flows from this: concurrent-write safety is a day-one requirement, VC scraping must be runnable standalone (not Electron-coupled), and the Anthropic SDK lives in the Electron main process only.

The dominant risks are: (1) data corruption from GUI+batch racing on `applications.md`, (2) prompt caching failing silently because developers don't verify `cache_read_input_tokens`, and (3) VC scrapers returning empty results because most portfolio pages are Next.js SPAs where data lives in `__NEXT_DATA__` JSON blobs, not the rendered DOM.

---

## Recommended Stack

### Core

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| App shell | Electron | `^41.2.2` | Latest stable; pre-41.2 has unpatched CVE-2026-34780. ESM `.mjs` native. |
| UI framework | React + TypeScript | React `^18.3`, TS `^5.6` | Best Electron/IPC ecosystem; typed cache_control + usage. |
| Build tooling | electron-vite | `^2.3` | More mature than Electron Forge's experimental Vite plugin. |
| Packaging | electron-builder | `^25` | 250× more weekly downloads than Forge. |
| Anthropic SDK | `@anthropic-ai/sdk` | `^0.90.0` | Native streaming + cache_control. Main process only. |
| Styling | Tailwind CSS | `^3.4` | Fast dashboard build. |
| List virtualization | react-window | latest | Mandatory for 740+ tracker rows. |

### Scraping (two-tier)

- **Default:** `undici` + `cheerio` — for server-rendered pages (a16z, Sequoia confirmed static)
- **Fallback:** `playwright` (existing dep) — spawn via `child_process.fork()`, never in Electron main process
- **Decision rule per firm:** Cheerio → `__NEXT_DATA__` JSON blob → underlying JSON API → Playwright (document per-firm in adapter header)

### Concurrency + Persistence

| Library | Purpose |
|---------|---------|
| `chokidar ^5.0` | Watch cv.md, _profile.md, _shared.md, profile.yml. Fixes WSL `fs.watch` flakiness. |
| `proper-lockfile` | Lock applications.md around read-modify-write + report-number allocation. |
| `write-file-atomic` | All writes to applications.md and reports. |
| `keytar ^7.9` / Electron `safeStorage` | OS keychain for API key. Use one, not both. |
| `zod ^3.23` | Validate every IPC payload (preload + main). |
| `p-limit` | Concurrency cap (3-5 max) for GUI evaluation path. |

### Things NOT to use
`node-fetch`, `puppeteer`, `axios`, `@electron/remote`, `electron-store` for secrets, any Electron < 41.2, chokidar v4, wrapping `claude -p` from Electron, Vercel AI SDK.

---

## Table Stakes Features

### CLI parity (non-negotiable)
1. Paste URL → streaming evaluation → report + PDF + tracker row in one action
2. A-G scoring report viewer rendered from `reports/*.md`
3. Application tracker view reading `data/applications.md`
4. Canonical status dropdown constrained to `templates/states.yml`
5. Batch evaluation runner with concurrency control
6. Portal scan trigger wrapping `scan.mjs`
7. Pipeline inbox reading `data/pipeline.md`
8. CV viewer + PDF regenerate button
9. Multi-language mode switcher (EN/DE/FR/JA/PT/RU)

### GUI-specific table stakes
10. Streaming evaluation output — tokens appear as Claude generates
11. Prompt caching with `cache_control` + visible cache-hit / cost counter
12. Cancel-in-flight button
13. Error surfacing for 429 / 500 / auth failures with retry
14. Command palette (Cmd-K) — every action keyboard-reachable

### Anti-features (deliberately NOT building)
Auto-apply/autofill, cloud sync, resume builder, email integration, Chrome extension, gamification, mobile app, modal-heavy workflows, 8-step onboarding wizards, upsells, secondary scoring system parallel to A-G.

---

## Key Architecture Decisions

1. **Filesystem remains the system of record.** No database. Electron is a third client over existing Markdown/YAML/TSV substrate.

2. **Anthropic SDK lives in the main process only.** API key never touches the renderer. IPC contract is narrow (`evaluateJob`, `scanVCPortfolios`, `getTracker`) — never a generic `runShell`.

3. **`contextBridge.exposeInMainWorld` with one function per operation.** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, CSP enforced. Zod validation in preload AND main.

4. **VC scraper is `scrape-vcs.mjs` at project root**, `child_process.fork()`'d from Electron main. Runnable standalone via `node scrape-vcs.mjs` — preserves cron + CLI path.

5. **Prompt cache hierarchy (stable → volatile):**
   - BP1: `modes/_shared.md`
   - BP2: `modes/oferta.md`
   - BP3: `cv.md` + `article-digest.md`
   - BP4: `config/profile.yml` + `modes/_profile.md`
   - JD stays in user turn (never cached)
   - Use `cache_control: { type: "ephemeral", ttl: "1h" }` for GUI path; 5-min default for `claude -p`.

6. **Concurrency contract for `applications.md`:**
   - New entries: GUI writes TSV to `batch/tracker-additions/` then invokes `merge-tracker.mjs`. NEVER direct writes for ADDs.
   - Updates: `proper-lockfile` + `write-file-atomic`.
   - Report-number allocation: locked via `reports/.counter`.

7. **Storage: `data/vc-companies.tsv`** — 7 columns: `domain  name  firm  discovered_date  last_seen_date  careers_url  funding_signal`. Not SQLite.

8. **Smart file reads via `data/.mtime-cache.json` sidecar.** New `lib/mtime-cache.mjs` with `readIfChanged(path, consumer)`.

9. **Dual API key storage:** `safeStorage` (GUI) + `ANTHROPIC_API_KEY` env var (CLI batch). Document in onboarding.

---

## Top Pitfalls to Avoid

1. **GUI + batch race on `applications.md` (CRITICAL)** — TSV-addition pattern + proper-lockfile + write-file-atomic. Never direct ADD writes from GUI.

2. **Prompt caching fails silently below token minimum (CRITICAL)** — Bundle `_shared + _profile + cv + article-digest` into prefix (3-8K tokens). Log `cache_creation_input_tokens` and `cache_read_input_tokens` every call. Assert non-zero on second call.

3. **Cache busts on any byte change in prefix (CRITICAL)** — Order stable-to-volatile. Don't auto-format cached files.

4. **VC portfolio SPAs return empty HTML (CRITICAL)** — Probe per firm before writing scraper. Try Cheerio → `__NEXT_DATA__` JSON → underlying API → Playwright.

5. **Streaming hides cache stats in wrong event (HIGH)** — Capture usage from `message_start`, NOT `message_stop`.

6. **API key leaks via IPC / errors / bundles (HIGH)** — `safeStorage`/`keytar` only. Strip auth headers from errors before logging.

7. **nodeIntegration/contextIsolation footgun (CRITICAL)** — Set secure baseline before ANY feature code. Add `electronegativity` to CI.

8. **Report number collision under concurrency (HIGH)** — Centralize allocation behind `proper-lockfile`'d counter file.

9. **Blocking main process with sync file I/O (HIGH)** — `fs.promises` everywhere. Use `ipcMain.handle` (async).

10. **10 concurrent scrapers trigger Cloudflare (HIGH)** — Serialize with 10-30s delays. Realistic UA. Respect robots.txt. Weekly cadence.

11. **Playwright bundled in Electron = 600MB + first-run failure (HIGH)** — Playwright off GUI critical path. Spawn from CLI-runnable standalone script.

12. **Streaming SSE overwhelms IPC per-token (MEDIUM)** — Batch deltas on 50ms timer. Renderer uses `requestAnimationFrame`.

---

## Build Order Recommendation

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 7
                └──→ Phase 5 → Phase 6
```

| Phase | Focus | Key exit criterion |
|-------|-------|--------------------|
| 1 | Electron shell + read-only views | App renders same data as Go dashboard, zero writes |
| 2 | Write operations + concurrency hardening | Zero corruption across 100+ interleaved GUI+batch operations |
| 3 | Anthropic SDK + prompt caching + streaming | Second eval within 1hr shows `cache_read_input_tokens > 0` |
| 4 | Smart file reads (mtime cache) | N+1 eval with no context changes reads zero prefix bytes |
| 5 | VC portfolio scraper (`scrape-vcs.mjs`) | ≥500 deduped companies across 10 firms |
| 6 | Company filtering pipeline | ≥10 matches with funding within 12 months surfaced |
| 7 | PDF generation + power-user polish | Keyboard path for every action, PDF in one click |

Phases 3-4 and 5-6 parallelizable after Phase 2.

---

## Phases Needing Deeper Research

| Phase | Research flag | Why |
|-------|---------------|-----|
| Phase 5 | **Yes** — per-firm DOM probing | Only a16z + Sequoia confirmed static. 8 firms need inspection. |
| Phase 6 | **Yes** — funding-detection signals | Crunchbase (paid) vs. heuristics. Needs decision memo. |
| Phases 1, 2, 3, 4, 7 | No | Standard patterns, fully documented. |

---

## Open Questions

1. **Go TUI dashboard:** Coexist (TUI for headless/SSH, Electron for day-to-day) — no retirement needed.
2. **Reports user-editable?** Read-only in Phase 1; inline editing later if requested.
3. **Electron auto-update?** Defer to v2.1. Manual GitHub Releases for v2.0.
4. **Funding-signal source?** Open — Crunchbase vs. heuristics (RSS + press-release probes). Decide during Phase 6 planning.
5. **Cache TTL for `claude -p` batch path?** Non-blocking. Electron is primary cache beneficiary; batch keeps 5-min default.

---

*Generated: 2026-04-21 from 4 parallel research agents*
