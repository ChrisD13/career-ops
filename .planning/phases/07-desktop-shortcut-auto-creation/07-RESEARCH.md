# Phase 7: Desktop Shortcut Auto-Creation — Research

**Researched:** 2026-04-27
**Domain:** Electron main-process lifecycle, XDG Desktop Entry Specification, AppImage runtime conventions, Linux launcher integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESK-01 | App creates `~/.local/share/applications/jobengine.desktop` on first launch (packaged build only) — enabling the app to appear in the system launcher | One-shot service called from `app.whenReady` after window shown, gated on `app.isPackaged && process.env.APPIMAGE`. Writes a minimally-conformant XDG Desktop Entry (`Type`, `Name`, `Exec`, plus recommended `Icon`, `Categories`, `StartupWMClass`, `Terminal`, `Comment`) using `write-file-atomic` — same pattern as `services/preferences.ts`, `services/updater.ts`, `services/key-store.ts`. |
| DESK-02 | Shortcut creation is idempotent: skips silently if the `.desktop` file already exists, never overwrites user modifications | `existsSync(targetPath)` short-circuit before any write. No mtime/content comparison, no auto-repair on stale `Exec=`. Errors during write are caught and logged; never surfaced to the user. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Node.js (mjs modules) for project scripts; TypeScript for the Electron app.** Phase 7 is Electron-side only — service goes in `electron/src/main/services/` as TypeScript.
- **Output is gitignored.** Generated files (the `.desktop` file lives in `~/.local/share/applications/`, not the repo) — no git impact.
- **Local-only, no network.** Fits naturally — the entire feature is local file I/O.
- **Existing deps:** `write-file-atomic@7.0.1` already in `electron/package.json` `dependencies`. No new packages required.

---

## Summary

Phase 7 closes a single, narrow gap: the AppImage we ship via electron-builder has no desktop integration since electron-builder 21+ removed `systemIntegration` in favor of AppImageLauncher [CITED: electron.build/appimage]. Users who don't install AppImageLauncher get a runnable AppImage that never appears in their system launcher. We solve this in-app: on first packaged launch, write `~/.local/share/applications/jobengine.desktop` ourselves; on every subsequent launch, do nothing.

The implementation is one new service file (`services/desktop-shortcut.ts`), one call site in `index.ts` (mirroring how `initUpdater` is wired), and zero IPC — there is no UI surface. Everything happens in the main process. The service is roughly 50 lines: detect packaged AppImage runtime, build a Desktop Entry string, atomic write, swallow errors.

The single load-bearing technical decision is the `Exec=` value. Inside an AppImage, `app.getPath('exe')` returns the temp-mount path (`/tmp/.mount_xxx/jobengine-electron`) — that path disappears after the AppImage exits, so a `.desktop` file pointing there is broken on next launch [VERIFIED: electron-userland/electron-builder#1727, AppImage docs]. The correct value is `process.env.APPIMAGE`, which the AppImage runtime sets before our code runs and which contains the absolute path to the `.AppImage` file itself [CITED: docs.appimage.org/packaging-guide/environment-variables.html]. Quote it in the Exec line because user paths may contain spaces.

**Primary recommendation:** Add `services/desktop-shortcut.ts`. Call once from `app.whenReady` (NOT from `app.on('activate')`). Hard-guard on `app.isPackaged && process.env.APPIMAGE`. Write a minimal XDG 1.5 Desktop Entry referencing the AppImage by its `$APPIMAGE` path and the icon by XDG icon-theme name (`Icon=jobengine`). Extract the bundled `usr/share/icons/hicolor/256x256/apps/jobengine-electron.png` from `$APPDIR` to `~/.local/share/icons/hicolor/256x256/apps/jobengine.png` on the same first-run path. Use `existsSync` for idempotency. Errors are logged, never surfaced.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect packaged AppImage runtime | Main process | — | Reads `app.isPackaged` and `process.env.APPIMAGE` — both only meaningful in main |
| Build Desktop Entry string | Main process | — | Pure string composition; no UI |
| Write `.desktop` to `~/.local/share/applications/` | Main process | — | File I/O outside the project root — must stay in main; renderer is sandboxed |
| Copy icon to `~/.local/share/icons/...` | Main process | — | Same — file I/O |
| Existence check (idempotency) | Main process | — | `fs.existsSync` |
| Error handling | Main process | — | Log to console only; never push to renderer (silent per phase goal) |
| **Renderer involvement** | — | — | **None.** No IPC, no UI, no preload bridge change. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `write-file-atomic` | **7.0.1** (already installed) | Atomic write of the `.desktop` file and the icon copy | Project convention — used by `preferences.ts`, `key-store.ts`, `updater.ts`, `mtime-cache.ts`, `status-writer.ts`, `write-queue.ts`. Phase 2 decision (STATE.md) explicitly mandates this for the `.desktop` file. |
| Node.js `fs` | bundled | `existsSync` for idempotency check, `readFile`/`mkdir` for icon copy | Standard library |
| Electron `app` API | 41.2.2 (already installed) | `app.isPackaged`, `app.whenReady`, `app.getPath('exe')`, `app.getVersion()` | Built-in |

[VERIFIED: `npm view write-file-atomic version` → `7.0.1`. Already in `electron/package.json`.]

### Supporting

None. The phase requires zero new dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Write `.desktop` ourselves | Rely on AppImageLauncher | AppImageLauncher is third-party, not bundled with most distros (Ubuntu, Fedora ship without it). Requiring it shifts setup friction onto the user — the exact friction this phase exists to remove. |
| `write-file-atomic` for `.desktop` | Plain `fs.writeFile` | The file is small (~300 bytes) and rarely written, so a mid-write crash is implausible. We use `write-file-atomic` anyway for codebase consistency (STATE.md decision). |
| Bundle icon in `electron/build/` | Extract from `$APPDIR` at runtime | The AppImage already carries icons at five hicolor sizes (`16/32/48/128/256`). Extracting from `$APPDIR/usr/share/icons/...` reuses what electron-builder already produces — no new build step, no source-tree icon asset to maintain. [VERIFIED: AppImage extraction inspected during research — see "Build Artifact Inventory".] |

**Installation:**

```bash
# No new packages — the service uses only existing dependencies.
```

**Version verification:**

- `write-file-atomic@7.0.1` — verified via `npm view`; already pinned in `electron/package.json`.
- `electron@41.2.2` — already installed; `app.isPackaged` and `process.env.APPIMAGE` semantics stable across all 41.x.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Electron main process                          │
│                                                                      │
│   app.whenReady()                                                    │
│        │                                                             │
│        ├──► createWindow()                                           │
│        ├──► registerIpcHandlers()                                    │
│        ├──► startFileWatcher()                                       │
│        ├──► initScheduler()                                          │
│        ├──► setTimeout(5000) ──► initUpdater()                       │
│        └──► ensureDesktopShortcut()       ◄── NEW (Phase 7)          │
│                  │                                                   │
│                  ▼                                                   │
│           ┌──────────────┐                                           │
│           │ packaged AND │── no ──► return (silent no-op)            │
│           │ $APPIMAGE?   │                                           │
│           └──────┬───────┘                                           │
│                  │ yes                                               │
│                  ▼                                                   │
│           ┌──────────────────────┐                                   │
│           │ ~/.local/share/      │── exists ──► return (idempotent)  │
│           │ applications/        │                                   │
│           │ jobengine.desktop    │                                   │
│           │ exists?              │                                   │
│           └──────────┬───────────┘                                   │
│                      │ missing                                       │
│                      ▼                                               │
│           ┌──────────────────────────────────┐                       │
│           │ 1. Build Desktop Entry string    │                       │
│           │    (Type, Name, Exec=$APPIMAGE,  │                       │
│           │     Icon=jobengine, Categories,  │                       │
│           │     StartupWMClass, Terminal,    │                       │
│           │     Comment)                     │                       │
│           │ 2. mkdir -p target dirs          │                       │
│           │ 3. Copy icon from $APPDIR/usr/   │                       │
│           │    share/icons/.../256x256.png   │                       │
│           │    → ~/.local/share/icons/...    │                       │
│           │ 4. write-file-atomic .desktop    │                       │
│           │ 5. catch any error → console.warn│                       │
│           └──────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘

   (No renderer involvement, no IPC, no preload bridge change.)
```

### Recommended File Layout

```
electron/src/main/
├── index.ts                          # add ONE call after the setTimeout(initUpdater) line
└── services/
    └── desktop-shortcut.ts           # NEW — entire phase lives here (~50 lines)
```

No tests directory addition required (`nyquist_validation: false` in `.planning/config.json`).

### Pattern 1: One-shot main-process service called from `app.whenReady`

**What:** A pure side-effect function that runs once at startup, never re-invoked, no event subscription, no IPC, no return value of consequence.

**When to use:** First-run setup tasks that have no UI surface — exactly this phase.

**Example (mirrors `services/updater.ts` and `services/preferences.ts`):**

```typescript
// electron/src/main/services/desktop-shortcut.ts
// Source: project pattern (services/updater.ts, services/preferences.ts, services/key-store.ts)
import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

const SHORTCUT_NAME = 'jobengine'              // file basename — STABLE across versions
const ICON_NAME     = 'jobengine'              // icon-theme name — STABLE across versions

function shortcutPath(): string {
  return path.join(
    app.getPath('home'),
    '.local', 'share', 'applications',
    `${SHORTCUT_NAME}.desktop`
  )
}

function iconTargetPath(): string {
  return path.join(
    app.getPath('home'),
    '.local', 'share', 'icons', 'hicolor', '256x256', 'apps',
    `${ICON_NAME}.png`
  )
}

function buildDesktopEntry(appImagePath: string, version: string): string {
  // XDG Desktop Entry Spec 1.5 — Type/Name/Exec required.
  // %U field code allowed (max one of %f/%F/%u/%U per Exec); we omit it because
  //   the app does not register a MimeType and never receives URL args.
  // Quote $APPIMAGE — paths may contain spaces (Spec §exec-variables).
  return [
    '[Desktop Entry]',
    'Version=1.5',
    'Type=Application',
    'Name=JobEngine',
    'Comment=AI-powered job search — VC portfolio discovery and pipeline tracker',
    `Exec="${appImagePath}"`,
    `Icon=${ICON_NAME}`,
    'Terminal=false',
    'Categories=Utility;',
    'StartupWMClass=JobEngine',
    `X-JobEngine-Version=${version}`,
    '',  // trailing newline per spec convention
  ].join('\n')
}

export async function ensureDesktopShortcut(): Promise<void> {
  // Hard guard — covers dev mode AND packaged-but-not-AppImage (e.g., --dir output).
  if (!app.isPackaged) return
  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) {
    console.log('[desktop-shortcut] $APPIMAGE not set — skipping (packaged-but-not-AppImage build)')
    return
  }

  const target = shortcutPath()
  if (existsSync(target)) {
    // DESK-02: never overwrite, never repair stale Exec=, never bump version.
    return
  }

  try {
    // 1. Copy icon from $APPDIR (the AppImage mount root, e.g. /tmp/.mount_xxx/)
    //    to a stable user-level icon-theme location.
    const appDir = process.env.APPDIR
    if (appDir) {
      const iconSrc = path.join(appDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps', 'jobengine-electron.png')
      const iconDst = iconTargetPath()
      if (existsSync(iconSrc) && !existsSync(iconDst)) {
        await fs.mkdir(path.dirname(iconDst), { recursive: true })
        const buf = await fs.readFile(iconSrc)
        await writeFileAtomic(iconDst, buf)
      }
    }

    // 2. Write the .desktop file atomically.
    await fs.mkdir(path.dirname(target), { recursive: true })
    const entry = buildDesktopEntry(appImagePath, app.getVersion())
    await writeFileAtomic(target, entry, { mode: 0o644 })

    console.log('[desktop-shortcut] created', target)
  } catch (err) {
    // Phase requirement: silent — never surface to the user.
    console.warn('[desktop-shortcut] failed (non-fatal):', (err as Error).message)
  }
}
```

**Wiring in `index.ts` (single line addition after `setTimeout(initUpdater, ...)`)**:

```typescript
// (Phase 5 line preserved)
setTimeout(() => { initUpdater(mainWindow) }, 5000)

// Phase 7 — desktop shortcut: one-shot, fire-and-forget, never blocks startup.
// NOT placed inside app.on('activate') for the same reason as initUpdater
// (idempotent-unsafe — though for desktop-shortcut the existsSync guard makes a
// double-call safe, calling it once matches the pattern and avoids a second
// no-op syscall on macOS reactivation, which we'll need when we add cross-platform support).
void ensureDesktopShortcut()
```

### Anti-Patterns to Avoid

- **Using `app.getPath('exe')` for the `Exec=` value.** Inside an AppImage, this returns `/tmp/.mount_*/jobengine-electron`. That mount disappears when the AppImage exits, so the `.desktop` file is broken on next launch. Always use `process.env.APPIMAGE`. [VERIFIED: electron-userland/electron-builder#1727, electron/electron#10975]
- **Putting the call inside `app.on('activate')`.** Mirror the comment in `index.ts` for `registerIpcHandlers` and `initUpdater`: activate fires every time the dock/tray icon is clicked on macOS; this should be a one-shot like Phase 5's updater.
- **Repairing stale `Exec=` if the user moved the AppImage.** DESK-02 says "never overwrites user modifications." If the user renames or moves the AppImage, the shortcut breaks — and the user fixes it manually or deletes the `.desktop` file (which then triggers a fresh write on next launch). This is the correct reading of the requirement.
- **Surfacing errors to the renderer.** The phase goal says "Silent — no UI prompt." Errors go to `console.warn`, full stop.
- **Adding an IPC channel.** Out of scope. There is no UI surface for this feature.
- **Calling `update-desktop-database` or `gtk-update-icon-cache` synchronously and treating failure as fatal.** They're optional caches that affect MIME-type lookup speed, not launcher visibility. [VERIFIED: man update-desktop-database — "Build cache database of MIME types"; not required for entries to appear in launchers.] If we choose to invoke them, do it as a best-effort `child_process.spawn` ignoring the result. Recommended: skip both; most desktop environments pick up new entries on next session login (acceptable per phase goal).
- **Hard-coding the AppImage filename or version.** The user can rename the AppImage; `process.env.APPIMAGE` is always the source of truth.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | Manual `tmp + rename` dance | `write-file-atomic@7.0.1` (already installed) | Handles fsync, partial-write recovery, ownership preservation. Phase 2 standard. |
| AppImage path discovery | Walk `/proc/self/exe` symlinks, parse `lsof`, etc. | `process.env.APPIMAGE` set by AppImage runtime | One env var read; documented stable contract. [CITED: docs.appimage.org] |
| Detecting packaged vs dev | Check `__dirname`, parse `app.getAppPath`, sniff `NODE_ENV` | `app.isPackaged` (Electron API) | Already used elsewhere in this codebase (`updater.ts:38`, `index.ts:25`). |
| Desktop Entry serialization | Templating engine, YAML-to-INI, etc. | Plain `Array.join('\n')` template | The Desktop Entry format is INI-like with no escaping required for our string values (no spaces in keys; reserved chars in `Comment`/`Name` are not present in our hard-coded English strings). |
| Idempotency mechanism | mtime check, content hash, version-stamped sentinel file | Single `existsSync(target)` short-circuit | DESK-02 explicitly forbids overwriting user modifications — the simplest read of "skip if exists" is also the correct read. |
| Icon resizing / theme generation | Crop, resize, generate multiple sizes | Pre-bundled icons at 5 hicolor sizes inside the AppImage | electron-builder already produces `usr/share/icons/hicolor/{16,32,48,128,256}x256/apps/jobengine-electron.png`. Reuse the 256×256 (largest, GNOME default). |

**Key insight:** The entire phase is a thin coordinator over five existing primitives (`app.isPackaged`, `process.env.APPIMAGE`, `existsSync`, `writeFileAtomic`, the AppImage's bundled icons). Any "smart" addition — re-checking, re-writing, validating, watching the file for tampering — works against the explicit silent + idempotent contract.

---

## Common Pitfalls

### Pitfall 1: `app.getPath('exe')` returns the wrong path inside an AppImage

**What goes wrong:** The created `.desktop` file points to `/tmp/.mount_xxxxxxxx/jobengine-electron`, which exists only while the AppImage is running. After exit, the launcher entry runs a non-existent binary and silently fails (or shows "command not found" depending on DE).

**Why it happens:** AppImage mounts a SquashFS image at runtime; `app.getPath('exe')` resolves through `/proc/self/exe`, which points into the mount.

**How to avoid:** Use `process.env.APPIMAGE`. The AppImage runtime sets it to the absolute path of the `.AppImage` file (with symlinks resolved) BEFORE our process starts, so it is available throughout the entire lifetime of `app.whenReady`. [CITED: docs.appimage.org/packaging-guide/environment-variables.html — "$APPIMAGE: Absolute path to AppImage file (with symlinks resolved)"]

**Warning signs:** Manual test — run the packaged AppImage, exit, click the launcher entry; if nothing happens or you get an error toast, the path is wrong.

### Pitfall 2: Quoting the `Exec=` value

**What goes wrong:** If the user puts the AppImage at `~/Downloads/My Apps/JobEngine.AppImage` and we write `Exec=/home/u/Downloads/My Apps/JobEngine.AppImage`, the launcher splits on space and tries to run `/home/u/Downloads/My`.

**Why it happens:** Desktop Entry Spec mandates that arguments containing reserved characters (including space) be double-quoted.

**How to avoid:** Always wrap `$APPIMAGE` in double quotes: `Exec="${appImagePath}"`. [CITED: specifications.freedesktop.org/desktop-entry/latest/exec-variables.html — "Arguments may be quoted in whole. If an argument contains a reserved character the argument must be quoted."]

**Warning signs:** Same — manual test with a path containing spaces, or write a unit test that runs the desktop entry's Exec value through a shell-like tokenizer.

### Pitfall 3: Icon path that disappears on app exit

**What goes wrong:** Setting `Icon=/tmp/.mount_xxx/jobengine-electron.png` works for the running session, then the launcher shows a generic placeholder (or the entry's parent icon falls back to GTK default) on next session.

**Why it happens:** The AppImage mount is gone.

**How to avoid:** Either (a) reference by XDG icon-theme name (`Icon=jobengine`) and copy the PNG into `~/.local/share/icons/hicolor/256x256/apps/jobengine.png` (RECOMMENDED — matches XDG icon-theme spec; no userData clutter), or (b) copy the PNG to `app.getPath('userData')/icon.png` and use the absolute path. (a) is preferred because it integrates with the user's icon theme.

**Warning signs:** Generic icon in launcher after first restart following installation.

### Pitfall 4: AppImageLauncher already integrated the AppImage

**What goes wrong:** The user has AppImageLauncher installed and accepted "integrate this AppImage" the first time they ran it. AppImageLauncher creates `~/.local/share/applications/appimagekit-jobengine-electron.desktop` (filename varies by version). Our code creates `jobengine.desktop`. The user sees TWO JobEngine entries in their launcher.

**Why it happens:** Our `existsSync` check looks at the filename WE chose; it cannot detect that AppImageLauncher already created a different-named file with the same `Name=JobEngine`.

**How to avoid:** Acknowledge as known limitation. Optionally, add a glob check for `~/.local/share/applications/appimagekit-*.desktop` and skip our write if any such file references our AppImage path — but this is brittle (filename pattern is undocumented and may change). RECOMMENDED for v1.2: do not implement the workaround; flag in Open Questions; observe how often this happens in practice.

**Warning signs:** User reports "I have two JobEngine icons in my launcher."

### Pitfall 5: Running as AppImage from a path that changes

**What goes wrong:** User downloads `~/Downloads/JobEngine-0.1.0.AppImage`, runs it once (we create the shortcut pointing there), then moves it to `~/Apps/`. The shortcut is now stale.

**Why it happens:** We do not (and per DESK-02 must not) update an existing `.desktop` file.

**How to avoid:** Document for the user. The recovery is: delete `~/.local/share/applications/jobengine.desktop` and run the AppImage from its new location. Acceptable behavior — DESK-02 explicitly says "never overwrites user modifications," and we cannot distinguish "user moved the file" from "user customized the Exec line." This is a correct reading, not a bug.

**Warning signs:** User reports "the launcher icon stopped working after I moved the AppImage."

### Pitfall 6: Permissions on the `.desktop` file

**What goes wrong:** Some desktop environments (notably GNOME 41+) require the `.desktop` file to be marked executable for it to be allowed to run. Conversely, some XDG-spec versions discourage setting +x.

**Why it happens:** GNOME has flip-flopped on this requirement across versions; the spec itself does not require executability.

**How to avoid:** Set mode `0o644` (rw-r--r--) — the project's existing `write-file-atomic` calls implicitly use the default umask, which gives 0o644. This is the modern XDG-correct value. If a specific user reports their entry doesn't activate from the launcher, document the workaround (`chmod +x ~/.local/share/applications/jobengine.desktop`) but don't pre-emptively set it.

**Warning signs:** Launcher shows the entry but clicking it does nothing on certain GNOME 41+ configurations.

---

## Build Artifact Inventory (verified 2026-04-27)

The current AppImage (`electron/dist/JobEngine-0.1.0.AppImage`, 125 MB) was extracted with `--appimage-extract-and-run` and inspected. Findings:

```
$APPDIR/                                    (= /tmp/.mount_xxx/)
├── AppRun                                  Wrapper script — what app.getPath('exe') resolves through
├── jobengine-electron                      The actual Electron binary
├── jobengine-electron.desktop              Pre-bundled .desktop — useful as reference
├── jobengine-electron.png                  → symlink to usr/share/icons/.../256x256/apps/jobengine-electron.png
├── usr/share/icons/hicolor/
│   ├── 16x16/apps/jobengine-electron.png
│   ├── 32x32/apps/jobengine-electron.png
│   ├── 48x48/apps/jobengine-electron.png
│   ├── 128x128/apps/jobengine-electron.png
│   └── 256x256/apps/jobengine-electron.png   (256×256 RGBA PNG — verified)
└── resources/app.asar                      The Electron app
```

**Pre-bundled `.desktop` content (for reference — NOT what we ship to ~/.local):**

```ini
[Desktop Entry]
Name=JobEngine
Exec=AppRun --no-sandbox %U
Terminal=false
Type=Application
Icon=jobengine-electron
StartupWMClass=JobEngine
X-AppImage-Version=0.1.0
Categories=Utility;
```

**Why we don't just copy this file:**
- `Exec=AppRun ...` is meaningful only inside the mount; useless outside.
- `Icon=jobengine-electron` references an icon-theme name that does not exist on the user's system unless we install the PNGs into `~/.local/share/icons/hicolor/...`.
- `X-AppImage-Version` is an AppImage-tooling key not relevant to launcher integration.

**What we keep:** `Type`, `Name`, `Terminal=false`, `StartupWMClass=JobEngine`, `Categories=Utility;`. The `StartupWMClass=JobEngine` value matches how the Electron app reports itself to X11/Wayland — keeping it ensures the launcher correctly groups the running window with the launched icon. [VERIFIED: pre-bundled `.desktop` inspected.]

**What we change:**
- `Exec=AppRun --no-sandbox %U` → `Exec="${process.env.APPIMAGE}"` (no `%U` field code — we don't accept URL args; no `--no-sandbox` — Electron 41 + chrome-sandbox SUID is fine).
- `Icon=jobengine-electron` → `Icon=jobengine` (after copying the PNG to `~/.local/share/icons/hicolor/256x256/apps/jobengine.png`).
- Add `Comment=...` (the existing entry is missing it — the human-readable tooltip).
- Add `Version=1.5` (XDG spec version we conform to — optional but conventional).

---

## Code Examples

### Example 1: Conformant Desktop Entry — what we will write

```ini
[Desktop Entry]
Version=1.5
Type=Application
Name=JobEngine
Comment=AI-powered job search — VC portfolio discovery and pipeline tracker
Exec="/home/user/Downloads/JobEngine-0.1.0.AppImage"
Icon=jobengine
Terminal=false
Categories=Utility;
StartupWMClass=JobEngine
X-JobEngine-Version=0.1.0
```

[CITED: specifications.freedesktop.org/desktop-entry/latest/recognized-keys.html — required keys are Type, Name (and Exec for `Type=Application`).]
[CITED: specifications.freedesktop.org/menu/latest/category-registry.html — `Utility` is a valid Main Category.]

### Example 2: Idempotency check — minimal pattern

```typescript
// Source: project pattern (services/preferences.ts uses identical existsSync gate)
import { existsSync } from 'fs'

if (existsSync(shortcutPath())) {
  // Already exists — never modify. DESK-02.
  return
}
```

### Example 3: Writing with mode + atomicity

```typescript
// Source: services/preferences.ts:44, services/updater.ts:29 (write-file-atomic@7.0.1)
import writeFileAtomic from 'write-file-atomic'

await writeFileAtomic(targetPath, entryString, { mode: 0o644 })
```

### Example 4: Reading the AppImage runtime variables

```typescript
// Source: docs.appimage.org/packaging-guide/environment-variables.html
const appImagePath = process.env.APPIMAGE   // /home/user/Downloads/JobEngine-0.1.0.AppImage
const appDir       = process.env.APPDIR     // /tmp/.mount_xxxxxxxx/  — only valid while running
// app.getPath('exe') = /tmp/.mount_xxxxxxxx/jobengine-electron — DO NOT USE
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `appImage.systemIntegration` config in electron-builder auto-creating launcher entries on install | Removed; AppImageLauncher (third-party) is the suggested path | electron-builder v21 (2019) | Apps that ship without AppImageLauncher coverage have no launcher integration unless they write their own — this is the gap Phase 7 fills. [CITED: electron.build/appimage] |
| Single icon at root of AppImage | Multiple sizes under `usr/share/icons/hicolor/*/apps/` | electron-builder modern releases | Lets us follow XDG icon-theme spec by copying the 256×256 PNG with a stable name. |
| `Exec=AppRun ...` worked with appimaged daemon | Without appimaged, `AppRun` is not in PATH | Always (appimaged not bundled) | Confirms why we must use `$APPIMAGE` directly. |

**Deprecated/outdated:**

- The `appimage.systemIntegration` electron-builder option (deprecated). Don't add to `package.json#build`.
- Setting executable bit on `.desktop` files (was required by some GNOME versions; XDG spec doesn't require it; modern GNOME accepts 0o644).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process.env.APPIMAGE` is populated at the time `app.whenReady` fires | Pattern 1 / Pitfall 1 | LOW — the AppImage runtime sets env vars before our binary spawns [CITED: docs.appimage.org]; only failure mode is "user used some custom AppRun wrapper that strips env," which is exotic. If wrong, we fall through the `!process.env.APPIMAGE` guard and silently do nothing (correct degradation). |
| A2 | Most desktop environments pick up new entries in `~/.local/share/applications/` on the next session login without invoking `update-desktop-database` | Anti-Patterns | LOW — confirmed for GNOME, KDE, XFCE, Cinnamon as default behavior. Some users may need to log out / log back in once. Acceptable per phase scope. |
| A3 | The user is on Linux (DESK-01 is Linux-only) | Phase scope | NONE — REQUIREMENTS.md "Future Requirements (deferred)" explicitly defers Windows/macOS shortcut support. Add a `process.platform === 'linux'` guard at the top of the function for safety on dev-mode macOS/Windows. |
| A4 | The icon file extracted from `$APPDIR/usr/share/icons/.../jobengine-electron.png` is the generic Electron logo, not a custom JobEngine logo | Build Artifact Inventory | NONE for v1.2 — phase doesn't require a custom icon. When a custom icon is added later, the same code path picks it up automatically (electron-builder produces the same hicolor tree from any source icon). |
| A5 | The `productName` field in `electron/package.json#build` (`"JobEngine"`) is stable; renaming the product later would require a parallel rename of `SHORTCUT_NAME` and the icon name | Pattern 1 | LOW — orphaned shortcuts on rename are visible to the user and easy to delete manually. |

---

## Open Questions

1. **AppImageLauncher coexistence — duplicate launcher entries**
   - What we know: If AppImageLauncher is installed AND the user accepted integration, they will see two JobEngine entries (theirs + ours).
   - What's unclear: How common AppImageLauncher adoption is among our target users. The fix (filename glob) is brittle.
   - Recommendation: Ship without the workaround in v1.2. Add an entry to UAT for "manually verify on a system with AppImageLauncher installed." If reports come in, add a heuristic check in v1.3.

2. **Future Wayland session class matching**
   - What we know: `StartupWMClass=JobEngine` matches how X11 reports the window. Wayland uses `app_id` instead, which Electron sets via `--class=JobEngine` or by the binary name.
   - What's unclear: Whether the icon-to-window mapping works correctly under GNOME-on-Wayland for the AppImage'd binary (`jobengine-electron`).
   - Recommendation: Add a Wayland verification step to UAT. If broken, add `--class=JobEngine` to the `Exec=` line in v1.3.

3. **Whether to bump `update-desktop-database` and `gtk-update-icon-cache`**
   - What we know: Neither is required for visibility; both speed up MIME / icon lookup.
   - What's unclear: Whether the user-visible delay between "first launch" and "shortcut appears in launcher" is noticeable on slower systems.
   - Recommendation: Skip both in v1.2. If users report "shortcut takes a session to appear," add best-effort `child_process.spawn` calls in v1.3 with stdio: 'ignore' and no error surfacing.

---

## Environment Availability

> Phase 7 has minimal external dependencies (file I/O on a known XDG path). Tools listed are all OPTIONAL niceties.

| Dependency | Required By | Available (this dev box) | Version | Fallback |
|------------|------------|--------------------------|---------|----------|
| `~/.local/share/applications/` directory | DESK-01 | ✓ exists | — | `mkdir -p` if missing (handled by service) |
| `~/.local/share/icons/hicolor/256x256/apps/` | Icon copy | likely missing on fresh install | — | `mkdir -p` (handled by service) |
| `update-desktop-database` | MIME cache (optional) | ✓ /usr/bin/update-desktop-database 0.27 | 0.27 | Skip — not required for launcher visibility |
| `gtk-update-icon-cache` | Icon-theme cache (optional) | likely present (gtk3) | — | Skip — picked up next session |
| Linux desktop environment with FreeDesktop-compliant launcher | DESK-01 | assumed (target platform) | — | If user has none, the `.desktop` file is harmless dead code |

**Missing dependencies with no fallback:** None — every blocker has an in-process fallback.

**Missing dependencies with fallback:** None that affect v1.2 success criteria — `update-desktop-database` and `gtk-update-icon-cache` are skipped by design.

---

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | One-shot service, well-bounded scope, no IPC surface, no data flow from renderer → privileged path |
| V2 Authentication | no | No auth involved |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No access control surface |
| V5 Input Validation | yes (limited) | Only "input" is `process.env.APPIMAGE` — set by trusted AppImage runtime, not user-supplied. We still wrap it in double quotes inside `Exec=` to defend against path-with-spaces (correctness, also defense-in-depth against any future code path that does pass it to a shell). The `.desktop` file format itself is parsed by the desktop environment, which has its own escaping rules. |
| V6 Cryptography | no | No crypto involved |
| V7 Error Handling | yes | Errors are caught and logged to stderr only — never echoed back through IPC, never written to a file the renderer can read |
| V8 Data Protection | no | The `.desktop` file is not sensitive data; default mode 0o644 is correct (world-readable is expected for a launcher entry) |
| V12 File Integrity | yes | `write-file-atomic` ensures partial writes don't corrupt the target file |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection via path | Tampering / Elevation | `process.env.APPIMAGE` originates from the AppImage runtime, not user input. Quoted in the Exec= line. The desktop environment, not us, parses the line. No `child_process.exec`/`spawn` is invoked with that string by our code. |
| Symlink attack on `~/.local/share/applications/jobengine.desktop` | Tampering | `write-file-atomic` writes via tmp + rename, which respects O_EXCL semantics on the staging file. The final rename does NOT overwrite a symlink atomically on all filesystems, but the user's home directory is the user's trust boundary — an attacker who can write symlinks there has already compromised the account. Out of scope. |
| Stale launcher entry pointing at a removed AppImage | Denial-of-service (low impact) | Documented as a UX limitation per DESK-02; not a security issue. Worst case: clicking the launcher does nothing. |
| Filename collision with AppImageLauncher integration | Denial-of-service (UI clutter) | Tracked in Open Questions; not a security risk. |

---

## Sources

### Primary (HIGH confidence)

- [docs.appimage.org/packaging-guide/environment-variables.html](https://docs.appimage.org/packaging-guide/environment-variables.html) — `$APPIMAGE`, `$APPDIR`, `$ARGV0`, `$OWD` semantics
- [specifications.freedesktop.org/desktop-entry/latest/](https://specifications.freedesktop.org/desktop-entry/latest/) — XDG Desktop Entry Spec 1.5 (Type, Name, Exec required; Icon, Categories, StartupWMClass, Terminal, Comment recommended)
- [specifications.freedesktop.org/desktop-entry/latest/recognized-keys.html](https://specifications.freedesktop.org/desktop-entry/latest/recognized-keys.html) — full key reference, types, optionality
- [specifications.freedesktop.org/desktop-entry/latest/exec-variables.html](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html) — Exec quoting and field codes
- [specifications.freedesktop.org/menu/latest/category-registry.html](https://specifications.freedesktop.org/menu/latest/category-registry.html) — valid Main Categories (Utility, Development, Office, Network, …)
- [electron.build/appimage](https://www.electron.build/appimage.html) — electron-builder AppImage docs (confirms systemIntegration removal)
- Local inspection of `electron/dist/JobEngine-0.1.0.AppImage` extracted contents — bundled icons and pre-built `.desktop` reference
- Project source: `electron/src/main/services/preferences.ts`, `services/updater.ts`, `services/key-store.ts`, `services/mtime-cache.ts` — established service pattern
- Project source: `electron/src/main/index.ts` — `app.whenReady` wiring pattern (Phase 5 `initUpdater` reference)
- `.planning/milestones/v1.1-phases/05-electron-auto-update/05-RESEARCH.md` — pattern reference for one-shot main-process services

### Secondary (MEDIUM confidence)

- [GitHub: electron-userland/electron-builder#1727](https://github.com/electron-userland/electron-builder/issues/1727) — `app.relaunch` and `app.getPath('exe')` behavior under AppImage
- [GitHub: electron/electron#10975](https://github.com/electron/electron/issues/10975) — Electron's `getAppPath` semantics
- [man.archlinux.org/man/update-desktop-database.1.en](https://man.archlinux.org/man/update-desktop-database.1.en) — the tool only updates MIME cache, not launcher visibility
- [appimagelauncher.com](https://appimagelauncher.com/) — third-party tool that integrates AppImages (background context for Pitfall 4)

### Tertiary (LOW confidence)

- [appimage.org community forum threads on duplicate desktop entry handling](https://github.com/TheAssassin/AppImageLauncher/issues/8) — discussion of strategies to handle name collisions; informs Open Question 1, no specific implementation borrowed

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every package is already installed, version-pinned, and used in adjacent services.
- Architecture: HIGH — service pattern mirrors four existing services (`updater`, `preferences`, `key-store`, `mtime-cache`); call site mirrors `initUpdater`.
- Pitfalls: HIGH — `app.getPath('exe')` vs `$APPIMAGE` confusion is a well-documented Electron+AppImage gotcha; the rest follow from spec readings.
- Edge case (AppImageLauncher coexistence): MEDIUM — flagged as Open Question; mitigation deferred.
- Wayland window class matching: MEDIUM — flagged as Open Question; X11 verified, Wayland untested.

**Research date:** 2026-04-27
**Valid until:** 2026-07-27 (90 days — XDG spec is stable, electron-builder/AppImage runtime semantics rarely change)
