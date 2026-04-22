# Technology Stack — JobEngine v2

**Project:** JobEngine v2 (Electron GUI + VC scraper + Claude prompt caching)
**Researched:** 2026-04-21
**Overall confidence:** HIGH (all recommendations verified against official docs or current-year sources)

---

## Executive Summary

Add an Electron 41.x desktop shell on top of the existing Node.js 18+ `.mjs` codebase. Render the UI with React 18 + TypeScript via `electron-vite` tooling, package with `electron-builder`. Keep the Anthropic SDK (`@anthropic-ai/sdk` ≥ 0.90.0) in the main process only, wire it to the renderer through a narrow `contextBridge` IPC surface, and use `cache_control: { type: "ephemeral" }` on the system block that contains `cv.md` + `modes/_profile.md` + `modes/_shared.md` to cut repeated-evaluation cost ~90%. Watch those same context files with `chokidar` v5 to invalidate in-memory state and trigger re-caching. For VC portfolio scraping, use a two-tier strategy: `undici` + `cheerio` as the default (fast, server-rendered pages like a16z and Sequoia), fall back to the already-installed Playwright only for firms that ship JS-rendered SPAs.

This stack fully preserves the existing Node `.mjs` layer, the Go + Bubble Tea TUI, and the `claude -p` batch path.

---

## Recommended Stack

### Core Framework — Electron

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | **41.2.2** (or latest `^41`) | Desktop app shell | Latest stable as of 2026-04-21 (Chromium 146, Node 24.14.1). ESM / `.mjs` support has been production-ready since Electron 28; your existing `.mjs` modules drop in to the main process without conversion. |
| Node.js (bundled) | 24.14.1 | Runtime inside Electron main | Comes with Electron 41; your source-tree requirement of Node 18+ is well within this. |

**Electron version pinning:** pin to `^41.2.2` in `package.json`. Electron 39, 40, and early 41 had a `contextBridge` VideoFrame CVE (CVE-2026-34780) patched in 41.0.0-beta.8 / 41.x stable — don't ship pre-41.2.

### UI Framework — React 18 + TypeScript

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | ^18.3 | Renderer UI | Most common 2026 Electron stack. Solves real problems for this app: type-safe IPC contracts, reusable status/score/tracker components. You will build non-trivial UI (dashboard, evaluation detail view, VC pipeline list, tracker) — vanilla HTML would re-invent component boundaries. |
| TypeScript | ^5.6 | Type safety for IPC + Anthropic API shapes | Catches IPC shape mismatches at compile time. The Anthropic SDK ships `.d.ts` — you get typed `cache_control` payloads and typed `usage` responses for free. |
| Tailwind CSS | ^3.4 | Styling | Fast to build a clean dashboard, no CSS file sprawl, plays nicely with existing Markdown-rendered content (`marked` or `react-markdown`). |
| react-markdown | ^9 | Render `reports/*.md` and `cv.md` | You already store reports as Markdown; no conversion step. |
| lucide-react | ^0.400 | Icon set | Matches your existing clean aesthetic. |

**Rationale for React over Svelte/Vue/vanilla:**
- React has the largest Electron ecosystem and best IPC/TypeScript patterns documented.
- Svelte is lighter (~30KB vs ~130KB) but the component ecosystem is smaller and you lose the type-integration story. For a GUI that will grow (dashboard, detail pane, apply mode, interview prep), the React ecosystem advantage outweighs bundle size on a local desktop app.
- Vanilla HTML is tempting given the existing `.mjs` codebase, but this app has real state (live Anthropic streams, file watchers, VC scraper results, pipeline queues) — re-inventing state management by hand is a larger cost than learning React basics.

### Build & Tooling — electron-vite

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-vite | ^2.3 | Dev server + bundler for main, preload, renderer | Vite is dramatically faster than Webpack for HMR; `electron-vite` handles all three Electron contexts out of the box with sensible defaults. |
| Vite | ^5.4 | Underlying bundler | Bundled through electron-vite. |

**Why `electron-vite` and not Electron Forge + Vite plugin:** Electron Forge's Vite plugin was still marked experimental as of Forge v7.5 — `electron-vite` (the standalone project at electron-vite.org) is the mature, non-experimental path in 2026 and is what most new projects use. Use it for dev + build; use `electron-builder` (below) for packaging only. They compose cleanly.

### Packaging — electron-builder

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-builder | ^25 | Produce `.dmg` / `.exe` / `.AppImage` installers | ~1.5M weekly downloads vs electron-forge's ~2K (250× more). Mature auto-update support (`electron-updater`), signing, notarization, multi-platform targets in one config block. |

**Why not Electron Forge:** Forge is the "officially recommended" tool but adoption numbers tell the real story — production apps overwhelmingly use `electron-builder`. For a single-developer project shipping cross-platform installers, `electron-builder`'s YAML config is simpler than Forge's multi-package makers/publishers architecture.

### Anthropic Integration

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | **^0.90.0** (released 2026-04-16) | All Claude API calls from Electron main | Use `client.messages.create` for non-streaming (batch-style evaluations) and `client.messages.stream` for live token streaming into the renderer. |

**SDK placement:** Instantiate exactly once, in the main process, behind an IPC handler. **Never** in renderer or preload — that would expose the API key to the DOM.

**Prompt caching contract (verified from platform.claude.com docs):**

```typescript
// main/anthropic-client.ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6", // 2048-token minimum for caching
  max_tokens: 4096,
  system: [
    {
      type: "text",
      text: cvContent + profileContent + sharedModeContent, // ≥ 2048 tok
      cache_control: { type: "ephemeral" } // 5-min TTL, default pricing
    },
    {
      type: "text",
      text: oferta_mode_prompt, // shorter, evaluation-specific
      cache_control: { type: "ephemeral" } // 2nd breakpoint
    }
  ],
  messages: [{ role: "user", content: jobDescription }]
});

// Cache hit visibility
console.log(response.usage);
// { input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens }
```

**Key constants for this project:**
- Minimum tokens per cache breakpoint: **1024 for Claude Sonnet 4.5/3.7, 2048 for Sonnet 4.6, 4096 for Opus 4.x and Haiku 4.5**. Check `cv.md + _profile.md + _shared.md` concatenated size; on the current codebase that exceeds 2048 comfortably.
- TTL: default 5-minute (free), or `ttl: "1h"` (costs 2× base input). **Anthropic silently dropped the default from 1h to 5min on 2026-03-06** — if an evaluation batch spans >5min between calls, either use `ttl: "1h"` or re-send cache blocks within the window.
- Up to 4 cache breakpoints per request — use for hierarchy: (1) CV+profile+shared, (2) mode prompt, (3) optional article-digest, (4) per-call JD.
- Cache reads cost 10% of base input tokens; cache writes cost 125% (5-min) / 200% (1h). Break-even after ~2 reads.
- Surface `response.usage.cache_read_input_tokens` in the UI so Chris sees cache efficacy.

**Workspace isolation (effective 2026-02-05):** Cache is now isolated per workspace within an org. Single-user local app = non-issue, just be aware.

### Scraping — Two-Tier Strategy

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `undici` | ^6.20 (bundled with Node 18+) | HTTP fetch for static pages | Default for all VC scrapes; 2-3× faster than `node-fetch`, built-in. |
| `cheerio` | ^1.0 | jQuery-like HTML parser | Default parser — zero-browser overhead, ~20-40% faster than Puppeteer for static content. Use for a16z, Sequoia, Accel and any firm that server-renders. |
| `playwright` | existing (already installed) | Fallback for JS-rendered portfolio pages | Use only when `cheerio` returns an empty company list. Already a project dep for PDF generation — no new install. |

**Per-firm rendering mode (confirmed by WebFetch):**
- **a16z.com/portfolio** — server-rendered static HTML. Cheerio. ✓
- **sequoiacap.com/our-companies** — server-rendered static HTML with full table. Cheerio. ✓
- **accel.com**, **benchmark.com**, **generalcatalyst.com**, **coatue.com**, **foundersfund.com**, **khoslaventures.com**, **indexventures.com**, **lsvp.com** — assume a mix; each firm scraper should try Cheerio first, log "empty result" and fall through to Playwright if no companies parsed. Detect-then-escalate keeps the common path cheap.

**Anti-patterns:**
- Don't use Playwright as the default — it's 5-10× slower per page and burns memory for a 10-firm scan.
- Don't use Puppeteer — Playwright is strictly a superset (cross-browser, better selectors) and you already have it. Two browser automation libs = maintenance tax.

### File Watching — chokidar v5

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| chokidar | **^5.0** (Nov 2025 release) | Watch `cv.md`, `modes/_profile.md`, `modes/_shared.md`, `config/profile.yml` | Cross-platform reliable events where raw `fs.watch` is flaky on macOS/Linux (duplicate events, missed renames). v5 is ESM-only, requires Node ≥ 20 — matches Electron 41's Node 24 runtime perfectly. |

**Usage pattern:**
```javascript
// main/context-watcher.mjs
import chokidar from 'chokidar';
const contextFiles = ['cv.md', 'modes/_profile.md', 'modes/_shared.md'];
const watcher = chokidar.watch(contextFiles, { ignoreInitial: true });
watcher.on('change', (path) => {
  invalidateContextCache(path);      // clear in-memory concat
  bumpCacheBreakpointKey();          // next Anthropic call rebuilds cache
});
```

**Why not `fs.watch`:** Known flaky on macOS (duplicate events) and on WSL (what Chris appears to be on — `Linux 6.6.87.2-microsoft-standard-WSL2`). Chokidar normalizes these.

**Why not `node --watch`:** That's for restarting the Node process, not for app-level change notifications.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `js-yaml` | ^4.1 | Read `config/profile.yml`, `portals.yml`, `templates/states.yml` | Already the ecosystem default. |
| `marked` or `react-markdown` | — | Render `reports/*.md` in renderer | Pick `react-markdown` if going React path (recommended); `marked` is fine for vanilla HTML. |
| `electron-store` | ^10 | Persist window size, API key reference, last-selected view | Tiny wrapper over JSON in `app.getPath('userData')`. Do **not** put user CV/reports in here — those stay in repo. |
| `keytar` | ^7.9 | OS-keychain storage for Anthropic API key | macOS Keychain / Windows Credential Vault / libsecret on Linux. Do NOT store API key in `electron-store` or config files. |
| `zod` | ^3.23 | Runtime validation of IPC payloads and scraper output | Defensive — renderer ↔ main boundary deserves runtime checks even with TypeScript. |

### IPC Architecture (best-practice pattern for this app)

Security model per the Electron 41 docs:
1. `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` in every `BrowserWindow`.
2. Preload script exposes **one function per channel** via `contextBridge.exposeInMainWorld`. Never expose `ipcRenderer` itself.
3. API key never leaves main. Renderer calls `window.api.evaluateJob(jd)` → main handles Anthropic call + streaming → main sends token chunks back via `webContents.send`.

Minimum surface:
```javascript
// preload.mjs (MUST be .mjs — preload ignores package.json "type":"module")
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  evaluateJob:    (jd)       => ipcRenderer.invoke('evaluate:job', jd),
  scanVCPortfolios: ()       => ipcRenderer.invoke('scan:vcs'),
  getTracker:     ()         => ipcRenderer.invoke('tracker:read'),
  onStreamChunk:  (cb)       => {
    const handler = (_e, chunk) => cb(chunk);
    ipcRenderer.on('anthropic:stream', handler);
    return () => ipcRenderer.off('anthropic:stream', handler);
  },
  onContextFileChanged: (cb) => ipcRenderer.on('context:changed', (_e, p) => cb(p))
});
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| App shell | Electron 41 | Tauri 2 | Tauri is smaller/faster but uses Rust for the backend — throws away the existing `.mjs` Node layer (Playwright, generate-pdf.mjs, scan.mjs, all of dashboard/). Constraint says preserve Node. |
| UI framework | React 18 + TS | Svelte 5 | Smaller bundle but weaker Electron/IPC ecosystem; TypeScript story less mature. |
| UI framework | React 18 + TS | Vanilla HTML | Tempting for simplicity but the app has real state (streams, watchers, queues); re-implementing by hand will cost more long-term. |
| Build tool | electron-vite | Electron Forge + Vite plugin | Forge's Vite plugin still experimental as of v7.5; electron-vite is the mature standalone. |
| Packaging | electron-builder | Electron Forge | Forge is "official" but has 250× fewer weekly downloads; ecosystem/docs/SO answers all favor builder. |
| Scraping default | undici + cheerio | Playwright for all 10 | 5-10× speed advantage; a16z + Sequoia confirmed static. |
| Scraping fallback | Playwright | Puppeteer | Already a dep; strict superset. |
| File watching | chokidar v5 | fs.watch | Flaky on WSL/macOS; duplicate events. |
| File watching | chokidar v5 | Node `--watch` | Wrong abstraction — that's for process restart. |
| API key storage | keytar | electron-store / .env | Plaintext on disk = no-no. Keytar uses OS keychain. |
| Claude SDK | `@anthropic-ai/sdk` | Vercel AI SDK `@ai-sdk/anthropic` | AI SDK adds an abstraction layer but complicates raw `cache_control` usage patterns you need. Official SDK is simpler for this use. |
| Claude SDK | `@anthropic-ai/sdk` | Wrapping `claude -p` CLI | Loses streaming, loses prompt caching visibility, loses `response.usage` cache metrics — defeats the point. |

---

## Installation

```bash
# Core Electron + React
npm install electron@^41.2.2 react@^18.3 react-dom@^18.3 \
  @anthropic-ai/sdk@^0.90.0

# Dev + build tooling
npm install -D electron-vite@^2.3 vite@^5.4 \
  typescript@^5.6 @types/react @types/react-dom @types/node \
  electron-builder@^25 \
  tailwindcss@^3.4 postcss autoprefixer

# Scraping + watching + persistence
npm install cheerio@^1.0 chokidar@^5.0 \
  electron-store@^10 keytar@^7.9 \
  js-yaml@^4.1 zod@^3.23 \
  react-markdown@^9 lucide-react
# (Playwright already installed — reused from existing generate-pdf.mjs path)
```

**package.json additions:**
```json
{
  "type": "module",
  "main": "out/main/index.mjs",
  "scripts": {
    "dev":     "electron-vite dev",
    "build":   "electron-vite build",
    "package": "electron-vite build && electron-builder",
    "package:mac":   "electron-vite build && electron-builder --mac",
    "package:win":   "electron-vite build && electron-builder --win",
    "package:linux": "electron-vite build && electron-builder --linux"
  }
}
```

---

## Conflict Check: Existing `.mjs` Codebase

| Existing file | Electron compatibility | Action |
|---------------|------------------------|--------|
| `generate-pdf.mjs` (Playwright) | ✓ Runs in main process as-is | Import directly; or spawn as child process to isolate memory. |
| `scan.mjs` (portal API scanner) | ✓ Runs in main process as-is | Wire to an IPC channel `scan:portals`. |
| `check-liveness.mjs` | ✓ | Wire to IPC. |
| `merge-tracker.mjs`, `analyze-patterns.mjs`, `followup-cadence.mjs` | ✓ All pure Node | Wire to IPC. |
| `dashboard/` (Go + Bubble Tea) | ✓ Unchanged | Stays as a separate binary the user can still launch; Electron app is an alternative, not a replacement. |
| `batch/batch-runner.sh` + `claude -p` | ✓ Unchanged | Headless batch path preserved per constraint. |
| `modes/*.md`, `cv.md`, `config/*.yml` | ✓ | Read at runtime by main; watched by chokidar. |

**No `.mjs` incompatibilities.** Electron 28+ ESM support is solid; preload scripts must use `.mjs` extension (they ignore `"type": "module"`), which is a minor file-naming rule, not a conversion.

---

## Things NOT to Use (and why)

| Avoid | Why |
|-------|-----|
| `node-fetch` | `undici` built into Node 18+ is faster and has no extra install. |
| `puppeteer` | Playwright (already present) is a superset. |
| `request` / `axios` | `undici` or native `fetch` suffices; extra dep for no gain. |
| `electron-is-dev` | Read `import.meta.env.DEV` (Vite) or `app.isPackaged`. |
| Wrapping the Claude Code CLI (`claude -p`) from Electron | Loses streaming, caching metrics, and native error handling. Use the SDK. |
| Storing API key in `.env` / `electron-store` | Use `keytar` (OS keychain). |
| `nodeIntegration: true` in BrowserWindow | Massive security footgun — render untrusted Markdown with full Node access. Use `contextBridge`. |
| `remote` module | Deprecated and removed. |
| Electron < 41.2 | Unpatched CVE-2026-34780 (contextBridge VideoFrame bypass). |
| `chokidar` v4 or lower | v5 is current; v5 is ESM-only which matches your `.mjs` codebase. |

---

## Sources

- [Electron ESM tutorial](https://www.electronjs.org/docs/latest/tutorial/esm) — main process `.mjs`, preload rules
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — contextBridge patterns
- [Electron security best practices](https://www.electronjs.org/docs/latest/tutorial/security) — contextIsolation, sandbox
- [Electron 39 release notes](https://www.electronjs.org/blog/electron-39-0) — latest series context
- [Electron releases index](https://releases.electronjs.org/) — confirmed 41.2.2 as current (2026-04-21)
- [CVE-2026-34780 advisory](https://github.com/electron/electron/security/advisories/GHSA-jfqg-hf23-qpw2) — contextBridge VideoFrame CVE, patched in 41.2
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — cache_control, token minimums, usage fields
- [@anthropic-ai/sdk on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — 0.90.0 as of 2026-04-16
- [Anthropic SDK TypeScript repo](https://github.com/anthropics/anthropic-sdk-typescript)
- [Anthropic TTL change 1h→5min, 2026-03-06](https://dev.to/whoffagents/anthropic-silently-dropped-prompt-cache-ttl-from-1-hour-to-5-minutes-16ao)
- [Claude cookbooks prompt_caching.ipynb](https://github.com/anthropics/anthropic-cookbook/blob/main/misc/prompt_caching.ipynb)
- [chokidar v5 (npm)](https://www.npmjs.com/package/chokidar) — ESM-only, Node ≥ 20
- [electron-vite](https://electron-vite.org/) — Vite-based tooling
- [electron-builder vs electron-forge download trends](https://npmtrends.com/electron-builder-vs-electron-forge) — 1.5M vs 2K weekly
- [Cheerio vs Puppeteer perf (Proxyway 2026)](https://proxyway.com/guides/cheerio-vs-puppeteer-for-web-scraping)
- [Electron Forge "Why Forge"](https://www.electronforge.io/core-concepts/why-electron-forge) — context for the official position

**Confidence per finding:**
- Electron version, ESM rules, IPC pattern: **HIGH** (official docs)
- Anthropic SDK version, prompt caching API shape, token minimums, usage fields: **HIGH** (official Anthropic docs + SDK repo, verified 2026-04)
- 5-minute TTL default change: **HIGH** (official behavior change, multiple sources)
- electron-builder vs forge recommendation: **MEDIUM-HIGH** (adoption numbers clear; "official" position weighs against but production reality dominates)
- chokidar v5 over fs.watch: **HIGH** (official project docs + Vite team's own discussion of edge cases)
- Per-firm VC scraping mode (a16z, Sequoia = static): **MEDIUM-HIGH** (direct WebFetch inspection of two firms; extrapolated expectation for the other 8 — flag a Phase task to verify each firm's DOM before writing the scraper)
- React over Svelte/vanilla: **MEDIUM** (opinion, defensible, but team preference could override)
