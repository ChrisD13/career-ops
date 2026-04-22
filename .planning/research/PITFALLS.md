# Domain Pitfalls — JobEngine v2

**Domain:** Electron desktop app + VC portfolio scraping + Anthropic API with prompt caching, layered on an existing Node.js/Markdown file-backed system
**Researched:** 2026-04-21
**Overall confidence:** MEDIUM-HIGH (official docs + community + verified 2026 changes)

This document catalogues pitfalls specific to JobEngine v2's architecture: a preserved Markdown/YAML file-backed state (cv.md, config/, data/, reports/) that must stay writable by both a new Electron GUI AND the existing `claude -p` headless batch runner, while adding live VC portfolio scraping and direct Anthropic API calls with prompt caching.

Pitfalls are organized by domain, then by severity. Each item includes warning signs, prevention strategy, and the phase/component that should own it.

---

## 1. Electron Pitfalls

### CRITICAL: Pitfall 1.1 — Leaving `nodeIntegration: true` or `contextIsolation: false` in the renderer

**What goes wrong:** The renderer (which may load remote HTML for job postings, PDF previews of CVs, or scraped VC pages inside a `<webview>` or even just for debugging) gains direct access to `require()`, `fs`, `child_process`, and the entire Node API. Any XSS, any markdown parser bug, any bad HTML served from a JD URL becomes Remote Code Execution on the user's machine.

**Why it happens:** It is the path of least resistance when prototyping — IPC plumbing is slower to write than `require('fs')` in the renderer.

**Consequences:** Malicious job posting HTML could read `cv.md`, exfiltrate `~/.ssh`, or drop a reverse shell. Because JobEngine reads URLs from `pipeline.md` and renders JDs, the attack surface is real.

**Warning signs:**
- `BrowserWindow` created with `webPreferences: { nodeIntegration: true }`
- No `preload.js` script, or preload uses `window.X = require(...)` directly instead of `contextBridge.exposeInMainWorld`
- Renderer code contains `require(`, `process.`, `__dirname`, or `fs.`
- `enableRemoteModule: true` or any use of `@electron/remote`
- Linting with `eslint-plugin-electron` not configured

**Prevention:**
- Enforce the secure baseline from the start: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`
- Use `contextBridge.exposeInMainWorld` in a preload script to expose **one narrow function per operation** (`window.jobengine.readCv()`, not `window.fs`)
- Add a strict Content-Security-Policy header; block `eval`, inline scripts, and external origins except api.anthropic.com and the VC portfolio hosts
- Add `electronegativity` or similar static analyzer to CI

**Which phase owns it:** Electron bootstrap phase — must be set before any feature code is written; retrofitting is costly.

---

### CRITICAL: Pitfall 1.2 — Treating IPC as an internal channel instead of a trust boundary

**What goes wrong:** Preload exposes `window.jobengine.runShell(cmd)` or `window.jobengine.writeFile(path, contents)` as a generic passthrough. An injected script in the renderer (via a JD page rendered in a `<webview>`) can now run arbitrary shell or overwrite `cv.md`.

**Why it happens:** Developers think "it's my own app, the renderer is trusted." It isn't — any HTML that ever loads in the renderer (JD previews, future webviews) is attacker-controlled input.

**Consequences:** Silent overwrite of applications tracker, CV corruption, arbitrary command execution via the Playwright scraper subprocess.

**Warning signs:**
- IPC handlers that accept free-form arguments (paths, commands, URLs) without allow-list validation
- Handler naming like `exec`, `run`, `write`, `read` (too generic)
- No Zod/Joi/Valibot schema on `ipcMain.handle` payloads
- Preload API surface larger than ~20 named functions

**Prevention:**
- One IPC channel = one operation with a fixed schema (`evaluate-offer`, `scan-vcs`, `render-cv-pdf`) — never `run-anything`
- Validate every IPC payload with a schema; reject unknown fields
- Path arguments from renderer → sanitize against an allow-list of project-root-relative paths (never absolute, never `..`)
- Treat IPC handlers like HTTP endpoints: assume payload is hostile

**Which phase owns it:** Electron IPC layer phase, before wiring Anthropic API or file I/O.

---

### HIGH: Pitfall 1.3 — Bundling Playwright inside Electron blows up distribution size and breaks on first run

**What goes wrong:** Playwright's `@playwright/test` package is ~50MB, and the browser binaries (Chromium ~170MB, Firefox ~90MB, WebKit ~60MB) are downloaded post-install to `~/.cache/ms-playwright`. In a packaged Electron app, the cache directory is wrong, the binaries are missing, or `electron-builder` mis-handles them in the asar archive.

**Why it happens:**
- Native modules and browser binaries cannot live inside `app.asar` — they need `asar.unpack` globbing
- `electron-builder` by default includes all `dependencies` (not `devDependencies`) in the bundle
- `playwright` expects to download browsers at install time; in a signed/notarized app, `npx playwright install` cannot run post-install on the user's machine

**Consequences:** App ships at ~600MB+, first-run error "browserType.launch: Executable doesn't exist," or silent failure in scraping with no user-visible error.

**Warning signs:**
- Packaged `.dmg`/`.exe` size >300MB without explanation
- Playwright works in `npm run dev` but fails in `npm run pack`
- User reports "scanning does nothing" on fresh install
- `PLAYWRIGHT_BROWSERS_PATH` not set

**Prevention:**
- **Do NOT bundle Playwright browsers inside the Electron app.** Instead:
  - Keep Playwright on the CLI/batch path only (`claude -p` + `scan.mjs` already use it)
  - The Electron GUI should use `fetch` + Cheerio for VC scraping when pages are server-rendered, and only spawn Playwright as a child process (via `child_process.spawn`) when JS rendering is strictly required
- If Playwright must be bundled: set `PLAYWRIGHT_BROWSERS_PATH=0` to co-locate browsers with the package, add `asarUnpack: ["**/node_modules/playwright-core/**"]` to electron-builder config, and document that only Chromium is shipped (not Firefox/WebKit)
- Verify on first run that browsers exist; fall back to Cheerio-only scraping with a user warning if not

**Which phase owns it:** VC scraper phase + packaging phase — design the scraper so Playwright is optional from day one.

---

### HIGH: Pitfall 1.4 — Blocking the main process with synchronous file I/O on Markdown state

**What goes wrong:** The main process handles an IPC request by reading `data/applications.md` (100KB+), parsing it, writing it back synchronously. The renderer UI freezes for 200-800ms on every evaluation. Squirrel.Mac auto-update checks, Anthropic streaming callbacks, and window events all back up behind it.

**Why it happens:** Developers reach for `fs.readFileSync` in main-process handlers because it's simpler than async. The main process is single-threaded in its event loop; a blocked main process blocks the renderer.

**Consequences:** UI freezes ("Application not responding" dialog on Windows, beachball on macOS). Streaming token deltas from Anthropic stop rendering because main can't forward them.

**Warning signs:**
- `readFileSync`/`writeFileSync` anywhere in `main/` or IPC handlers
- User reports "laggy when I mark applied"
- DevTools Performance shows main-process stalls >100ms
- Streaming evaluations freeze mid-response

**Prevention:**
- Use `fs.promises` everywhere in main process; never `*Sync` variants outside startup
- Move CPU-heavy parsing (regenerating applications.md from TSV merges) into a Worker Thread or a dedicated utility process
- Keep the file-backed state artifacts reasonably small; if applications.md grows to MB-scale, switch to line-appended TSV for the hot path and regenerate Markdown view lazily
- Use `ipcMain.handle` (async) instead of `ipcMain.on` (sync `event.returnValue`)

**Which phase owns it:** Electron main-process architecture phase.

---

### HIGH: Pitfall 1.5 — Anthropic API key stored in plaintext in config or localStorage

**What goes wrong:** Key ends up in `config/profile.yml`, `~/.config/jobengine/settings.json`, `localStorage`, or worse — baked into the app bundle. Sync tools (Dropbox, iCloud), backups, and ARM32 keychain fallback all leak it.

**Why it happens:** `safeStorage`/`keytar` ergonomics are worse than `fs.writeFile`. `electron-store` has an "encryption" option that is security theatre (the key is stored in the bundle).

**Consequences:** API key theft → uncontrolled spend on attacker's evaluations. For a user who evaluated 740+ offers, the bill matters.

**Warning signs:**
- `ANTHROPIC_API_KEY` appears in any file under `config/` or the app's userData dir in plaintext
- Use of `electron-store` with an `encryptionKey` option (the key is in your bundle; trivially broken — see Jesse Li's writeup)
- Key visible in DevTools Application → Storage
- Key committed to git (even in a `.env.example`)

**Prevention:**
- Use Electron's built-in `safeStorage` (backed by macOS Keychain, Windows DPAPI, Linux libsecret/kwallet)
- Flow: user enters key once → `safeStorage.encryptString(key)` → persist ciphertext → decrypt in main process only, never expose via IPC to renderer
- For the `claude -p` batch path which can't use safeStorage (different process tree), read from environment variable only; document that GUI and CLI use different storage
- On Linux, detect if `safeStorage.isEncryptionAvailable()` returns false (no keychain) and warn the user that storage will be plaintext; offer env-var fallback
- Never send the raw key over IPC to the renderer — renderer asks main to "evaluate this JD"; main owns the key

**Which phase owns it:** Anthropic integration phase, before first API call from the GUI.

---

### MEDIUM: Pitfall 1.6 — Streaming Anthropic responses bog down on IPC event flood

**What goes wrong:** Anthropic SSE stream emits ~30-60 token deltas per second. Each delta is forwarded via `webContents.send('stream-chunk', delta)`. Main process serializes every event, renderer's `ipcRenderer.on` handler re-renders the whole markdown block. UI jank, CPU spike, streaming visibly lags behind actual generation.

**Why it happens:** IPC has per-message serialization overhead; sending thousands of small messages is much slower than batching.

**Prevention:**
- Batch deltas in main process on a 50ms timer (`requestAnimationFrame` analog); coalesce and forward accumulated text
- Use a MessagePort (`MessageChannelMain`) for high-frequency streaming instead of standard IPC — it bypasses the main-process event loop bottleneck
- Renderer should append text to a buffer and re-render via `requestAnimationFrame`, not on every IPC event
- Keep the Anthropic SDK call in the main process (or a utility process); never put the API key in the renderer even if you could

**Which phase owns it:** Anthropic streaming integration phase.

---

### MEDIUM: Pitfall 1.7 — Auto-update breaks on unsigned builds or missing notarization

**What goes wrong:** Squirrel.Mac requires a signed app for auto-update; unsigned builds fail silently. On macOS, the app must also be notarized (Apple's malware scan) — unnotarized apps show "cannot be opened" on first launch from Gatekeeper. Windows SmartScreen flags unsigned apps as "Unknown publisher" for weeks.

**Warning signs:**
- `autoUpdater` emits `error` with "Could not get code signature" or "The update is not signed"
- macOS users report "app is damaged and can't be opened"
- Windows users report SmartScreen warning
- Running `spctl --assess` on the `.app` returns "source=Unnotarized"

**Prevention:**
- On macOS: sign with a Developer ID Application cert + notarize with `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`, run on macOS runner in CI (cross-platform signing doesn't work for Mac)
- On Windows: use Azure Trusted Signing (cheapest 2025+ option) OR an EV code signing cert; avoid self-signed
- Test the update flow end-to-end on a staging release channel before shipping to real users
- Gate auto-update behind a feature flag for the first few releases (manual download only) to avoid bricking early adopters
- For a local-first personal tool, consider deferring auto-update entirely in v2.0 — ship manual updates via GitHub Releases, add auto-update in v2.1

**Which phase owns it:** Distribution/packaging phase (likely late in the roadmap).

---

## 2. VC Portfolio Scraping Pitfalls

### CRITICAL: Pitfall 2.1 — VC portfolio pages are SPAs; naive `fetch` returns empty HTML

**What goes wrong:** a16z's portfolio page (`a16z.com/portfolio`), Sequoia, Benchmark, and most modern VC sites are React/Next.js SPAs. A plain `fetch` + Cheerio returns a skeleton HTML with `<div id="__next"></div>` and zero portfolio data. The scraper silently reports "0 companies found" for weeks.

**Why it happens:** The actual portfolio list is fetched client-side via XHR after page load. Server-rendered HTML doesn't contain it.

**Warning signs:**
- Scraper output: "a16z: 0 companies" while page visibly shows hundreds
- Raw HTML response is <50KB and contains no company names
- HTML contains `_buildManifest.js` / `__NEXT_DATA__` / `window.__INITIAL_STATE__` scripts

**Prevention:**
- **Probe each VC firm individually** at scraper design time: run `curl https://site/portfolio | grep -c company-name` vs. a Playwright render. If server-side HTML contains the data, use Cheerio (fast, no browser). If not, use Playwright headless.
- Prefer **finding the underlying XHR/GraphQL endpoint** the SPA calls. Many VC sites call a JSON API like `/api/portfolio` — hit that directly with `fetch` (10x faster, no JS engine needed, more stable than DOM scraping). Check Network tab in DevTools.
- Look for `__NEXT_DATA__` JSON blob in the server-rendered HTML of Next.js sites — it often contains the full portfolio server-side even when the visible DOM is empty
- Build a per-firm adapter module (`scrapers/a16z.mjs`, `scrapers/sequoia.mjs`) so each can evolve independently
- Add a **selector health check**: if a previously-working scraper now returns <50% of last week's count, alert instead of silently writing bad data

**Which phase owns it:** VC scraper design phase — this is the foundational decision for the entire feature.

---

### HIGH: Pitfall 2.2 — Portfolio page structure changes silently break scrapers

**What goes wrong:** a16z rebrands portfolio page in Q3 2026, changes `.portfolio-item` to `[data-card-type="company"]`. Scraper returns empty. Pipeline shows "0 new companies from a16z" for weeks before anyone notices because the user stops paying attention to the scanner output.

**Why it happens:** VC sites get redesigned every 12-24 months. No stable contract. No API.

**Prevention:**
- **Maintain a baseline count per firm** (`scan-history.tsv` equivalent for VCs): if today's count drops >40% vs. 7-day rolling average, log a warning AND surface it in the GUI dashboard as "a16z scraper may be broken"
- Version each adapter (`scrapers/a16z.v3.mjs`) so regression to previous selector is a file revert
- Capture a snapshot HTML file on every failed parse (keep last 3) — makes debugging 10x faster
- Run scrapers on a relaxed cadence (weekly, not daily) so a broken scraper doesn't burn the user's attention; once-per-week gives you time to notice and fix
- Write one unit test per adapter against a pinned HTML fixture — catches breakage immediately, not "weeks later when I happen to look"

**Which phase owns it:** VC scraper maintenance + observability phase.

---

### HIGH: Pitfall 2.3 — Hitting 10 VC sites on the same cron tick looks like a bot and triggers Cloudflare

**What goes wrong:** `scan-vcs.mjs` runs, fires 10 concurrent Playwright sessions against a16z, Sequoia, Benchmark, etc. All 10 hit the sites within 2 seconds. Cloudflare's bot detection (most VCs use Cloudflare or Vercel) tags the originating IP, responds with 403/CAPTCHA. On next run, scraper gets nothing from 3-4 firms.

**Why it happens:** Small-scale scraping from a home IP looks more like a bot than scraping from a cloud IP range, because real users don't hit 10 venture firms in 2 seconds.

**Prevention:**
- **Serialize scraping** with a delay between firms (10-30 seconds between firms) — this is a personal-scale tool, there is no reason for concurrency
- Set a realistic `User-Agent` (modern Chrome UA); don't use default Playwright/Node strings
- Respect `robots.txt` — parse it with `robots-parser` and skip disallowed paths; ethically and reduces block risk
- Only scrape once per week per firm (or less) — VC portfolios don't change hourly, and infrequent access is less bot-like
- If blocked: back off exponentially with jitter (`delay = base * 2^attempt * random(0.5, 1.5)`); never retry within the same run
- Cache full-page HTML on disk per-firm with 7-day TTL so re-runs don't re-hit sites during dev/debug

**Which phase owns it:** VC scraper runtime phase.

---

### MEDIUM: Pitfall 2.4 — Scraping legality: CFAA, terms of service, GDPR

**What goes wrong:** User scrapes portfolio pages, one VC's TOS explicitly prohibits automated access. VC sends a C&D. The user didn't read 10 ToS pages before scanning.

**Why it happens:** hiQ v. LinkedIn established public data is generally scrape-able under CFAA, but TOS violations are still a contract risk, and EU GDPR applies if scraping personal data (founder names, LinkedIn URLs).

**Prevention:**
- Scrape only **company names, funding status, and website URLs** — not founder names, emails, or personal data (keeps you out of GDPR territory)
- Check and honor `robots.txt` for every firm; document this in the code and README
- Add a `SCRAPING_ETHICS.md` in the repo noting: public data, no personal info, respects robots.txt, reasonable cadence, identifies itself in User-Agent if configured
- Allow the user to add `X-Scraper: JobEngine-Personal-Use` custom header so site admins can identify and contact
- If a VC explicitly emails to request scraping stops, honor it immediately — add to a blocklist in `portals.yml`
- Consider falling back to manually-curated lists for VCs that block automated access (the user can paste a portfolio URL list once per quarter)

**Which phase owns it:** VC scraper design + legal review phase.

---

### MEDIUM: Pitfall 2.5 — Playwright overhead for server-rendered content wastes time and bundle size

**What goes wrong:** Developer uses Playwright for every firm because "it works for SPAs." Each scan takes 5+ minutes and 1GB RAM when Cheerio could do the static ones in 10 seconds and 50MB.

**Prevention:**
- Per-firm: default to `fetch` + Cheerio. Upgrade to Playwright only after confirming the data isn't in the raw HTML or in `__NEXT_DATA__`
- Document the decision per firm in the adapter file header: `// Rendering: Cheerio (server-rendered) | Playwright (SPA requires JS)`
- Measure: if a scan takes >60 seconds for 10 firms total, most firms are likely overusing Playwright

**Which phase owns it:** VC scraper design phase.

---

## 3. Claude Prompt Caching Pitfalls

### CRITICAL: Pitfall 3.1 — Cached content below 1024 tokens is silently ignored, no error

**What goes wrong:** Developer adds `cache_control: {type: "ephemeral"}` to a system message containing just `config/profile.yml` (~400 tokens). API call works. No error. Developer assumes caching is active. Bills 90% more than expected because cache never activates.

**Why it happens:** Anthropic silently ignores cache breakpoints below the 1024-token minimum (Claude Sonnet 4.x) or 4096-token minimum (Claude Opus 4.x). No warning, no error, just no cache.

**Warning signs:**
- API response `usage.cache_creation_input_tokens: 0` AND `usage.cache_read_input_tokens: 0` on every call — cache never triggers
- Evaluation cost doesn't drop after repeated evaluations of the same CV
- You assumed caching activated but never checked the usage object

**Prevention:**
- **Always log `cache_creation_input_tokens` and `cache_read_input_tokens` from the usage object** on every API call during development; assert non-zero after the 2nd call with the same prefix
- Bundle the cached block to meet the minimum: cache `cv.md` + `article-digest.md` + `modes/_shared.md` + `modes/_profile.md` + `modes/oferta.md` together — total is likely 3-8K tokens, comfortably above threshold
- Place `cache_control` on the LAST content block that should be cached, not the first — everything before (inclusive) is cached
- Use `claude-sonnet-4-*` not `claude-opus-4-*` for evaluations where possible: Sonnet's 1024 min is easier to hit than Opus's 4096

**Which phase owns it:** Prompt caching integration phase — must be validated on day one with real usage logging.

---

### CRITICAL: Pitfall 3.2 — Cache busts on ANY change in the prefix, including whitespace

**What goes wrong:** Developer regenerates `modes/_shared.md` with trailing-newline normalization. Every cache entry invalidates. Next 100 evaluations pay write price (1.25x input cost) instead of read price (0.1x input). Bill spikes.

**Why it happens:** Cache matching is **exact byte-for-byte** over the prefix. A single changed character anywhere before the `cache_control` marker invalidates the entire prefix.

**Warning signs:**
- `cache_creation_input_tokens` is large on runs where you expected `cache_read_input_tokens` to be large
- Daily cost higher than expected despite caching being "on"
- Recent edits to `cv.md`, `_profile.md`, or `_shared.md`

**Prevention:**
- Order cached content by update frequency (stable first, volatile last): `modes/_shared.md` → `modes/oferta.md` → `cv.md` → `article-digest.md` → `config/profile.yml` → `modes/_profile.md`
- Put `cache_control` breakpoint AFTER the most stable content — that way, edits to `_profile.md` don't bust the cache of `_shared.md`
- Use **up to 4 cache breakpoints** (API limit): one after the most stable layer, one after medium-stable, one after per-project layer, one after per-task. Changes only bust from that breakpoint down
- Don't auto-format cached files (Prettier, trailing-newline fixers, line-ending normalizers) without bumping a version — or accept the cost
- Track file mtimes (already planned in "smarter file reads"): if no file changed, the exact bytes are the same, cache hits

**Which phase owns it:** Prompt caching architecture phase.

---

### HIGH: Pitfall 3.3 — The 5-minute TTL (2026 change) — caching fails for low-frequency use

**What goes wrong:** User evaluates one JD every 20 minutes. Each call pays cache-write cost (1.25x base). Cache expires before next use. Caching COSTS MORE than not caching.

**Why it happens:** In early 2026, Anthropic quietly reduced the default prompt cache TTL from 60 minutes to 5 minutes. For bursty workloads this is catastrophic. For the JobEngine batch path (evaluate 50 JDs back-to-back) it's fine. For the GUI "evaluate one JD while I have coffee" path, the cache almost always expires.

**Warning signs:**
- Cost per evaluation barely drops vs. no caching
- `cache_read_input_tokens` is 0 on most calls despite `cache_creation_input_tokens` being large
- Evaluations are spaced more than 5 minutes apart

**Prevention:**
- Use the **1-hour cache TTL** for the GUI interactive path: pass `cache_control: { type: "ephemeral", ttl: "1h" }` (write cost is 2x base, but 1-hour TTL matches realistic GUI usage)
- For batch mode (`claude -p` runs 50 JDs in 10 minutes), 5-minute TTL is fine
- Calculate break-even: 1-hour caching saves money when the cached block is used ≥2x per hour; shorter intervals favor no caching
- Consider a "pre-warm" strategy: on Electron app startup, make a no-op evaluation call to populate the cache, so the first real call is a hit

**Which phase owns it:** Prompt caching optimization phase.

---

### HIGH: Pitfall 3.4 — Streaming hides the cache usage from async callbacks

**What goes wrong:** Developer streams evaluation responses. Logs the usage object from the `message_stop` event. The cache fields (`cache_read_input_tokens`) are missing because when streaming, cache stats arrive in `message_start`, not `message_stop`. Developer concludes "caching is broken" and removes it. Or worse, doesn't notice cost savings.

**Warning signs:**
- Streaming responses logged without cache stats
- Async logging callbacks (LiteLLM, OpenTelemetry) miss cache metrics when streaming
- Metrics dashboards report "0 cache hits" but costs suggest otherwise

**Prevention:**
- When streaming: capture `cache_read_input_tokens` and `cache_creation_input_tokens` from the **`message_start`** SSE event, not `message_stop`
- Accumulate usage across all stream events — don't rely on a single final event
- Verify with Anthropic's usage dashboard (api.anthropic.com/console → Usage) that cache reads are happening — cross-check against your own logs weekly

**Which phase owns it:** Streaming integration phase.

---

### MEDIUM: Pitfall 3.5 — Putting cacheable content in user messages instead of system

**What goes wrong:** Developer puts `cv.md` contents in the user turn of every evaluation, with a `cache_control` on that user message. The cache works, but now every evaluation mixes the static (CV) and volatile (the JD) content in one user block — the CV portion is cached but the cacheable prefix is smaller than it could be.

**Prevention:**
- Put stable content in **system** (role: system) — it's designed for this and the prefix is reused across all calls
- Order messages: system (cached CV + profile + modes) → user (volatile JD content) → assistant (volatile response)
- Only put content in the user turn for caching if the same user content repeats across calls (e.g., tool definitions embedded as text) — for JobEngine, JDs are unique per call, so never cache them

**Which phase owns it:** Prompt caching architecture phase.

---

### MEDIUM: Pitfall 3.6 — Per-call overhead makes caching unprofitable for small, infrequent prompts

**What goes wrong:** User adds caching to a one-off "generate interview questions" call with 600 tokens of context. It's below the minimum anyway, cache never activates, and the mental complexity of reasoning about which calls are cached vs. not slows down development.

**Prevention:**
- Only apply caching to the **hot path** (repeated evaluations of different JDs with the same CV/profile/modes)
- Leave one-off calls (CV generation, interview prep, comparison reports) uncached — simpler code, and the cost is negligible
- Document which code paths use caching in `CLAUDE.md` so future contributors don't wonder

**Which phase owns it:** Prompt caching architecture phase.

---

## 4. Integration Pitfalls (Electron + File-Backed State + Anthropic API)

### CRITICAL: Pitfall 4.1 — Electron GUI and `claude -p` batch runner race on `applications.md`

**What goes wrong:** User runs `/career-ops batch` in terminal (existing path). Simultaneously clicks "Mark as Applied" in the Electron GUI. Both processes read `applications.md`, both write. One overwrites the other. Tracker corrupted — either the batch's new additions or the GUI's status update is lost.

**Why it happens:** The existing system uses TSV additions written by `claude -p` workers in parallel (one file per evaluation in `batch/tracker-additions/`) and merges them via `merge-tracker.mjs` afterwards. This avoids race conditions by design. Adding a GUI that writes to `applications.md` directly breaks the invariant.

**Consequences:** Silent data loss. Entries vanish. User loses tracker history for multiple applications. Given Chris evaluated 740+ offers with v1, this is catastrophic.

**Warning signs:**
- GUI and batch runner both have "write `applications.md`" code paths
- No lockfile strategy documented
- Entries in tracker mysteriously disappear after concurrent usage
- `git diff applications.md` shows unexpected reorderings or missing rows

**Prevention:**
- **Preserve the TSV-addition pattern for the GUI:** when the GUI adds a new entry, write a `batch/tracker-additions/{num}-{slug}.tsv` file (atomically) and trigger `merge-tracker.mjs`. Never write `applications.md` directly for ADDs.
- For UPDATES to existing entries (status change, notes edit): use `proper-lockfile` on `applications.md` with a 5-second stale timeout. Both GUI and batch must acquire the lock before read-modify-write.
- Atomic writes: write to `applications.md.tmp`, `fsync`, `rename` — rename is atomic on POSIX and near-atomic on Windows
- Use a file watcher (`chokidar`) in the GUI: when batch runner updates the file, GUI reloads automatically instead of serving stale data
- Make the merge script idempotent — running it twice should be a no-op

**Which phase owns it:** File I/O architecture phase — this is THE most important integration pitfall for JobEngine v2 given the existing codebase's concurrent usage model.

---

### HIGH: Pitfall 4.2 — File watcher loops when GUI write triggers watcher which triggers re-read which triggers UI re-render which writes

**What goes wrong:** GUI uses `chokidar` to watch `applications.md`. GUI updates a cell, writes the file. Chokidar fires `change` event. GUI re-reads the file, refreshes state, which marks the cell "dirty" by a subtle timestamp difference, writes again. Infinite loop.

**Prevention:**
- Debounce watcher events (300-500ms)
- Track "last written by this process" — ignore our own writes for a short window
- Use atomic rename (write to temp, rename) so chokidar sees one event per write, not three (open/write/close)
- Separate the "display" state from "source of truth" state — the GUI holds a parsed model, only serializes to disk on explicit user action

**Which phase owns it:** File watcher integration phase.

---

### HIGH: Pitfall 4.3 — Anthropic key in safeStorage is unavailable to `claude -p` (separate process tree)

**What goes wrong:** User stores the API key via the GUI. The GUI encrypts it with `safeStorage`, writes ciphertext to disk. User then runs a batch job from the terminal. `claude -p` can't access the safeStorage-encrypted key because it runs in a different process tree without access to the same Keychain entitlements.

**Prevention:**
- Use **two key locations**:
  - GUI: `safeStorage`-encrypted in app's userData directory
  - CLI: `ANTHROPIC_API_KEY` environment variable (what the existing `claude -p` already uses)
- On first GUI setup, offer to write the key to `~/.config/jobengine/.env` (600 perms) AS WELL AS safeStorage — CLI reads from `.env`, GUI reads from safeStorage
- Document clearly in onboarding that key storage is duplicated; if user changes key in GUI, remind them to update env var / `.env` file
- Alternative: make the GUI expose a local HTTP endpoint (loopback, authenticated with a local token) that `claude -p` can call to get the decrypted key — adds complexity but avoids duplication

**Which phase owns it:** API key management phase, design-time decision.

---

### HIGH: Pitfall 4.4 — Anthropic rate limits hit during parallel batch evaluations from GUI

**What goes wrong:** User clicks "Evaluate all pending" in GUI. Electron main fires 20 concurrent Anthropic API calls. Anthropic returns 429 rate limit errors. Some evaluations fail, some succeed. Tracker is in an inconsistent state.

**Prevention:**
- Add a concurrency limiter (`p-limit`, max 3-5 concurrent evaluations from GUI path)
- The existing `batch-runner.sh` likely already respects rate limits; study its concurrency and match it
- On 429: respect the `retry-after` header, use exponential backoff with jitter
- On failure: mark the evaluation as "failed" in the tracker additions TSV, don't write an empty report
- Show per-evaluation progress in the GUI — if 3 of 20 fail, the user sees exactly which ones and can retry them

**Which phase owns it:** Anthropic API orchestration phase.

---

### MEDIUM: Pitfall 4.5 — Sequential file numbering (reports/###-*.md) collides under concurrent writers

**What goes wrong:** The existing convention is "max existing + 1" for report numbering. GUI computes "next = 148", batch worker also computes "next = 148" at the same moment. Both write `148-*.md` but to different companies. One overwrites the other or leaves orphaned reports.

**Prevention:**
- Centralize number allocation: a single "allocator" function in a shared module that uses `proper-lockfile` on a tiny `reports/.counter` file to atomically increment
- Alternative: use timestamps or UUIDs in filenames (breaks the existing convention but eliminates the race)
- OR: accept the race and make the merge script idempotent + detect duplicates by (company, role, date) at merge time, renumber as needed
- Never compute "next number" by `ls reports/ | sort | tail -1 | ...` in two places without coordination

**Which phase owns it:** Report generation phase.

---

### MEDIUM: Pitfall 4.6 — Evaluator output logs leak API key or PII into error traces

**What goes wrong:** An Anthropic API error (rate limit, network failure) raises. The error object contains the request headers including the API key. Error gets logged to `batch/logs/` or surfaced in the GUI error modal. Key leaks to disk / screen recording.

**Prevention:**
- In Electron main, wrap the Anthropic SDK client and strip `Authorization`, `x-api-key`, and `anthropic-api-key` from any error before logging or forwarding to renderer
- Same for JDs and CVs — they contain PII; don't dump them into crash reports
- If you ship crash-report telemetry (Sentry etc.), redact `cv.md`, `config/profile.yml`, and API keys in a `beforeSend` hook
- Never log full request bodies at INFO level — log token counts, model, and status only

**Which phase owns it:** Logging / error handling phase.

---

## 5. Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Electron bootstrap | 1.1 (nodeIntegration), 1.2 (IPC trust) | Set secure defaults before feature code; add electronegativity to CI |
| VC scraper design | 2.1 (SPA), 2.5 (Playwright overhead) | Probe each firm, prefer XHR endpoints or `__NEXT_DATA__`; document per-firm strategy |
| VC scraper maintenance | 2.2 (structure drift) | Baseline counts + alerts + HTML snapshots; weekly cadence not daily |
| Anthropic integration | 1.5 (key storage), 3.1 (token minimum), 3.4 (streaming cache stats) | safeStorage + env var dual; log usage; monitor message_start event |
| Prompt caching | 3.2 (exact match), 3.3 (5min TTL) | Order by stability; use 1h TTL for GUI path |
| File I/O integration | 4.1 (race on applications.md) | Preserve TSV-addition pattern; use proper-lockfile for updates |
| Packaging/distribution | 1.3 (Playwright bundle), 1.7 (code signing) | Keep Playwright off the GUI critical path; defer auto-update to v2.1 |
| Streaming | 1.6 (IPC flood), 3.4 (cache stats) | Batch IPC events; capture cache stats from message_start |

---

## 6. Anti-Recommendations (don't do these)

- **Don't put the Anthropic SDK call in the Electron renderer.** Even with a "secure" key relay, it puts the key in process memory the user's browser DevTools can inspect. Keep it in main.
- **Don't bundle all of Playwright's browsers in the Electron app.** Ship Chromium only if needed, or fall back to Cheerio + fetch for VC scraping.
- **Don't scrape all 10 VC firms concurrently.** Serialize with delays. This is personal-scale tooling, not enterprise crawling.
- **Don't write `applications.md` directly from the GUI for new entries.** Use the existing TSV-addition pattern; preserve the invariant the existing batch runner relies on.
- **Don't skip logging cache metrics during prompt caching development.** Caching that looks like it's working but isn't is the worst failure mode.
- **Don't ship auto-update in v2.0.** Manual GitHub Releases downloads are fine until signing/notarization is rock-solid in CI.
- **Don't use `electron-store` with its built-in encryption for the API key.** The encryption key is in the app bundle; it's security theatre. Use `safeStorage`.
- **Don't re-read `cv.md`/`_profile.md`/`_shared.md` on every evaluation once prompt caching is wired.** The planned mtime-tracking is the right move — without it, cache invalidation happens even when content is unchanged (if the SDK re-serializes differently).

---

## Sources

### Electron

- [Electron Security Docs](https://www.electronjs.org/docs/latest/tutorial/security) — contextIsolation, sandbox, IPC trust boundary (HIGH confidence)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) (HIGH)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — Keychain/DPAPI-backed encryption (HIGH)
- [Breaking electron-store's encryption](https://blog.jse.li/posts/electron-store-encryption/) — why `electron-store` encryption is not security (HIGH)
- [The Horror of Blocking Electron's Main Process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) — why sync I/O in main is bad (MEDIUM)
- [Electron IPC tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — ipcMain.handle vs ipcMain.on (HIGH)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance) — worker threads, async I/O (HIGH)
- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing) (HIGH)
- [electron-builder Auto-update](https://www.electron.build/auto-update.html) (HIGH)
- [Playwright with Electron issue #9906](https://github.com/microsoft/playwright/issues/9906) — native module / arch mismatch (MEDIUM)
- [ASAR size issue with electron-builder](https://github.com/electron-userland/electron-builder/issues/6045) — bundle size gotchas (MEDIUM)
- [LobsterAI pattern: Anthropic SDK as subprocess in Electron](https://deepwiki.com/netease-youdao/LobsterAI) — streaming IPC pattern (LOW)

### VC Scraping

- [Web Scraping with Playwright 2026 (Oxylabs)](https://oxylabs.io/blog/playwright-web-scraping) (MEDIUM)
- [Scraping React/Vue/Angular SPAs](https://www.browserless.io/blog/web-scraping-api-react-vue-angular-spas) (MEDIUM)
- [Stealth Scraping with Puppeteer/Playwright](https://www.browserless.io/blog/stealth-scraping-puppeteer-playwright) (MEDIUM)
- [Cheerio vs Playwright tradeoffs](https://dev.to/agenthustler/web-scraping-with-nodejs-cheerio-puppeteer-and-playwright-19f0) (MEDIUM)
- [Legal and Ethical Web Scraping](https://forage.ai/blog/legal-and-ethical-issues-in-web-scraping-what-you-need-to-know/) — CFAA, robots.txt, hiQ v. LinkedIn (MEDIUM)
- [Web Scraping for Research (arXiv)](https://arxiv.org/html/2410.23432v1) — academic treatment of legal/ethical dimensions (MEDIUM)
- [a16z Portfolio page](https://a16z.com/portfolio/) — primary source, structure inspection (HIGH)

### Anthropic Prompt Caching

- [Claude Prompt Caching Docs](https://docs.claude.com/en/docs/build-with-claude/prompt-caching) — official: 1024 min tokens, 4 breakpoints, cache hierarchy (HIGH)
- [Claude Prompt Caching in 2026: 5-Minute TTL change](https://dev.to/whoffagents/claude-prompt-caching-in-2026-the-5-minute-ttl-change-thats-costing-you-money-4363) — TTL reduction impact (MEDIUM)
- [Anthropic SDK issue #1194: Sonnet minimum tokens](https://github.com/anthropics/anthropic-sdk-python/issues/1194) — model-specific minimums (HIGH)
- [Cache usage when streaming (langchainjs discussion #7054)](https://github.com/langchain-ai/langchainjs/discussions/7054) — message_start event (MEDIUM)
- [Spring AI Anthropic Prompt Caching](https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/) — caching hierarchy, placement (MEDIUM)
- [Piunikaweb: Anthropic cache bugs burning tokens](https://piunikaweb.com/2026/03/31/claude-cache-bugs-tokens-20x-more-anthropic-investigating/) — early 2026 known issues (LOW — news aggregator)

### File Locking / Integration

- [proper-lockfile npm](https://www.npmjs.com/package/proper-lockfile) — mkdir-based atomic locking (HIGH)
- [node-proper-lockfile GitHub](https://github.com/moxystudio/node-proper-lockfile) (HIGH)
- [Node.js File Locking guide](https://blog.logrocket.com/understanding-node-js-file-locking/) (MEDIUM)

### Project-specific

- `/home/desachri/JobEngine/.planning/PROJECT.md` — JobEngine v2 requirements
- `/home/desachri/JobEngine/CLAUDE.md` — existing data contract and TSV-addition pattern
- `/home/desachri/JobEngine/batch/` — existing batch runner pattern to preserve
