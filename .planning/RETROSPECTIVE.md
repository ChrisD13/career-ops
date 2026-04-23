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

## Cross-Milestone Trends

_Will populate after v1.1_

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 14 |
| Duration (days) | 19 |
| Files changed | 342 |
| Lines added | 46,149 |
| Human UAT deferred | 14/19 requirements |
