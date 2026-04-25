# Phase 5: Electron Auto-Update - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add background update checking via `electron-updater` wired to GitHub Releases. On startup (after a 5-second delay), the app silently checks for a newer version. If one exists, a non-blocking banner appears at the top of the renderer with the version number, first 3 lines of release notes, and "Install Now" / "Later" buttons. "Install Now" triggers `autoUpdater.quitAndInstall()`; "Later" records the dismissed version so the same version is never re-prompted. The check is skipped entirely in dev mode and fails silently on network errors.

This phase does NOT build a custom update server — GitHub Releases with `provider: github` is the publish target.

</domain>

<decisions>
## Implementation Decisions

### Update Mechanism
- Use `electron-updater` (full ASAR update) — enables true one-click install per UPD-03
- Trigger check 5 seconds after `mainWindow` is shown (non-blocking startup)
- Check once per launch only — no background polling
- `electron-builder.yml`: `provider: github` with `owner/repo` — public releases, no token needed for checking

### UI Presentation
- Banner component matching existing `ApiKeyBanner` / `FileChangeBanner` pattern — top of renderer, above nav, non-blocking
- Show: version number + first 3 lines of release notes + "Install Now" + "Later" buttons
- IPC channels: `updater:check`, `updater:status`, `updater:install` — matches existing `ipcMain.handle` pattern

### Dismiss & Install Behavior
- "Later" stores dismissed version (e.g., in `app.getPath('userData')/dismissed-update.json`) — never re-prompts for same version; re-prompts automatically for a newer version
- "Install Now" calls `autoUpdater.quitAndInstall()` — electron-updater handles download + install on quit
- Dev mode guard: skip check entirely when `!app.isPackaged`
- Network errors: fail silently — log to console, no error banner shown to user

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ApiKeyBanner.tsx`, `FileChangeBanner.tsx`, `InlineErrorBanner.tsx` — banner components with dismiss pattern; UpdateBanner should match this style
- `ipc-handlers.ts` — `ipcMain.handle(channel, handler)` pattern; add updater handlers here
- `preload/index.ts` — exposes typed IPC bridge to renderer; add `updater` namespace
- `preload/types.ts` — shared TypeScript types; add `UpdaterStatus` interface here

### Established Patterns
- Main process services live in `electron/src/main/services/` — add `updater.ts` here
- App lifecycle hooks in `app.whenReady().then(async () => { ... })` in `index.ts` — add `initUpdater(mainWindow)` call after window is shown
- Renderer reads app state via IPC and renders conditional banners — same pattern for update banner

### Integration Points
- `index.ts` `app.whenReady()` block — add `setTimeout(() => initUpdater(mainWindow), 5000)` after `mainWindow.show()`
- `ipc-handlers.ts` — add `updater:check`, `updater:status`, `updater:install` handlers
- Top-level renderer layout (App.tsx or layout root) — mount `<UpdateBanner />` above nav

</code_context>

<specifics>
## Specific Ideas

- Store dismissed version in `app.getPath('userData')/dismissed-update.json` — userData is the standard Electron location for per-user app data; no custom path needed
- The `autoUpdater` from `electron-updater` emits `update-available`, `update-not-available`, `error`, `download-progress`, `update-downloaded` events — wire these to IPC pushes to the renderer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
