# Retrospective

## Milestone: v1.0 — JobEngine v2 MVP

**Shipped:** 2026-04-23
**Phases:** 3 | **Plans:** 14 | **Duration:** 19 days

### What Was Built

1. Secure Electron shell with react-window virtualization for 740+ tracker rows
2. Write-safe Anthropic streaming integration with prompt caching + mtime context dedup
3. VC portfolio discovery: 10 Playwright adapters + CLI + Discover panel + scheduler

### What Worked

- **Wave-based parallel execution**: Phase 3 Wave 1 ran plans 03-01 (scraper CLI) and 03-02 (Electron IPC) in parallel with no conflicts — different file domains eliminated intra-wave overlap
- **Code review auto-fix chain**: 5/5 warnings resolved in 2 auto-iterations; WR-01 (scheduler lock) and WR-05 (probe discriminator) were the most impactful
- **Zod validation on all IPC channels**: caught several invalid-payload edge cases at the boundary; no ad-hoc validation scattered through handlers
- **lockAndWrite pattern reuse**: Phase 2's write-queue.ts was cleanly reused by Phase 3's promote.ts, vc-companies.ts, and vc-firms.ts with no modifications to the shared primitive
- **Graceful adapter degrade**: `no cards found — selector drift?` log pattern + return [] in every adapter prevents a single firm's DOM drift from crashing the full scrape

### What Was Inefficient

- **Worktree branch confusion**: The orchestrator (gsd-execute-phase) ran inside a worktree itself, causing some agents to commit to the parent branch instead of isolated worktree branches. This led to "Already up to date" on some merges — not harmful but required debugging
- **REVIEW.md path mismatch**: Code reviewer wrote to main working tree; had to copy to worktree before committing. Same pattern for REVIEW-FIX.md. Worktree-aware file write logic would eliminate this
- **Human UAT deferred for 14 requirements**: Phases 2 and 3 have significant human-only testing pending. Should budget explicit UAT time before milestone close rather than deferring as debt
- **Integration checker false negatives**: Checker ran against main branch (pre-merge), not the worktree. All Phase 3 "UNWIRED" findings were false negatives. Integration check should run from the worktree context

### Patterns Established

- **lockAndWrite as the universal write primitive**: Any file write that needs concurrent-safe atomic semantics uses write-queue.ts lockAndWrite
- **process-runner OpKind extension pattern**: Adding a new op kind (e.g., 'scrape') requires updating 4 files atomically: process-runner.ts, preload/types.ts, OpBadge.tsx, useOperationsLog.ts
- **Code review chaining in autonomous mode**: auto-invoke review + fix as part of every phase execution; 2-iteration auto-fix eliminates most warnings before verification
- **Prometheus health-data shape**: per-firm { name, last_run, company_count, baseline_count, status } as a reusable health sidecar pattern for any long-running data collector

### Key Lessons

1. **Plan worktree isolation explicitly**: When the orchestrator is itself in a worktree, file tool paths (absolute) differ from bash paths (relative to worktree). Always check `pwd` and `git rev-parse --abbrev-ref HEAD` at the start of complex orchestration
2. **Schedule human UAT as a phase task, not a post-phase deferred**: Phase 2's 40-step checklist and Phase 3's 8 UAT items were deferred; they should have been explicit tasks with acceptance criteria baked into the plan
3. **WR-01 scheduler lock is a template**: The pattern (single-flight flag + per-operation onExit callback + safety timer) applies to any Electron main-process long-running child operation
4. **Funding signal heuristics are good enough for MVP**: RSS blog + Google News query without Crunchbase API covers the majority of funded companies in the 12-month window; avoids API cost and rate limits

### Cost Observations

- Model mix: Phase execution used opus profile (executor) + sonnet (verifier/reviewer)
- Notable: Autonomous mode ran 3 phases, 2 wave parallel executions, code review + auto-fix, audit, and milestone close in a single session

## Milestone: v1.1 — Live Validation + Analytics

**Shipped:** 2026-04-24
**Phases:** 3 | **Plans:** 9 | **Duration:** 20 days (2026-04-04 → 2026-04-24)

### What Was Built

1. Phase 4: VC adapter validation — `normalizeReason()` canonical error codes, `validate-adapters.mjs`, 10 HTML fixture captures, offline Playwright regression harness (34/34 tests)
2. Phase 5: Electron auto-update — `electron-updater` wired to GitHub Releases, `UpdateBanner` with isRefresh-flagged fetch, per-version dismiss via `userData/dismissed-update.json`
3. Phase 6: Response-rate analytics dashboard — `computeAnalytics()` pure aggregation (4 pitfall guards), CSS-only bar chart + funnel table, `AnalyticsPanel` with `isRefresh`-flagged auto-refresh

### What Worked

- **Autonomous mode end-to-end**: Ran discuss → plan → execute for 3 phases with zero manual intervention on code work; smart discuss resolved all grey areas in batch tables before planning
- **Parallel worktree execution**: Wave 2 of Phase 5 ran 05-02 (main-process) and 05-03 (renderer) in parallel with no file overlap — confirmed by intra-wave overlap check
- **Code review auto-fix chain**: Phase 5 resolved 2 warnings in 2 iterations (WR-01 non-null assert, WR-02 regex end anchor + prerelease try/catch); Phase 6 resolved 1 warning in 1 pass
- **Research-first planning**: Phase 5's open questions Q3/Q4 (build config location, IPC channel set) were surfaced during research and resolved with user confirmation before planning, preventing plan-checker blockers at first pass — except for the RESOLVED marker format itself
- **Pattern mapper**: Captured DiscoverPanel.tsx as the canonical panel template with exact line numbers, enabling Phase 6 executor to replicate the LoadState discriminated union and onFilesChanged pattern correctly

### What Was Inefficient

- **CWD drift to `electron/` subdirectory**: The `cd electron && npm run typecheck` pattern caused subsequent Bash commands to run from the wrong directory, requiring recovery steps. Should always use absolute paths or `cd /repo-root && npm run -prefix electron typecheck`
- **RESOLVED marker gate fires twice**: Both Phase 5 and Phase 6 RESEARCH.md required the same fix (add `## Open Questions (RESOLVED)` heading + `RESOLVED:` prefixes). This is a process gap — the researcher agent should write RESOLVED markers at research time when it already knows the answer
- **Worktree pre-merge stash dance**: Uncommitted working-tree changes (ROADMAP.md edits, package.json ordering) required stash-merge-pop before each worktree merge. Root cause: orchestrator continued making edits after capturing EXPECTED_BASE; should freeze working tree before spawning parallel agents
- **Phase 5 UA-T 5-item backlog**: All 5 items require a packaged AppImage + real GitHub Release — this was known at planning time but not budgeted as a separate "first release" task. A "v0.1.0 release" phase should be planned explicitly

### Patterns Established

- **`isRefresh` flag**: Suppress loading-state flash on file-change refreshes in panels (AnalyticsPanel pattern — diverges from TrackerPanel which shows loading on every fetch)
- **Stash+merge orchestrator pattern**: When parallel worktree agents run, orchestrator must stash modified tracking files before merge, merge, restore, pop — prevents ROADMAP/STATE overwrite by stale worktree content
- **Research open-question resolution flow**: Researcher surfaces questions → checker blocks on RESOLVED marker → orchestrator asks user → user confirms → commit `RESOLVED:` inline. Works but checker step is redundant when researcher already has the answer
- **Cumulative funnel semantics**: "Interview count" = Applied+Responded+Interview+Offer (forward-progress), not current-status-only — avoids applications that advanced to Offer disappearing from earlier stages

### Key Lessons

1. **Fix CWD drift with absolute paths**: Never use bare `cd subdir` for build commands in orchestrator bash; always use `npm --prefix electron run typecheck` or `cd /abs/path && command`
2. **Researcher should write RESOLVED markers**: When the researcher discovers and recommends an answer to an open question, it should write `RESOLVED: ...` inline — not leave it as `Recommendation:`. The checker's Dimension 11 gate then passes on first try
3. **Plan a "first release" phase**: The GitHub coordinates placeholder means v1.1 code is complete but not shippable. Next milestone should start with: fill placeholders, build AppImage, publish v0.1.0, run Phase 5 human UAT
4. **Smart discuss batch acceptance**: User accepted all 3 grey area tables at recommended defaults for Phase 6 — indicates the research-to-proposal quality is high when codebase context is loaded. No value in interactive discuss for mature codebases with good research

### Cost Observations

- Model mix: Opus (executor/planner/researcher), Sonnet (verifier/reviewer/checker/UI)
- Notable: Autonomous mode handled 3 full phases — discuss+plan+execute per phase — plus audit and milestone close in one session; approximately 1.5M tokens consumed across all agents

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 3 | 3 |
| Plans | 14 | 9 |
| Duration (days) | 19 | 20 |
| Files changed | 342 | 77 |
| Lines added | 46,149 | ~99K (incl. fixture HTML) |
| Human UAT deferred | 14 items | 14 items (new) |
| Code review issues (critical) | 0 | 0 |
| Code review issues (warning) | 5 | 3 |
| Verification: passed on first run | 2/3 phases | 1/3 phases |
| Autonomous execution | Partial | Full (3 phases end-to-end) |
