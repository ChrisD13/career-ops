# Phase 8: CV Upload & PDF Extraction - Research

**Researched:** 2026-04-24
**Domain:** Electron file picker + PDF text extraction + atomic file write
**Confidence:** HIGH (codebase patterns), MEDIUM (PDF library — see Open Questions)

## Summary

Phase 8 extends CvPanel with an "Update CV" button that opens an Electron file picker, accepts `.md` (passthrough) or `.pdf` (text extraction in main process), shows a review/edit modal for PDFs, then a confirmation modal showing the current `cv.md` mtime, and finally writes via the existing `lockAndWrite` path. The UI contract is fully specified by `08-UI-SPEC.md`; the IPC surface is small (two new handles: `openCvFilePicker`, `updateCv`); writes reuse the project-standard `write-queue.ts`.

The single substantive risk is the **PDF library choice**. CONTEXT.md locked `pdf-parse` and described it as "lightweight (~100KB), pure Node.js, zero extra infrastructure." That description does not match either available `pdf-parse` line: v1.1.x is ~28MB unpacked (bundles pdfjs builds) and v2.x requires `@napi-rs/canvas` native binaries plus worker setup. We can still ship `pdf-parse@1.1.4` cleanly (the longstanding ENOENT bug was fixed in Oct 2025), but the planner should know the lock rests on a partly-incorrect premise — and `unpdf` (~2MB, no native deps, modern, actively maintained as of April 2026) is a strictly cleaner fit for the stated constraints if the user wants to revisit.

**Primary recommendation:** Pin `pdf-parse@1.1.4` (legacy v1 API: `pdf(buffer) → {text, numpages}`) per the locked decision. Implement `openCvFilePicker` and `updateCv` as two main-process IPC handlers. Open the file dialog window-modal against the existing `BrowserWindow`. Run extraction in main, never renderer. Reuse `lockAndWrite` for the cv.md write. Surface the pdf-parse version mismatch in CONTEXT.md as an Open Question to the user before execution.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PDF Extraction Library**
- Library: `pdf-parse` — described in CONTEXT as "lightweight (~100KB), pure Node.js, zero extra infrastructure" *(see Open Question 1 — this description does not match the actual package)*
- Output: raw text block (no AI reformatting, no structure inference)
- Extraction failure UX: inline error in panel — "Could not extract text from PDF. Try a text-based PDF."
- Extraction runs in main process (IPC handler) — keeps renderer lean, follows project pattern

**Upload UI Placement & Review Pane**
- Upload button placement: in `CvPanel` header, next to existing regenerate buttons — "Update CV" label
- PDF review pane: modal with editable textarea pre-filled with extracted markdown — Confirm/Cancel
- `.md` flow: skip review — go straight to confirmation prompt (CV-05); no preview needed
- Confirmation prompt: small modal/dialog — "Replace cv.md? Last modified: {date}" + Replace/Cancel buttons

**IPC Architecture & Write Safety**
- File dialog: `dialog.showOpenDialog` in main process via new `openCvFilePicker` IPC handle (returns file path + content + type)
- Write pattern: reuse Phase 2 `lockAndWrite` + `write-file-atomic` for cv.md — matches all other GUI writes
- Post-write refresh: re-fetch via `readCv()` after write succeeds (pull pattern, consistent with existing CvPanel)
- IPC surface: two new handles — `openCvFilePicker` (native dialog + read + PDF extraction) and `updateCv(content)` (write)

### Claude's Discretion
- Exact Tailwind classes for the "Update CV" button and modals — follow existing CvPanel button styles
- Modal implementation approach (native Electron dialog vs React portal) — use React portal/overlay, consistent with existing modals in the codebase (AddFirmModal pattern)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CV-01 | User can open a file picker from within the app and select a `.md` or `.pdf` file to replace `cv.md` | `dialog.showOpenDialog` with filters `[{ name: 'CV', extensions: ['md', 'pdf'] }]` invoked from main via new `openCvFilePicker` IPC handle. See Code Examples §1. |
| CV-02 | When a `.md` file is selected, its content replaces `cv.md` directly with no conversion | Read picked path with `fs.readFile(path, 'utf-8')` in main; renderer receives `{ type: 'md', content }`. After confirmation, calls `updateCv(content)` which writes via `lockAndWrite`. |
| CV-03 | When a `.pdf` file is selected, its text content is extracted and written to `cv.md` as plain Markdown | `fs.readFile(path)` (no encoding → Buffer) → `pdf(buffer).then(r => r.text)` → returned to renderer in `{ type: 'pdf', content }`. Plain Markdown = the raw extracted text; no structural inference (per CONTEXT). |
| CV-04 | After PDF extraction, user sees the converted Markdown in a review pane and can edit it before saving | `CvUploadModal.tsx` (new) — `<textarea>` pre-filled with extracted text, monospace, min height 320px (per UI-SPEC). Edited content is what `updateCv` writes. |
| CV-05 | User sees a confirmation prompt before overwrite showing the current `cv.md` last-modified date | New `getCvMtime` IPC handle (or piggyback on existing `readCv` by also returning mtime, OR `fs.stat` in renderer-bound payload) returns `Date` formatted as `YYYY-MM-DD HH:mm`. `CvConfirmModal.tsx` displays it; appears for BOTH .md and .pdf paths (per UI-SPEC). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md is the career-ops/JobEngine project layer. The directives below apply to Phase 8:

| Directive | Source | Relevance to Phase 8 |
|-----------|--------|----------------------|
| Never put user data into the system layer; user-customizable files (`cv.md`, `config/profile.yml`, `modes/_profile.md`) belong to the user layer | "Data Contract (CRITICAL)" | Phase 8 writes to `cv.md` — the canonical user-layer CV file. Confirmed Phase 8 target is correct. |
| `cv.md` in project root is the canonical CV — never hardcode metrics; read from this file at evaluation time | "CV Source of Truth" | Onboarding guarantees `cv.md` exists. Phase 8 inherits this guarantee — `lockAndWrite` requires the file to exist (it reads first). See Pitfall §3 below. |
| Never bypass `lockAndWrite`; never `fs.writeFile` directly to project files | "Stack and Conventions" + Phase 2 lineage | The new `updateCv` handler MUST go through `lockAndWrite` like every other GUI writer. Verified pattern in `vc-firms.ts:43`, `vc-companies.ts:45`, `promote.ts:27`. |
| First-run onboarding creates `cv.md` if missing | "First Run — Onboarding" | The Phase 8 happy path assumes `cv.md` exists. If it does not, `lockAndWrite` will throw on its initial `fs.readFile`. Plan must decide: (a) treat as error and surface, or (b) seed empty `cv.md` first. See Pitfall §3. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Native file picker (`dialog.showOpenDialog`) | Main (Electron) | — | Renderer is sandboxed (`webPreferences.sandbox: true`); only main has access to `dialog`. |
| File read (`fs.readFile`) | Main | — | Same sandbox reason; renderer cannot touch FS directly per project pattern. |
| PDF text extraction (`pdf-parse`) | Main | — | CONTEXT-locked; also keeps the heavy library out of the renderer bundle; failure isolation. |
| `updateCv` write (`lockAndWrite` + atomic) | Main | — | All file writes go through `write-queue.ts`; renderer never writes. |
| `cv.md` mtime read for confirmation | Main | — | `fs.stat` is also main-only under sandbox. |
| Modal UI state (`open/closed/loading/error`) | Renderer | — | Pure React state; existing `AddFirmModal` pattern. |
| Review textarea content (editable buffer) | Renderer | — | Local component state; sent to main only at Confirm time. |
| Post-write refresh (re-call `readCv()`) | Renderer | — | Pull pattern, consistent with current CvPanel `load()`. |
| IPC contract surface (`openCvFilePicker`, `updateCv`, `getCvMtime`) | Preload | — | `contextBridge.exposeInMainWorld('api', …)` — must extend `ElectronAPI` in `types.ts`. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdf-parse` | `1.1.4` | PDF text extraction in main process | CONTEXT-locked. v1.1.4 (Oct 2025) removed the historical debug-mode ENOENT bug — `index.js` is now a clean 2-line re-export. Single trivial dep (`node-ensure`). Legacy function API: `pdf(buffer) → Promise<{text, numpages, info, metadata, version}>`. [VERIFIED: `npm view pdf-parse@1.1.4`, [pdf-parse 1.1.4 index.js on unpkg](https://unpkg.com/pdf-parse@1.1.4/index.js)] |
| `electron` `dialog` | (built-in, Electron 41.2.2) | Native file picker via `dialog.showOpenDialog(win, options)` | Built-in; no install. Window-modal when first arg is a `BrowserWindow`. [CITED: [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options)] |
| `proper-lockfile` + `write-file-atomic` | already installed (`^4.1.2` / `^7.0.1`) | Atomic write under cooperative file lock | Used by every other GUI writer in this codebase; do not reinvent. [VERIFIED: `electron/package.json`, `electron/src/main/services/write-queue.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `fs.promises` | built-in | `readFile` (Buffer or utf-8), `stat` for mtime | Always — no extra dep needed. |
| Node.js `path` | built-in | Resolve absolute path to `cv.md` | Always. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdf-parse@1.1.4` | `unpdf@1.6.0` | `unpdf` is ~2MB unpacked (vs ~28MB), pure JavaScript, no native deps, worker auto-inlined, actively maintained April 2026, used by the `unjs`/Nuxt ecosystem. `extractText(await getDocumentProxy(uint8))` is one line. **Better fit for the "lightweight, zero infrastructure" intent stated in CONTEXT** — but switching contradicts the locked decision. See Open Question 1. [VERIFIED: `npm view unpdf`, [unpdf README](https://github.com/unjs/unpdf)] |
| `pdf-parse@1.1.4` | `pdf-parse@2.4.5` | Same package name, completely different library. Class-based API (`new PDFParse({data}).getText()`), depends on `@napi-rs/canvas` (platform-specific native binaries — affects AppImage builds), requires explicit worker import. **Don't pick v2 thinking you got v1.** [VERIFIED: `npm view pdf-parse@2.4.5 dependencies`] |
| `pdf-parse@1.1.4` | `pdfjs-dist` directly | Power-user choice, but pdf-parse is a thin wrapper around exactly this; no value in dropping the wrapper for a single-call use case. |
| `pdf-parse@1.1.4` | `pdfreader` / `pdf2json` | Both produce structured tabular output (we want plain text); both are larger and add no value here. |

**Installation:**
```bash
cd electron && npm install pdf-parse@1.1.4
```

(Pin exact version. Do NOT use `^1.1.4` — the package is on a maintenance line and `^` would jump to 2.x major if anyone retags.)

**Version verification:**
```bash
npm view pdf-parse@1.1.4 version time.modified main dependencies
# → 1.1.4 / 2025-10-29T23:17:38.413Z / index.js / { "node-ensure": "^0.0.0" }
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Renderer ──────────────────────────┐
│  CvPanel.tsx                                                   │
│   ├─ [Update CV] button  ─────► onClick handler                │
│   │                              │                             │
│   │                              ▼                             │
│   │                       window.api.openCvFilePicker()        │
│   │                              │                             │
│   │              ┌───────────────┴────────────────┐            │
│   │              │ result.cancelled? STOP silently│            │
│   │              └───────────────┬────────────────┘            │
│   │                              │ no                          │
│   │                              ▼                             │
│   │       ┌──────── result.type ────────┐                      │
│   │       │                             │                      │
│   │       ▼ 'md'                        ▼ 'pdf'                │
│   │  CvConfirmModal              CvUploadModal                 │
│   │  (uses content as-is)        (textarea pre-filled)         │
│   │       │                             │                      │
│   │       │                             ▼                      │
│   │       │                      [Continue] click              │
│   │       │                             │                      │
│   │       └─────────────►  CvConfirmModal  ◄────────────┘      │
│   │                              │                             │
│   │                              ▼ [Replace] click             │
│   │                       window.api.updateCv(finalContent)    │
│   │                              │                             │
│   │                              ▼ resolves                    │
│   │                       load() — re-call readCv()            │
│   └────────────────────────────────────────────────────────────┘
                                   ▲ IPC
┌──────────────────────────── Main ─────────────────────────────┐
│  ipc-handlers.ts                                               │
│                                                                │
│  ipcMain.handle('openCvFilePicker', async (e) => {             │
│    1. dialog.showOpenDialog(win, { filters: [.md, .pdf] })     │
│    2. if cancelled → { cancelled: true }                       │
│    3. validate path & size (≤ 10 MB)                           │
│    4. branch on extension:                                     │
│       .md  → fs.readFile(path, 'utf-8')                        │
│       .pdf → fs.readFile(path) → pdf(buffer) → result.text     │
│    5. return { type, content, cancelled: false }               │
│  })                                                            │
│                                                                │
│  ipcMain.handle('getCvMtime', async () =>                      │
│    fs.stat(cvPath).mtime  // formatted in renderer)            │
│                                                                │
│  ipcMain.handle('updateCv', async (_e, content) => {           │
│    UpdateCvSchema.parse(content)  // zod size cap              │
│    await lockAndWrite(cvPath, () => content, pendingGuiWrites) │
│  })                                                            │
└────────────────────────────────────────────────────────────────┘
                                   │ writes
                                   ▼
                              ./cv.md (atomic)
```

### Recommended Project Structure

No new directories. Files touched/added:

```
electron/
├── package.json                                # add pdf-parse@1.1.4
├── src/
│   ├── main/
│   │   ├── ipc-handlers.ts                    # add 3 handles + zod schema + dialog import
│   │   └── services/
│   │       └── pdf-extract.ts                 # NEW — wraps pdf-parse with size cap + error normalization
│   ├── preload/
│   │   ├── index.ts                            # expose openCvFilePicker, updateCv, getCvMtime
│   │   └── types.ts                            # extend ElectronAPI; add CvPickerResult type
│   └── renderer/
│       ├── components/
│       │   ├── CvPanel.tsx                     # add Update CV button, modal state
│       │   ├── CvUploadModal.tsx               # NEW — PDF review/edit
│       │   └── CvConfirmModal.tsx              # NEW — confirmation w/ mtime
│       └── styles/
│           └── globals.css                     # append .cv-upload-modal* + .cv-confirm-modal* classes
```

### Pattern 1: IPC handler with zod-validated payload

**What:** All write IPC handlers parse their payload with zod before doing anything (project standard).
**When to use:** Every handler that accepts data from the renderer.
**Example:**
```typescript
// Source: electron/src/main/ipc-handlers.ts (existing pattern, lines 23-43, 207-245)
const UpdateCvSchema = z.string().min(1).max(2_000_000)  // 2 MB markdown cap

ipcMain.handle('updateCv', async (_e, raw: unknown) => {
  try {
    const content = UpdateCvSchema.parse(raw)
    await lockAndWrite(
      path.join(projectRoot, 'cv.md'),
      () => content,                  // ignore current — full replace
      pendingGuiWrites,
    )
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to write cv.md' }
  }
})
```

### Pattern 2: `dialog.showOpenDialog` window-modal

**What:** Pass the `BrowserWindow` as first argument to make the dialog a true window-modal sheet on macOS / parented on Linux/Windows.
**When to use:** Always when there's an active window.
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/api/dialog
import { dialog } from 'electron'   // NEW import — NOT currently in ipc-handlers.ts

const result = await dialog.showOpenDialog(win, {
  title: 'Select CV file',
  properties: ['openFile'],
  filters: [
    { name: 'CV', extensions: ['md', 'pdf'] },
    { name: 'Markdown', extensions: ['md'] },
    { name: 'PDF', extensions: ['pdf'] },
  ],
})

if (result.canceled || result.filePaths.length === 0) {
  return { cancelled: true } as const
}
const filePath = result.filePaths[0]
```

### Pattern 3: pdf-parse legacy v1 API

**What:** Read file as Buffer (no encoding), pass to `pdf()`.
**When to use:** PDF branch of `openCvFilePicker`.
**Example:**
```typescript
// Source: pdf-parse README (legacy v1 API), used here per pinned version 1.1.4
import pdf from 'pdf-parse'
import { promises as fs } from 'fs'

const buffer = await fs.readFile(filePath)   // ← NO 'utf-8' — Buffer required
const result = await pdf(buffer)              // returns { text, numpages, numrender, info, metadata, version }
return result.text
```

### Pattern 4: React modal overlay (AddFirmModal lineage)

**What:** Fixed-position backdrop, click-outside-to-close, Escape-to-close, focus first input on mount.
**When to use:** All Phase 8 modals; mirrors UI-SPEC requirements.
**Example:**
```tsx
// Source: electron/src/renderer/components/AddFirmModal.tsx:56-149
useEffect(() => {
  firstFieldRef.current?.focus()
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [onClose])

<div
  className="fixed inset-0 bg-ctp-crust/60 flex items-center justify-center z-50"
  role="dialog"
  aria-modal="true"
  aria-label="Review extracted CV"
  onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
>
  <form className="bg-ctp-surface border border-ctp-overlay rounded p-4" style={{ width: 600 }}>
    {/* … */}
  </form>
</div>
```

### Anti-Patterns to Avoid

- **Reading the picked file in the renderer.** The renderer is sandboxed (`webPreferences.sandbox: true`) — `fs` is unavailable. Even if it weren't, the project pattern is "all FS in main." `openCvFilePicker` returns the file *contents*, not just the path.
- **Calling `fs.writeFile` directly on cv.md.** Bypasses lockfile + atomic write. Every other writer in the codebase goes through `lockAndWrite`. Watch out for "I'll just write a small one" — there is exactly one write path, use it.
- **Using `pdf-parse` v2 by accident.** `npm install pdf-parse` without a version range gets you 2.4.5, which has a totally different API and pulls `@napi-rs/canvas` (native binary). Pin `1.1.4`.
- **Treating user cancellation as an error.** `dialog.showOpenDialog` returns `canceled: true` — that's a no-op, not an error toast. UI-SPEC implies this; honor it.
- **Trusting filename extension only.** `.pdf` masquerading as `.md` (or vice versa) is rare but possible. Branch on file extension AS a signal, but the PDF parser will fail loudly if the bytes aren't a PDF — that produces our standard "Could not extract" error path. Adequate for v1.
- **Adding cv.md to the chokidar watch list.** It's currently NOT watched. Don't add it just because we now write it; the renderer pulls (re-calls `readCv`) after a successful write.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Open a file picker | A custom React file input or HTML `<input type="file">` | `dialog.showOpenDialog` from main | The renderer is sandboxed; HTML `<input type="file">` only exposes a `File` blob without a real path, and contents have to cross IPC anyway. Native dialog gives the user the OS-native picker, file filters, and a real path for `fs.stat`. |
| Extract text from PDF | A pdfjs-dist hand-wired loop (`pdf.getDocument` → `getPage` → `getTextContent` → join items) | `pdf-parse` (locked) or `unpdf` (alternative) | The hand-wired loop is ~30 lines that has to handle item ordering, line breaks, fonts that map glyphs to non-Unicode, and worker thread setup. Both libraries do this in one call. |
| Atomic file write | `fs.writeFile` + custom retry | `lockAndWrite` + `write-file-atomic` (already installed) | Race conditions with the file watcher, partial-write corruption on power loss, and dropped GUI write suppression. The project pattern handles all of this. |
| Format mtime as `YYYY-MM-DD HH:mm` | Custom string slicing | One-liner `d.toISOString().slice(0,16).replace('T',' ')` OR `Intl.DateTimeFormat` | Trivial; just don't import `dayjs`/`date-fns` for a single format. |
| File size cap on input | Roll your own bytes counter | `fs.stat(path).size` before reading | One syscall; reject before allocating a multi-MB buffer. |

**Key insight:** Phase 8 is mostly *plumbing existing patterns together*. The only genuinely new infrastructure is the PDF extraction, and that infrastructure is one library call. Resist the temptation to add anything else.

## Common Pitfalls

### Pitfall 1: Confusing `pdf-parse` v1 with v2

**What goes wrong:** A maintainer types `npm install pdf-parse`, gets v2.4.5, hits a `Cannot find module '@napi-rs/canvas'` error in dev, then a worker-not-found error after fixing canvas, then the AppImage build inflates by ~80MB and breaks on Linux ARM.
**Why it happens:** The package was transferred to a new maintainer (Oct 2025) who shipped both a maintenance v1.1.x line and a complete rewrite as v2.x — same npm name. v2 is class-based (`new PDFParse(...)`), depends on `@napi-rs/canvas`, requires worker import. v1 is the legacy function-based `pdf(buffer)` API, no canvas, no worker.
**How to avoid:**
- Pin exact version: `"pdf-parse": "1.1.4"` in `electron/package.json` (no `^`, no `~`).
- TypeScript: import as `import pdf from 'pdf-parse'` (default) — if `pdf` is undefined / `pdf.default` exists, you got v2 by mistake.
- Add a smoke check in tests or a startup assertion that `typeof pdf === 'function'`.
**Warning signs:** Compile error mentioning `PDFParse`. Runtime error about `@napi-rs/canvas`. Sudden +50MB to `node_modules`.

### Pitfall 2: Historical `pdf-parse` ENOENT bug — and why it no longer applies in 1.1.4

**What goes wrong (historical):** `pdf-parse` v1.1.1 (2018) had a debug-mode block in `index.js` that, when `module.parent` was undefined (common with bundled or serverless code), tried to read `./test/data/05-versions-space.pdf` from the package's own dir — which doesn't exist after `npm publish` strips `test/`. Crashed at module load.
**Why it happened:** Author left the debug branch in production code; bundlers like webpack/rollup that strip module.parent triggered it.
**How to avoid:** Use `1.1.4` (Oct 2025), which removes the debug block — `index.js` is now `const Pdf = require('./lib/pdf-parse.js'); module.exports = Pdf;`. [VERIFIED: [pdf-parse@1.1.4/index.js on unpkg](https://unpkg.com/pdf-parse@1.1.4/index.js)]
**Warning signs:** If you see ENOENT on `./test/data/05-versions-space.pdf` at app startup, you accidentally pinned 1.1.1, not 1.1.4.
**Bundler note:** This project uses `electron-vite` with `externalizeDepsPlugin()` for the main build (`electron/electron.vite.config.ts:7,18`), so node_modules are NOT bundled — `__dirname` resolves to the real package path at runtime. Even the historic bug would have been less likely to trigger here, but pinning 1.1.4 avoids the question entirely.

### Pitfall 3: `lockAndWrite` reads first — what if `cv.md` doesn't exist?

**What goes wrong:** `lockAndWrite(filePath, transform)` calls `fs.readFile(filePath, 'utf-8')` before invoking the transform (see `write-queue.ts:21-22`). If `cv.md` is absent, this throws `ENOENT`. The user sees "Failed to save CV" without context.
**Why it happens:** CLAUDE.md onboarding *creates* `cv.md` on first run, but the GUI flow doesn't enforce that invariant. A power user who deletes `cv.md` then opens the app and clicks Update CV would hit this.
**How to avoid (planner choice — flag as decision point):**
- (a) Gate `lockAndWrite` with an `existsSync(cvPath)` check; if missing, seed an empty `cv.md` first (mirrors `vc-firms.ts:38-42` pattern), then call `lockAndWrite`.
- (b) Refactor `lockAndWrite` to accept an optional default-when-missing string. Wider blast radius — only do this if multiple callers want it.
- (c) Document the precondition; let it surface as an inline error and tell the user to run onboarding. Cheapest, but worse UX.
**Recommendation:** Option (a). One existsSync + one writeFile (initial seed) gates a clear failure mode. Mirrors a known project pattern.
**Warning signs:** "Failed to save CV. ENOENT" in the UI. Tester deletes cv.md before running the upload flow.

### Pitfall 4: `fs.readFile` encoding mismatch (Buffer vs utf-8)

**What goes wrong:** Existing `readCv` handler does `fs.readFile(path, 'utf-8')` — returns a string. Copy-pasting that into the PDF branch returns a corrupted string the parser will reject ("Invalid PDF structure"). Or copy-pasting the PDF branch into the .md branch produces a Buffer the renderer can't render.
**Why it happens:** Different file types want different read modes; engineers cargo-cult one pattern.
**How to avoid:** Be explicit per branch:
```typescript
if (ext === '.md') {
  const text = await fs.readFile(filePath, 'utf-8')   // string
  return { type: 'md', content: text, cancelled: false }
}
if (ext === '.pdf') {
  const buffer = await fs.readFile(filePath)          // Buffer (no encoding)
  const text = await extractPdfText(buffer)
  return { type: 'pdf', content: text, cancelled: false }
}
```
**Warning signs:** Parser throws on every PDF; or markdown renders as `[object Object]`.

### Pitfall 5: Unbounded PDF/MD input — DoS / memory blowup

**What goes wrong:** User picks a 500MB PDF (book scan). Main process allocates a huge Buffer, pdfjs OOMs, app freezes/crashes.
**Why it happens:** No size check.
**How to avoid:**
```typescript
const stat = await fs.stat(filePath)
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB
if (stat.size > MAX_BYTES) {
  return { cancelled: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 10 MB)` }
}
```
And on the write side, zod-cap the markdown payload (`z.string().max(2_000_000)` ≈ 2MB of text).
**Warning signs:** App becomes unresponsive after picking a large file. RAM usage spikes.

### Pitfall 6: `dialog` not imported in ipc-handlers.ts

**What goes wrong:** CONTEXT.md states "`dialog` from Electron — already imported in main process." It is **not** imported anywhere in `electron/src/` (verified: `grep -rn "dialog\|showOpenDialog" electron/src/**/*.ts` returns zero matches). The plan must add the import.
**Why it happens:** Drift between context-gathering memory and codebase reality.
**How to avoid:** Add `dialog` to the existing import: `import { ipcMain, dialog, type BrowserWindow } from 'electron'` in `ipc-handlers.ts:1`.
**Warning signs:** TypeScript error `Cannot find name 'dialog'` when implementing `openCvFilePicker`.

### Pitfall 7: PDF → text quality is lossy by design

**What goes wrong:** User uploads a beautifully-formatted CV PDF; gets back a wall of run-on text with weird hyphenation, no headers, lost bullets. Feels broken.
**Why it happens:** PDF stores glyphs and positions, not semantic structure. `pdf-parse`/pdfjs reconstructs reading order line-by-line; sectioning, lists, and headings are ALL gone.
**How to avoid (UX, not code):** UI-SPEC already addresses this — review modal is *editable*, error copy is "Try a text-based PDF" (not "PDF extraction is broken"). Set realistic expectations in the modal title and helper copy. No code-side fix; out of scope per CONTEXT ("no AI reformatting").
**Warning signs:** User feedback "the PDF feature is broken" — actually it's working as specified; the contract is "raw text extracted, you edit it before saving."

### Pitfall 8: `cv.md` mtime is read AFTER the file is written

**What goes wrong:** Confirmation modal shows "Last modified: {date}". If the renderer reads mtime *after* the user clicks Update CV (i.e., during the write flow), the displayed mtime is from a prior session — confusing but not wrong. Actual hazard: if mtime is fetched at button click time but the user takes 5 minutes editing in the textarea, and another process updates `cv.md` in between, the displayed mtime is stale by the time the confirm modal opens. Low probability but possible.
**Why it happens:** Time-of-check / time-of-use.
**How to avoid:** Fetch mtime at the moment the *confirmation modal* opens (i.e., right before showing it), not at button click. Refresh on every confirmation cycle. Acceptable freshness window: < 100ms.
**Warning signs:** User reports the displayed mtime didn't match `ls -la cv.md`.

## Code Examples

Verified patterns from the existing codebase and official sources.

### 1. The `openCvFilePicker` handler (sketch)

```typescript
// electron/src/main/ipc-handlers.ts (NEW)
// Source pattern: existing handlers in this file (e.g., addVcFirm), pdf-parse v1 README
import { ipcMain, dialog, type BrowserWindow } from 'electron'  // ADD `dialog`
import pdf from 'pdf-parse'                                     // NEW
import { promises as fs } from 'fs'
import * as path from 'path'

const MAX_FILE_BYTES = 10 * 1024 * 1024   // 10 MB

interface CvPickerResult {
  cancelled: boolean
  type?: 'md' | 'pdf'
  content?: string
  error?: string
}

ipcMain.handle('openCvFilePicker', async (): Promise<CvPickerResult> => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select CV file',
    properties: ['openFile'],
    filters: [{ name: 'CV', extensions: ['md', 'pdf'] }],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true }
  }
  const filePath = result.filePaths[0]
  const ext = path.extname(filePath).toLowerCase()

  try {
    const stat = await fs.stat(filePath)
    if (stat.size > MAX_FILE_BYTES) {
      return { cancelled: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 10 MB)` }
    }

    if (ext === '.md') {
      const content = await fs.readFile(filePath, 'utf-8')
      return { cancelled: false, type: 'md', content }
    }
    if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath)
      const parsed = await pdf(buffer)
      return { cancelled: false, type: 'pdf', content: parsed.text }
    }
    return { cancelled: false, error: 'Unsupported file type. Choose a .md or .pdf file.' }
  } catch (err: any) {
    // Distinguish read failure from PDF-parse failure for better UX copy
    return { cancelled: false, error: err?.message ?? 'Could not read file. Check it exists and try again.' }
  }
})
```

### 2. The `updateCv` handler

```typescript
// Source pattern: existing zod-validated handlers; lockAndWrite from write-queue.ts
const UpdateCvSchema = z.string().min(1).max(2_000_000)   // 2 MB markdown cap

ipcMain.handle('updateCv', async (_e, raw: unknown): Promise<{ success: boolean; error?: string }> => {
  try {
    const content = UpdateCvSchema.parse(raw)
    const cvPath = path.join(projectRoot, 'cv.md')

    // Pitfall §3: seed empty cv.md if missing
    if (!existsSync(cvPath)) {
      await fs.writeFile(cvPath, '', 'utf-8')
    }

    await lockAndWrite(cvPath, () => content, pendingGuiWrites)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to write cv.md' }
  }
})
```

### 3. The `getCvMtime` handler (for the confirmation modal)

```typescript
ipcMain.handle('getCvMtime', async (): Promise<{ mtimeIso: string | null }> => {
  const cvPath = path.join(projectRoot, 'cv.md')
  try {
    const stat = await fs.stat(cvPath)
    return { mtimeIso: stat.mtime.toISOString() }
  } catch {
    return { mtimeIso: null }
  }
})
```

Renderer-side formatting:
```typescript
function formatMtime(iso: string | null): string {
  if (!iso) return 'never (file does not exist)'
  return iso.slice(0, 16).replace('T', ' ')   // "2026-04-10 21:18"
}
```

### 4. Preload extension

```typescript
// electron/src/preload/types.ts — extend ElectronAPI
interface CvPickerResult {
  cancelled: boolean
  type?: 'md' | 'pdf'
  content?: string
  error?: string
}
interface CvUpdateResult {
  success: boolean
  error?: string
}

// inside ElectronAPI:
openCvFilePicker: () => Promise<CvPickerResult>
updateCv: (content: string) => Promise<CvUpdateResult>
getCvMtime: () => Promise<{ mtimeIso: string | null }>
```

```typescript
// electron/src/preload/index.ts — expose
openCvFilePicker: () => ipcRenderer.invoke('openCvFilePicker'),
updateCv: (content: string) => ipcRenderer.invoke('updateCv', content),
getCvMtime: () => ipcRenderer.invoke('getCvMtime'),
```

### 5. CvPanel header — adding the Update CV button

```tsx
// CvPanel.tsx (excerpt)
// Style follows UI-SPEC §"Update CV button" (secondary; bg-ctp-overlay, NOT bg-ctp-mauve)
<header className="cv-panel__header">
  <h2 className="cv-panel__title">CV</h2>
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => setUploadOpen(true)}
      disabled={uploadBusy}
      className="bg-ctp-overlay text-ctp-text border border-ctp-overlay rounded px-3 py-1 text-label hover:bg-ctp-overlay/70 disabled:opacity-50"
      data-testid="cv-update-btn"
    >
      {uploadBusy ? 'Opening…' : 'Update CV'}
    </button>
    <button type="button" className="cv-panel__regenerate" onClick={handleRegenerate} disabled={toast?.variant === 'pending'}>
      {toast?.variant === 'pending' ? 'Regenerating…' : 'Regenerate PDF'}
    </button>
    <button type="button" className="cv-panel__regenerate" onClick={onGenerateLatex} disabled={latexActive}>
      {latexActive ? 'Exporting…' : 'Export LaTeX'}
    </button>
  </div>
</header>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse@1.1.1` with the `./test/data/05-versions-space.pdf` ENOENT bug | `pdf-parse@1.1.4` (Oct 2025), debug block removed; or `unpdf` for a smaller modern alternative | 2025-10 | The classic "pdf-parse just crashes in serverless/bundled apps" trope is fixable by upgrading to 1.1.4. The fork chains (`pdf-parse-debugging-disabled`, `pdf-parse-fork`, `pdf-parse-new`) are legacy; not needed. |
| Hand-wired `pdfjs-dist` extraction | `unpdf`'s `extractText(getDocumentProxy(uint8))` | 2024-2025 | One-line API, worker auto-inlined, no canvas dep. Modern projects prefer it over pdf-parse. |
| `pdf-parse` v1 function API: `pdf(buffer).then(r => r.text)` | `pdf-parse` v2 class API: `new PDFParse({data}).getText()` (different package, same name) | 2025-10 | If you blindly install latest, your code breaks. Pin exact version. |

**Deprecated/outdated:**
- The `pdf-parse-debugging-disabled` workaround package — superseded by 1.1.4 fixing the bug at source.
- The community advice "copy `test/data/05-versions-space.pdf` into your project root" — also obsolete with 1.1.4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The locked decision "use `pdf-parse`" was made on the premise the package is "lightweight (~100KB), pure Node.js, zero extra infrastructure." Both available pdf-parse versions contradict that premise (v1.1.x ≈ 28 MB unpacked bundling pdfjs builds; v2.x adds `@napi-rs/canvas` native binary). [ASSUMED that the user accepts the actual reality of pdf-parse 1.1.4: ~28 MB lib but no native deps and no infrastructure beyond an npm install.] | User Constraints / Standard Stack / Open Q1 | If user's hard constraint is actually "no native deps, single file, sub-MB", `pdf-parse` won't satisfy it but `unpdf` will. The two libraries are interchangeable from the IPC contract's perspective; the swap is a 5-line change. Worth confirming before execution. |
| A2 | `cv.md` is guaranteed to exist by the onboarding contract in CLAUDE.md, so a missing-file handling path is a low-priority defensive measure rather than an active concern. | Pitfall §3 | If user deletes `cv.md` then runs the upload flow, they'd get a generic "Failed to save" without context. Recommended fix (option a, seed empty) is cheap; planner should adopt it but it's not blocking. |
| A3 | A 10 MB file size cap is reasonable for CVs. | Pitfall §5 | If a user has a multi-page CV with embedded scanned images, they could hit the cap legitimately. 10 MB is generous for text-based PDFs (most CVs are <500 KB). If wrong, raise to 25 MB. Trivial to change. |
| A4 | A 2 MB markdown cap on `updateCv` write is reasonable. | Code Examples §2 | Even War-and-Peace-length CV markdown would fit in 2 MB. If wrong (someone embeds huge base64 images in markdown), raise the cap; it's a one-line zod change. |

## Open Questions

1. **Does the user accept `pdf-parse@1.1.4` knowing it's ~28 MB, not "lightweight ~100KB"?**
   - What we know: CONTEXT.md locked `pdf-parse` based on a description that doesn't match reality. v1.1.4 is functional, well-tested, and fixes the historical ENOENT bug. v2.x is a different (heavier) library with the same npm name. `unpdf` (~2 MB, no native deps, modern, April-2026 release) is a strict superset of the stated CONTEXT premises.
   - What's unclear: Was "lightweight" load-bearing in the user's decision, or was "pdf-parse" the load-bearing token?
   - Recommendation: Surface this in `/gsd-discuss-phase` follow-up before executing. If "lightweight, zero infrastructure" was the actual constraint, switch to `unpdf` (5-line diff, same IPC contract). If `pdf-parse` was the brand-name choice (e.g., from prior experience), pin `1.1.4` and proceed.

2. **What should `updateCv` do if `cv.md` is missing?**
   - What we know: CLAUDE.md onboarding creates `cv.md`; the GUI assumes it exists. `lockAndWrite` reads first, so a missing file throws ENOENT.
   - What's unclear: Should we (a) seed empty file then write, (b) refuse with a helpful message, or (c) ignore the case as out-of-spec?
   - Recommendation: (a) seed empty. Cheap, mirrors `vc-firms.ts:38-42` pattern, fail-soft. Planner can lock this in plan-phase without blocking.

3. **Should the file picker remember the last-used directory?**
   - What we know: `dialog.showOpenDialog` accepts a `defaultPath` option. Without it, picker opens at OS-default (usually home dir).
   - What's unclear: Out of scope for v1? Probably yes — keep simple, defer to v1.x improvement.
   - Recommendation: Skip for v1. Don't store extra state.

4. **Does the AppImage build need any pdf-parse-specific configuration?**
   - What we know: `electron.vite.config.ts` uses `externalizeDepsPlugin()` for main, so `pdf-parse` is resolved from `node_modules` at runtime, not bundled. `electron-builder` config has `files: ["out/**/*"]` — by default this means the entire `node_modules` is included in the AppImage's `app.asar`. v1.1.4 has no native binaries, no worker files outside lib/, so it should "just work."
   - What's unclear: Whether `app.asar` packaging strips files in a way that breaks pdfjs's internal version-based loading (`./pdf.js/${options.version}/build/pdf.js` per the lib internals). Risk is LOW because Electron resolves `app.asar` paths transparently for `require`.
   - Recommendation: Add a smoke test in the verification phase: run the packaged AppImage, upload a small PDF, confirm extraction works. If it fails, the fix is `asarUnpack: ["**/node_modules/pdf-parse/**"]` in electron-builder config — a one-line addition.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (≥ 6.8.1 for pdf-parse 1.1.4; Electron 41 ships Node 22) | Runtime | ✓ | v22.22.2 | — |
| Electron `dialog` API | `openCvFilePicker` | ✓ | Built into Electron 41.2.2 | — |
| `pdf-parse` | PDF extraction | ✗ (not installed) | — | None — must be added in plan execution. `unpdf` is a strictly cleaner alternative if user revisits A1. |
| `proper-lockfile` | `lockAndWrite` reuse | ✓ | ^4.1.2 | — |
| `write-file-atomic` | `lockAndWrite` reuse | ✓ | ^7.0.1 | — |
| `zod` | Payload validation | ✓ | ^3.25.76 | — |
| `react`/`react-dom` | Modal components | ✓ | 18.3.1 | — |
| Test framework | Verification | n/a | nyquist_validation: false (config) | Phase verification is human-driven per project preference |

**Missing dependencies with no fallback:**
- `pdf-parse@1.1.4` — must be installed in plan execution (`npm install pdf-parse@1.1.4 --save-exact` from `electron/`).

**Missing dependencies with fallback:**
- None.

## Security Domain

`security_enforcement` is not specified in `.planning/config.json` — defaulting to enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | yes (locally) | Renderer is sandboxed; `fs` access only via main IPC handlers. Already enforced project-wide via `webPreferences.sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` (see `electron/src/main/index.ts:43-49`). No new boundary in this phase. |
| V5 Input Validation | yes | All IPC payloads validated with zod (project standard). Add `UpdateCvSchema = z.string().min(1).max(2_000_000)` for `updateCv`. File extension whitelisted (`.md`, `.pdf`). File size capped at 10 MB before read. |
| V6 Cryptography | no | No new crypto; no signing of cv.md. |

### Known Threat Patterns for Electron + main-process file I/O

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `filePath` from renderer | Tampering | Renderer never sends a path — `dialog.showOpenDialog` returns the path inside main, the user picked it via OS dialog, it never traverses IPC. ✓ |
| Renderer-controlled write target | Tampering / EoP | `updateCv` writes to a hard-coded `path.join(projectRoot, 'cv.md')` — renderer cannot redirect. ✓ |
| Unbounded read (memory DoS) | Denial of Service | 10 MB pre-read size cap (Pitfall §5). |
| Malicious PDF (CVE in pdfjs) | Tampering / DoS | Out-of-process is the standard mitigation; `pdf-parse` runs in main process (renderer is isolated). pdfjs has had CVEs historically (e.g., CVE-2024-4367). [VERIFIED: pdf-parse@1.1.4 bundles its own pdfjs versions; if CVE arises, upgrade strategy = bump pdf-parse, not the project.] Track via Dependabot if enabled. |
| TOCTOU on cv.md (file replaced between stat and read) | Tampering | Negligible — single-user desktop app; the flow is fast enough that the window doesn't matter. |
| File-extension spoofing (a `.pdf` that's actually shell script) | Tampering | We don't *execute* uploaded files — we extract text. pdf-parse will fail on non-PDF bytes; we surface a generic "Could not extract text" error. ✓ |
| `dialog` showing a phishing dialog (UI redress) | Spoofing | Native OS dialog cannot be redressed by web content. ✓ |

## Sources

### Primary (HIGH confidence)
- [Electron `dialog` API](https://www.electronjs.org/docs/latest/api/dialog) — `showOpenDialog` signature, filter format, return shape.
- [pdf-parse@1.1.4 index.js (unpkg)](https://unpkg.com/pdf-parse@1.1.4/index.js) — verified the debug block was removed (file is now 2 lines).
- [pdf-parse@1.1.4 package.json (unpkg)](https://unpkg.com/pdf-parse@1.1.4/package.json) — verified deps (`node-ensure` only), main entry, files list.
- `electron/src/main/services/write-queue.ts` (codebase) — the canonical `lockAndWrite` signature.
- `electron/src/main/ipc-handlers.ts` (codebase) — handler registration, zod validation pattern.
- `electron/src/renderer/components/AddFirmModal.tsx` (codebase) — modal pattern.
- `electron/src/renderer/components/CvPanel.tsx` (codebase) — existing panel structure.
- `electron/electron.vite.config.ts` (codebase) — confirmed `externalizeDepsPlugin()` for main; node_modules resolved at runtime.
- `electron/package.json` (codebase) — verified all currently-installed deps and Electron version (41.2.2 → Node 22).
- `npm view pdf-parse@1.1.4 …` (registry, Bash) — verified version 1.1.4 published 2025-10-29, single dep `node-ensure`, no native binaries.
- `npm view pdf-parse@2.4.5 dependencies` (registry, Bash) — verified v2.x depends on `@napi-rs/canvas` and `pdfjs-dist`.

### Secondary (MEDIUM confidence)
- [unpdf README on GitHub](https://github.com/unjs/unpdf) — alternative library evaluation.
- [npm pdf-parse](https://www.npmjs.com/package/pdf-parse) — package overview and v2 API context.
- [Medium: pdf-parse debug file crash](https://medium.com/@mbmrajatit/%EF%B8%8F-how-a-missing-debug-file-in-pdf-parse-crashed-my-node-js-app-and-how-i-fixed-it-be5ba7077527) — historical bug context.
- [GitLab pdf-parse issue #24 (autokent)](https://gitlab.com/autokent/pdf-parse/-/issues/24) — original ENOENT bug report.
- [Strapi: 7 PDF parsing libraries Node.js 2025](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025) — cross-library comparison context.
- [langchainjs-community issue #22](https://github.com/langchain-ai/langchainjs-community/issues/22) — confirms v1↔v2 API incompatibility surfaces in real projects.

### Tertiary (LOW confidence)
- [Generalist Programmer pdf-parse guide](https://generalistprogrammer.com/tutorials/pdf-parse-npm-package-guide) — promotional content; usage examples cross-checked against npm and GitHub.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for the dialog/lockAndWrite/zod components (existing project patterns + official Electron docs). MEDIUM for pdf-parse — version 1.1.4 is verified-clean but the locked decision rests on a flawed premise (see A1).
- Architecture: HIGH — IPC contract is small and follows a well-established project pattern.
- Pitfalls: HIGH — pitfalls 1, 2, 4, 5, 6 are verified against either codebase (#6) or primary sources (#1, #2). Pitfall 3 (missing cv.md) is a hypothesis based on reading `lockAndWrite`'s implementation.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — pdf-parse stable; Electron stable; project conventions stable).
