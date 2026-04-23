---
phase: 02-write-safety-anthropic-integration
plan: "03"
subsystem: electron-renderer
tags:
  - renderer
  - evaluation
  - settings
  - streaming
  - ui
dependency_graph:
  requires:
    - 02-02 (window.api surface: evaluateUrl, onEvaluationToken/Done/Error/Cancelled, checkApiKey, saveApiKey, verifyApiKey, getModel, setModel)
  provides:
    - electron/src/renderer/components/EvaluatePanel.tsx (EvaluatePanel — props: hasKey, backendWarning, onOpenSettings)
    - electron/src/renderer/components/StreamingReportView.tsx (StreamingReportView — props: markdown, status)
    - electron/src/renderer/components/TokenStatsRow.tsx (TokenStatsRow — props: usage, costUsd, status)
    - electron/src/renderer/components/InlineErrorBanner.tsx (InlineErrorBanner — props: message, retryAfter?, onDismiss)
    - electron/src/renderer/components/SettingsSlideOver.tsx (SettingsSlideOver — props: open, onClose)
    - electron/src/renderer/components/ApiKeyField.tsx (ApiKeyField — props: onSave, hasKey)
    - electron/src/renderer/components/VerifyButton.tsx (VerifyButton — props: onVerify)
    - electron/src/renderer/components/ApiKeyBanner.tsx (ApiKeyBanner — props: variant, message?, onOpenSettings?)
    - electron/src/renderer/components/ModelSelect.tsx (ModelSelect — no props)
    - electron/src/renderer/hooks/useEvaluationStream.ts (useEvaluationStream — returns: {state, start, stop, reset})
    - electron/src/renderer/hooks/useApiKeyState.ts (useApiKeyState — returns: {hasKey, backendWarning, loading, refresh, save, verify})
  affects:
    - 02-05 (App.tsx wires EvaluatePanel + SettingsSlideOver via gear icon trigger)
tech_stack:
  added:
    - "react-markdown@10.1.0 (already in package.json from prior install)"
    - "remark-gfm@4.0.1 (already in package.json from prior install)"
    - "rehype-sanitize@6.0.0 (already in package.json from prior install)"
  patterns:
    - "useEffect subscription cleanup pattern — all 4 evaluation IPC listeners return unsubscribe functions"
    - "Controlled error dismissal — errorDismissed local state prevents banner reappearing on re-render"
    - "Conditional rendering for SettingsSlideOver — returns null when !open (no DOM output when closed)"
    - "Escape key scoped to open state — listener added/removed on open flag change, no global leak"
    - "sk-ant- prefix validation in ApiKeyField — Save button disabled until regex passes"
    - "Catppuccin Mocha via rgb(var(--ctp-*)) pattern — consistent with Phase 1 globals.css variables"
key_files:
  created:
    - electron/src/renderer/components/StreamingReportView.tsx
    - electron/src/renderer/components/TokenStatsRow.tsx
    - electron/src/renderer/components/InlineErrorBanner.tsx
    - electron/src/renderer/components/EvaluatePanel.tsx
    - electron/src/renderer/components/ApiKeyBanner.tsx
    - electron/src/renderer/components/ApiKeyField.tsx
    - electron/src/renderer/components/VerifyButton.tsx
    - electron/src/renderer/components/ModelSelect.tsx
    - electron/src/renderer/components/SettingsSlideOver.tsx
    - electron/src/renderer/hooks/useEvaluationStream.ts
    - electron/src/renderer/hooks/useApiKeyState.ts
  modified:
    - electron/src/renderer/styles/globals.css (Phase 2 CSS appended)
decisions:
  - "CSS variables adapted from plan's var(--base)/var(--surface0) to project's rgb(var(--ctp-base))/rgb(var(--ctp-surface)) — plan used generic Catppuccin names; project uses ctp-prefixed RGB triplet pattern"
  - "color-mix() replaced with rgba() literals for yellow/red/peach backgrounds — color-mix() requires modern browser support and may not be available in Electron's bundled Chromium without additional flags"
  - "globals.css contains all Phase 2 CSS sections: streaming-report, token-stats, inline-error-banner, evaluate-panel, api-key-banner, settings-overlay, settings-panel, settings-field, settings-verify"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 11
  files_modified: 1
---

# Phase 2 Plan 03: Evaluate Panel + Settings Slide-Over Summary

11 renderer files delivering the Evaluate panel (streaming report + token stats + cancel/error handling) and Settings slide-over (API key management, model selection, backend warning) wired to the Plan 02 IPC surface.

## Objective

Build the Evaluate panel and Settings slide-over for the JobEngine Electron app. EvaluatePanel streams markdown tokens from the Anthropic evaluation pipeline, shows a token-stats row on completion, and gracefully handles cancel + error states. SettingsSlideOver hosts API key entry with safeStorage-backed save, model selection, and backend warning display.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install markdown deps + create streaming/stats/error primitives | 062b992 | StreamingReportView.tsx, TokenStatsRow.tsx, InlineErrorBanner.tsx, globals.css |
| 2 | Create useEvaluationStream hook and EvaluatePanel assembly | 2dc4286 | useEvaluationStream.ts, ApiKeyBanner.tsx, EvaluatePanel.tsx |
| 3 | Build Settings slide-over with ApiKeyField, ModelSelect, VerifyButton, useApiKeyState | b1ddfab | useApiKeyState.ts, ApiKeyField.tsx, VerifyButton.tsx, ModelSelect.tsx, SettingsSlideOver.tsx |

## Exported Component Shapes (for Plan 05 App.tsx wiring)

```typescript
// EvaluatePanel — wire into App.tsx as 4th sidebar panel
import { EvaluatePanel } from './components/EvaluatePanel'
// Props:
interface EvaluatePanelProps {
  hasKey: boolean        // from useApiKeyState().hasKey
  backendWarning: string | null  // from useApiKeyState().backendWarning
  onOpenSettings: () => void     // → set settingsOpen(true)
}

// SettingsSlideOver — render at App.tsx root level
import { SettingsSlideOver } from './components/SettingsSlideOver'
// Props:
interface SettingsSlideOverProps {
  open: boolean          // state: settingsOpen
  onClose: () => void    // → set settingsOpen(false)
}

// useApiKeyState — call once at App.tsx level, pass results to EvaluatePanel
import { useApiKeyState } from './hooks/useApiKeyState'
const { hasKey, backendWarning, loading } = useApiKeyState()
```

The `useApiKeyState` hook should be hoisted to App.tsx so both EvaluatePanel (shows ApiKeyBanner) and SettingsSlideOver (saves key and refreshes state) share the same instance. Plan 05 will wire `onOpenSettings` in the gear icon footer button and toggle `settingsOpen` state.

## CSS Variable Adaptation

The plan specified `var(--base)`, `var(--surface0)`, `var(--mantle)` etc. The project uses Catppuccin Mocha via `--ctp-*` RGB triplet variables (e.g., `rgb(var(--ctp-base))`). All CSS was adapted accordingly. No conflicts with Phase 1 tokens — Phase 2 CSS is appended after the Phase 1 `:root` block.

`color-mix()` from the plan was replaced with `rgba()` literals for banner backgrounds (yellow/red/peach at 15% opacity) for broader Electron Chromium compatibility.

## Bundle Size Delta

react-markdown, remark-gfm, and rehype-sanitize were already present in electron/package.json from a prior installation (10.1.0, 4.0.1, 6.0.0 respectively). No new dependency install was required in this plan.

## Electron Sandbox / window.api Access

No issues. All new components and hooks access only `window.api.*` methods exposed by the Plan 02 contextBridge. No direct import of main-process modules. The renderer build remains fully sandboxed.

## TypeScript Verification

Verified via `electron/node_modules/.bin/tsc --noEmit` in the main repo (node_modules not present in worktree). Zero `error TS` lines for all 11 new files. Pre-existing errors in TrackerRow.tsx (JSX implicit any) are unrelated and out of scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Adaptation] CSS variable names adapted to project convention**
- **Found during:** Task 1 — reading globals.css revealed `--ctp-*` RGB triplet pattern, not generic `--base`/`--surface0`
- **Issue:** Plan used generic Catppuccin variable names that don't match the project's `--ctp-` prefix convention
- **Fix:** All CSS in globals.css adapted to use `rgb(var(--ctp-base))` etc. matching Phase 1 conventions
- **Files modified:** electron/src/renderer/styles/globals.css

**2. [Rule 2 - Adaptation] color-mix() replaced with rgba() literals**
- **Found during:** Task 1 CSS authoring
- **Issue:** `color-mix(in srgb, var(--red) 15%, transparent)` requires CSS Color 5 support; safer to use `rgba()` literals for banner tint backgrounds
- **Fix:** Used `rgba(243, 139, 168, 0.15)` for red tint, `rgba(249, 226, 175, 0.15)` for yellow, `rgba(250, 179, 135, 0.15)` for peach
- **Files modified:** electron/src/renderer/styles/globals.css

## Threat Mitigations Applied

- **T-02-21 (XSS):** `rehypeSanitize` plugin included in every StreamingReportView render; no `dangerouslySetInnerHTML` anywhere in Phase 2 renderer
- **T-02-27 (Tampering via preferences.json):** ModelSelect options are a fixed literal array; bogus preference values cannot inject HTML
- All other accepted threats (T-02-22 through T-02-26, T-02-28) are out of scope for renderer

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| electron/src/renderer/components/StreamingReportView.tsx | FOUND |
| electron/src/renderer/components/TokenStatsRow.tsx | FOUND |
| electron/src/renderer/components/InlineErrorBanner.tsx | FOUND |
| electron/src/renderer/components/EvaluatePanel.tsx | FOUND |
| electron/src/renderer/components/ApiKeyBanner.tsx | FOUND |
| electron/src/renderer/components/ApiKeyField.tsx | FOUND |
| electron/src/renderer/components/VerifyButton.tsx | FOUND |
| electron/src/renderer/components/ModelSelect.tsx | FOUND |
| electron/src/renderer/components/SettingsSlideOver.tsx | FOUND |
| electron/src/renderer/hooks/useEvaluationStream.ts | FOUND |
| electron/src/renderer/hooks/useApiKeyState.ts | FOUND |
| Commit 062b992 (Task 1) | FOUND |
| Commit 2dc4286 (Task 2) | FOUND |
| Commit b1ddfab (Task 3) | FOUND |
