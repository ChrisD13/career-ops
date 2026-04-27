# Phase 8: CV Upload & PDF Extraction - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

User keeps `cv.md` fresh from inside the Electron app — pick a `.md` or `.pdf` file, review extracted content (PDF path), confirm, done — without opening a terminal or text editor.

</domain>

<decisions>
## Implementation Decisions

### PDF Extraction Library
- Library: `pdf-parse` — lightweight (~100KB), pure Node.js, zero extra infrastructure
- Output: raw text block (no AI reformatting, no structure inference)
- Extraction failure UX: inline error in panel — "Could not extract text from PDF. Try a text-based PDF."
- Extraction runs in main process (IPC handler) — keeps renderer lean, follows project pattern

### Upload UI Placement & Review Pane
- Upload button placement: in `CvPanel` header, next to existing regenerate buttons — "Update CV" label
- PDF review pane: modal with editable textarea pre-filled with extracted markdown — Confirm/Cancel
- `.md` flow: skip review — go straight to confirmation prompt (CV-05); no preview needed
- Confirmation prompt: small modal/dialog — "Replace cv.md? Last modified: {date}" + Replace/Cancel buttons

### IPC Architecture & Write Safety
- File dialog: `dialog.showOpenDialog` in main process via new `openCvFilePicker` IPC handle (returns file path + content + type)
- Write pattern: reuse Phase 2 `lockAndWrite` + `write-file-atomic` for cv.md — matches all other GUI writes
- Post-write refresh: re-fetch via `readCv()` after write succeeds (pull pattern, consistent with existing CvPanel)
- IPC surface: two new handles — `openCvFilePicker` (native dialog + read + PDF extraction) and `updateCv(content)` (write)

### Claude's Discretion
- Exact Tailwind classes for the "Update CV" button and modals — follow existing CvPanel button styles
- Modal implementation approach (native Electron dialog vs React portal) — use React portal/overlay, consistent with existing modals in the codebase (AddFirmModal pattern)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `electron/src/renderer/components/CvPanel.tsx` — existing panel with `readCv()` IPC call, header with regenerate buttons, error state pattern
- `electron/src/main/ipc-handlers.ts` — `readCv` handle already registered; `lockAndWrite` + write-file-atomic pattern from Phase 2
- `dialog` from Electron — already imported in main process for other operations; `showOpenDialog` available
- `AddFirmModal.tsx` — existing React modal pattern for dialog overlay UI
- `electron/src/preload/types.ts` — `ElectronAPI` interface for new IPC handles

### Established Patterns
- IPC handler registration: `ipcMain.handle('name', async () => ...)` in `ipc-handlers.ts`
- File writes: `lockAndWrite(path, content, pendingGuiWrites)` — never direct `fs.writeFile`
- Error handling: inline error state in panel (not thrown to renderer)
- Modal pattern: `AddFirmModal.tsx` — React portal with backdrop, Tailwind styling, close on backdrop click

### Integration Points
- `electron/src/preload/index.ts` — expose new IPC handles via `window.api`
- `electron/src/preload/types.ts` — add `openCvFilePicker` and `updateCv` to `ElectronAPI`
- `electron/src/renderer/components/CvPanel.tsx` — add "Update CV" button and modal state

</code_context>

<specifics>
## Specific Ideas

- `openCvFilePicker` returns `{ type: 'md' | 'pdf', content: string, cancelled: boolean }` — single call handles dialog + read + PDF extraction; renderer never touches file contents directly
- PDF review modal should use a `<textarea>` (not a markdown renderer) — user needs to edit raw markdown before saving
- The "Update CV" button should be visually secondary to the "Regenerate PDF" button — same row, smaller or ghost style

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
