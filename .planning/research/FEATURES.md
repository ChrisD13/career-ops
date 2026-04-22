# Feature Landscape: JobEngine v2 Desktop App

**Domain:** AI-powered job search management desktop application (Electron GUI on top of existing CLI)
**Researched:** 2026-04-21
**Research mode:** Ecosystem + Feasibility hybrid
**Overall confidence:** MEDIUM-HIGH (market research is MEDIUM, CLI-parity requirements are HIGH — they come from the existing codebase)

---

## Executive Summary

JobEngine v2 is a unique product in the job-tracker space: most competitors (Huntr, Teal, Simplify, ApplyArc, JobShinobi, JibberJobber) are cloud-first SaaS focused on breadth (autofill, resume builders, 40k-job-boards integration). JobEngine is the opposite: **local-first, opinionated, AI-evaluation-heavy, file-backed, single-user**. Its differentiator is not "track more applications" — it's "apply to fewer, better ones."

This reframes the feature priority entirely. Table stakes for a SaaS tracker (cross-device sync, team collaboration, Chrome extension autofill) are **anti-features** here. Table stakes for JobEngine are things SaaS trackers don't offer: visible AI evaluation (streaming, explainable scores), VC-portfolio discovery, keyboard-first power-user ergonomics, and zero feature regression from the CLI.

The GUI must be **strictly additive to the CLI user's workflow**, not a replacement that loses capabilities. A CLI user who used `/career-ops` 10 times a day will reject a GUI that's 2x slower or 3x more clicks. Every screen should have a keyboard path.

---

## Research Inputs

| Source | Confidence | What it informed |
|--------|------------|------------------|
| Huntr / Teal / Simplify / ApplyArc / JobShinobi competitive analysis | MEDIUM | Market table stakes, common complaints |
| Linear / Raycast / Superhuman design principles | MEDIUM-HIGH | Speed, keyboard-first, command palette patterns |
| Notion / Crunchbase / Airtable company-data UIs | MEDIUM | VC portfolio discovery patterns |
| Electron performance docs (official) | HIGH | Rendering constraints, virtualization |
| Claude Code reverse-engineering analyses | MEDIUM | Streaming LLM UI patterns |
| Existing JobEngine codebase (CLAUDE.md, PROJECT.md, states.yml, modes/) | HIGH | Required CLI parity surface |

---

## Table Stakes

**Definition:** Features without which the GUI is objectively worse than typing `/career-ops` in a terminal. Missing any of these = users keep using the CLI and the GUI is dead on arrival.

### Parity with Existing CLI (non-negotiable)

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Paste URL → evaluate → report + PDF + tracker row** (the full auto-pipeline) | Medium | This is the single most-used CLI command; GUI must do it in one paste, zero extra clicks |
| **A–G scoring report viewer** (Blocks A–F + Legitimacy) rendered from the existing `reports/*.md` files | Low | Reports are already Markdown — the GUI just renders them with a styled reader |
| **Application tracker view** reading `data/applications.md` directly (not a mirror, not a DB) | Low-Medium | PROJECT.md line 5 and 37 mandate file-backed state; Electron reads same files |
| **Canonical status column** dropdown constrained to `templates/states.yml` values | Low | User can change status in GUI without breaking `verify-pipeline.mjs` |
| **CV viewer + PDF regenerate button** (drives `generate-pdf.mjs` or inline Playwright) | Medium | Existing `/career-ops pdf` mode must have GUI equivalent |
| **Batch evaluation runner** with concurrency control (parallel workers like `batch/batch-runner.sh`) | Medium-High | Chris evaluated 740+ offers with batch; GUI can't drop this |
| **Multi-language mode switcher** (EN/DE/FR/JA/PT/RU from `modes/*/`) | Low | Already in config; GUI just needs a language setting in settings panel |
| **Portal scan trigger** (kicks off `scan.mjs` and shows results streaming in) | Medium | Zero-LLM-cost scanning is a strategic feature; GUI must expose it |
| **Pipeline inbox** (pending URLs from `data/pipeline.md`) with "process next" action | Low | Matches existing pipeline mode |

### Core GUI Screens

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Pipeline list view** (applications sorted by date/score/status) — virtualized | Medium | Chris has 740+ rows; react-window or similar required (Electron perf docs) |
| **Detail side panel** (click row → see report + CV match + actions without leaving list) | Medium | Linear-style 2-pane; avoids modal fatigue, faster than routing to a new page |
| **Dashboard / overview screen** showing counts by status, recent activity, follow-ups due | Medium | Replaces the existing Go TUI dashboard with a visual equivalent |
| **Status filter + search** in the list (by company, role, score range, status) | Low-Medium | Every tracker has this; users expect instant local filtering |
| **Settings panel** for API key, profile, portal config, language mode | Low | API key management is first-class per PROJECT.md line 45 |

### Claude API Integration (GUI-specific table stakes)

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Streaming evaluation output** — tokens appear as Claude generates the report | Medium | Without streaming, a 60-second evaluation feels broken; SSE is the web standard |
| **Prompt caching with `cache_control`** on CV / `_profile.md` / `_shared.md` | Medium | PROJECT.md line 31 mandates ~90% token cost cut; core value prop |
| **Visible token / cost counter** per evaluation and running session total | Low | API key billing is visible to user; trust & transparency |
| **Cancel-in-flight** button for a running evaluation | Low | Standard stream-abort pattern; prevents wasted tokens on wrong-URL mistakes |
| **Error surfacing** when API returns 429 / 500 / auth errors with retry button | Low | Can't silently fail on paid API calls |
| **Mod-timestamp file caching** so unchanged `cv.md` / `_profile.md` doesn't re-read | Medium | PROJECT.md line 32: "smarter file reads" is active requirement |

### Reliability & Safety

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **"Never auto-submit"** enforcement — any apply flow stops before the Submit button with user confirmation | Low (UX rule) | CLAUDE.md Ethical Use section is hard constraint |
| **File-lock / atomic writes** to `applications.md` when GUI and CLI are both open | Medium | Both interfaces write the same file; need optimistic-lock or merge-on-write like `merge-tracker.mjs` |
| **Report regeneration without losing manual edits** (the user may have edited the report) | Medium | Reports in `reports/` are plain Markdown; user-editable; preserve user edits |
| **Error logs visible in UI** (not just console) | Low | Desktop app users can't tail a log; need a "Logs" panel |

---

## Differentiators

**Definition:** Features that make the GUI meaningfully better than the CLI — the reasons someone would choose the GUI over their terminal muscle memory. These are the competitive moat vs both the CLI and SaaS trackers.

### AI Evaluation Made Visible

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Live streaming evaluation with Block-by-Block render** — A, B, C, D, E, F, G appear as Claude writes them | Medium-High | The CLI dumps a completed report; the GUI can render Block A as soon as it streams, so the user starts reading while Claude is still writing Block D. This is the killer UX a terminal can't do well. |
| **Score explanation hover** — hover over "4.2/5" to see which blocks pulled it up/down | Medium | Makes scoring legible and builds trust (Teal-style keyword explainers, adapted for A–G) |
| **"Why this score"** inline diff between CV and JD — highlighted matches / gaps | High | Differentiator vs Teal's keyword-gap tool, because JobEngine has full semantic evaluation, not just keyword matching |
| **Re-evaluate with edits** — user tweaks profile, one-click re-runs the same JD to see new score | Low-Medium | Closes the feedback loop; turns evaluation into iterative profile tuning |
| **Cache-hit indicator** on each evaluation (shows when prompt cache saved tokens, with $ estimate) | Low | Makes the token-efficiency work visible and quantified |

### VC Portfolio Discovery (new capability; no clear competitor precedent)

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Discovery board** — browsable grid of companies scraped from the 10 VC firms, with logos / stage / last funding / open roles count | High | This is the signature v2 feature; PROJECT.md active requirement |
| **Multi-facet filters** (VC firm, funding date range, funding stage, role match count, location) | Medium | Crunchbase/Airtable pattern; faceted filtering is table stakes for company databases |
| **"Promote to pipeline"** action — one click turns a discovered company + job into a tracked pipeline entry | Low-Medium | The key conversion flow; without this, discovery is a dead-end list |
| **Freshness badges** — "New funding this week" / "Just hiring" / "Seen 2 days ago" | Low | Signals value; aligns with the "recent funding + active listings" filter in PROJECT.md line 39 |
| **Deduplicate across VC firms** — a16z and Sequoia both back Company X → show once with both badges | Low-Medium | Reflects portfolio overlap reality; prevents duplicate pipeline noise |
| **Scraper health panel** — shows last-scraped timestamp per firm, failures, DOM-change warnings | Medium | PROJECT.md constraint: VC pages change; maintainer must see scraper decay |

### Power-User Ergonomics

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Command palette (Cmd/Ctrl-K)** — every action keyboard-reachable: evaluate URL, switch view, jump to company, run scan, regenerate CV | Medium | Raycast / Linear / Superhuman standard; absolute must-have for a CLI-user audience |
| **Keyboard shortcuts** for row navigation (j/k), quick actions (e = evaluate, s = skip, a = apply, r = report) | Low | Vim-style shortcuts for the CLI crowd |
| **Quick-switcher** — Cmd-P to jump to company by name (fuzzy search over all tracked applications) | Low-Medium | Linear pattern; scales well past 500 rows |
| **Paste-anywhere-to-evaluate** — URL in clipboard + global shortcut → opens app, evaluates | Medium | Electron `globalShortcut`; wins the "oh I saw a cool role" moment without context-switching friction |
| **Saved views / smart filters** — "Score >= 4 AND status = Evaluated AND not applied in 7d" | Medium | Linear-style saved views; turns static lists into actionable queues |
| **Markdown-editable report viewer** — edit the report inline, save writes back to `reports/*.md` | Medium | Reports are Markdown; editing them in-app instead of opening VS Code is a real win |

### Follow-up & Cadence Intelligence

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Follow-up reminder badges in the pipeline** — driven by existing `followup-cadence.mjs` | Low | Just wires the JSON output to the list; existing logic |
| **Native OS notifications** for due follow-ups (opt-in) | Low-Medium | Electron `Notification` API; respects the "local desktop" framing |
| **"Ghost" detection** — flags applications with no response for N days (from `analyze-patterns.mjs`) | Low | Existing script, just needs a UI surface |
| **Response-rate dashboard** — per VC, per role archetype, per location — derived from `analyze-patterns.mjs` | Medium | Turns the existing pattern analysis into a feedback-loop visual |

### Interview-Prep Integration

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **Per-company prep panel** — reads `interview-prep/{company}-{role}.md` beside the tracker row | Low | Existing artifacts; GUI just surfaces them |
| **"Generate prep for this company"** action when status moves to Interview | Medium | Automates the existing `/career-ops deep` + interview-prep flow on a natural state transition |
| **Story bank search** — fuzzy-search `interview-prep/story-bank.md` by keyword or STAR-R tag | Low-Medium | Existing file; just needs a search UI |

### Local-First Trust

| Feature | Complexity | Rationale |
|---------|------------|-----------|
| **"Show me the files"** button on every view — opens the underlying `.md` / `.yml` in the user's default editor | Low | Massive trust signal for the power-user audience; "nothing hidden, nothing locked in" |
| **Zero-telemetry, zero-cloud-sync** — visible in settings, no dark patterns | Low (policy) | Differentiator vs every SaaS competitor; aligns with the existing architecture |
| **Export everything** — zip of `cv.md`, `config/`, `data/`, `reports/` for backup | Low | Trivial; amplifies the "you own your data" story |

---

## Anti-Features

**Definition:** Features that competitors build but JobEngine should **deliberately not build**. Building these would either violate project constraints, dilute the differentiator, or copy patterns users actively complain about.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|--------------------|
| **Auto-apply / autofill of application forms** | CLAUDE.md ethical constraint; PROJECT.md Out of Scope. Users also hate "mass-blast apply" tools | Always stop before Submit; open the form in the default browser for user to complete |
| **Cloud sync / multi-device state** | PROJECT.md Out of Scope: "all data stays local" | Document a git-based workflow for users who want sync across their own machines |
| **Built-in resume builder / AI-generated cover letters from scratch** | Scope creep; `cv.md` is the source of truth, not a templating target; competitors (Huntr, Teal) do this and it dilutes focus | Re-use existing CV generation (`generate-pdf.mjs`, `generate-latex.mjs`); cover letters stay in `modes/` if needed |
| **Email integration / "AI-generated outreach emails"** | User complaint pattern: "Email templates sound funny and very AI-like" (Huntr/Teal reviews). Also scope creep. | Let users draft in `modes/contacto.md` and copy-paste; no SMTP |
| **Chrome extension for autofill on Workday/Greenhouse etc.** | Scope creep, maintenance burden; Simplify owns this space; not aligned with local desktop framing | Keep browser separate; the extension surface would fragment the product |
| **Forum / community / social features** | Single-user local tool; no user accounts | N/A |
| **Gamification (streaks, leaderboards, "you applied to 50 jobs!")** | Anti-aligned with the quality-over-quantity ethic in CLAUDE.md Ethical Use | If any stats, show quality signals (response rate, interview conversion), not volume |
| **Mobile companion app** | PROJECT.md Out of Scope | — |
| **"Submit your CV to 1000 jobs" / mass-apply button** | Violates CLAUDE.md "Quality over speed" | — |
| **Modal-heavy workflows** (full-screen popups for every action) | User complaint: "excessive clicking", "context switching"; Linear/Raycast explicitly avoid modals | Use side panels, command palette, inline edits |
| **Sync-dependent loading states** (spinner on every navigation) | Electron perf docs explicitly warn; violates "feels fast" goal | Virtualized lists render instantly from local files; only show a spinner during the actual Claude API call |
| **Onboarding wizard with 8 required steps** | CLAUDE.md onboarding is conversational and incremental; a wizard would regress this | Lazy onboarding: app works on first open, prompts for API key on first evaluation, profile on first report |
| **Ads / upsells / "Pro tier" nag screens** | Not a SaaS; CLAUDE.md explicitly positions it as open-source author-tool | — |
| **"Re-skin" of the CLI** (terminal emulator in Electron) | Already exists as Go TUI (`dashboard/`); would be strictly worse than a real GUI | The Electron app is a genuine GUI; TUI stays for headless use |
| **Feature-flagged AI "assistants"** that pop tips at the user | Pattern users hate in Huntr/Teal reviews ("feels like an AI-native used-car-salesman") | Proactive suggestions only in response to explicit actions |
| **Secondary scoring system parallel to A–G** | Would fragment the scoring contract in `modes/oferta.md`; introduces inconsistency with CLI | A–G is the only scoring; GUI is a better viewer of it |

---

## Feature Dependencies

```
API key + settings panel   →   any Claude API call
                             ↘
                               Streaming evaluation   →   live report render   →   token-cost counter
                                                       ↘
                                                         prompt caching       →   cache-hit indicator

File-backed state (read/write)  →  Pipeline list view  →  Detail side panel   →  Report viewer
                                                      ↘   Status dropdown    →   atomic writes / file lock

scan.mjs wrapper              →  Pipeline inbox           →  "Process next"  →  Evaluation flow
VC scraper (active work)      →  Discovery board          →  "Promote to pipeline"

Command palette (Cmd-K)       →  ALL actions (evaluate, scan, switch view, jump to company, open report, regenerate CV)
                              ↘
                                global shortcut / paste-anywhere-to-evaluate (secondary)

analyze-patterns.mjs / followup-cadence.mjs (existing JSON)  →  Dashboard + follow-up badges
interview-prep/*.md (existing files)                          →  Per-company prep panel
```

**Implication:** The command palette and file I/O layer are foundational — every other feature depends on them. Build these first, then layer domain features on top.

---

## MVP Recommendation

If the roadmap has a Phase 1 (Walking Skeleton) with budget pressure, prioritize in this order:

### Must-have for v2 M1 (GUI that beats the CLI for single-evaluation flow)
1. **API key / settings panel** — prerequisite for any Claude call
2. **Pipeline list view** (read `applications.md`, virtualized) — the home screen
3. **Paste URL → streaming evaluation → live report render** — the hero flow
4. **Detail side panel** with report viewer + status dropdown
5. **Command palette (Cmd-K)** with ~10 core actions
6. **Prompt caching + token cost display** — validates the core value prop

### Must-have for v2 M2 (full CLI parity, power-user shortcuts)
7. **Batch runner** with concurrency control
8. **Portal scan trigger** (wraps `scan.mjs`)
9. **Dashboard / overview screen**
10. **Keyboard shortcuts** (j/k/e/s/a/r, Cmd-P)
11. **CV viewer + regenerate PDF**
12. **Follow-up badges + native notifications**

### Must-have for v2 M3 (VC discovery — the strategic differentiator)
13. **VC scraper infrastructure** (10 firms; PROJECT.md active req)
14. **Discovery board** with multi-facet filters
15. **Promote-to-pipeline** action
16. **Scraper health panel**

### Deferred / explicit non-goals for M1 (can add later without rework)
- Markdown-editable report viewer (read-only is fine for M1)
- Response-rate dashboard (derivable later from `analyze-patterns.mjs`)
- Interview-prep integration (existing files stay accessible)
- "Why this score" inline CV↔JD diff (requires more Claude engineering)
- Global shortcut / paste-anywhere-to-evaluate (nice-to-have, not core)

---

## Performance Budget (to prevent "sluggish" perception)

Based on Electron performance docs, Linear/Raycast design principles, and Claude Code architecture notes:

| Interaction | Target | How to achieve |
|-------------|--------|----------------|
| App cold start | < 1.5s to interactive | Lazy-load non-home routes; don't import Anthropic SDK until first API call |
| Navigating between tracker rows | < 16ms per keystroke | Virtualized list (react-window); no re-render of unchanged rows |
| Opening detail panel | < 100ms | Render from already-loaded row data; hydrate report Markdown async |
| Command palette open | < 50ms | Keep palette component mounted (hidden); don't unmount on close |
| Filter / search typing | < 16ms per keystroke | Local in-memory filter; no re-fetch; debounce only on very large result sets |
| Starting an evaluation | First token < 2s, full response streaming | SSE from Anthropic API; render tokens as they arrive |
| Status dropdown change | < 200ms to saved | Optimistic update UI; write to file async; show toast on failure |
| Scan results first row | < 3s | `scan.mjs` is already zero-token; just show results as API promises resolve |
| Discovery board load (cached) | < 500ms | Read from a local cache file; only refetch on explicit "Refresh" or schedule |

**Anti-patterns to reject:**
- Showing a full-screen spinner on route change
- Re-reading `cv.md` on every keystroke in an evaluation field
- Synchronous IPC (`sendSync`) between main and renderer
- Rendering 700+ application rows without virtualization
- Blocking the renderer during Playwright PDF generation (use main process + child process)

---

## Complexity Legend

- **Low:** 1-2 days of work for a competent dev; existing code or trivial UI
- **Medium:** 3-10 days; new code, some integration
- **Medium-High:** 2-3 weeks; new code, cross-cutting, or design-heavy
- **High:** 3+ weeks; new subsystems (scraping, streaming architecture)

---

## Open Questions for Roadmap Phase

1. **Should the Electron app replace the Go TUI dashboard, or coexist?** PROJECT.md line 23 marks the TUI as existing; no explicit signal to deprecate. Recommendation: coexist — TUI for headless/SSH, Electron for day-to-day.
2. **File-lock strategy when both CLI and GUI write `applications.md`?** The existing `merge-tracker.mjs` is TSV-based; GUI should either write TSVs to `batch/tracker-additions/` (safe) or implement the same merge logic on direct edits.
3. **How to handle API key storage on disk?** Electron `safeStorage` API encrypts per-user; don't roll custom.
4. **Should reports be user-editable in the GUI, or read-only?** Recommendation: read-only in M1 (simpler, no conflict with manual CLI edits); add inline editing in M3+ if users ask.
5. **What's the update mechanism for the Electron app itself?** Existing `update-system.mjs` handles the data layer; Electron needs autoUpdater or a manual download flow.

---

## Sources

- [Huntr Review (2026): Is This Job Tracker Any Good?](https://scoutify.com/blog/huntr-review)
- [Huntr vs Teal: Which Job Search Tool Works Best in 2026?](https://huntr.co/blog/huntr-vs-teal)
- [Best Job Trackers 2026: Free & AI-Powered Tools | Prentus](https://prentus.com/blog/we-found-the-5-best-job-tracker-tools-on-the-market)
- [Best Job Application Trackers 2026 (7 Tested) | ApplyArc](https://applyarc.com/compare/best-job-application-trackers)
- [Huntr vs Teal vs JibberJobber: Best Job Application Tracker for 2026](https://bestjobsearchapps.com/articles/en/huntr-vs-teal-vs-jibberjobber-best-job-application-tracker-for-2026-full-comparison)
- [Kanban Board Features | ApplyArc](https://applyarc.com/features/job-tracker)
- [Electron Performance Docs (official)](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron Keyboard Shortcuts (official)](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts)
- [6 Ways Slack, Notion, and VSCode Improved Electron App Performance](https://palette.dev/blog/improving-performance-of-electron-apps)
- [Command Palette UI Design: Best practices | Mobbin](https://mobbin.com/glossary/command-palette)
- [Best practices for designing Linear Dashboards](https://linear.app/now/dashboards-best-practices)
- [Raycast: CLI-inspired desktop app (Launch HN)](https://news.ycombinator.com/item?id=22466994)
- [The Complete Guide to Streaming LLM Responses in Web Applications](https://dev.to/hobbada/the-complete-guide-to-streaming-llm-responses-in-web-applications-from-sse-to-real-time-ui-3534)
- [Reverse-engineering Claude's generative UI](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/)
- [Inside the Claude Code source](https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1)
- [5 Ways VCs Manage Deal Flow Pipeline With Airtable](https://confluence.vc/deal-flow-pipeline-with-airtable/)
- [Notion UI Design Patterns | Dashibase](https://dashibase.com/blog/notion-ui/)
- [App notifications overview (Windows) - Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/toast-notifications-overview)
- Existing repo: `/home/desachri/JobEngine/CLAUDE.md`, `/home/desachri/JobEngine/.planning/PROJECT.md`, `/home/desachri/JobEngine/templates/states.yml` (HIGH confidence, direct source)
