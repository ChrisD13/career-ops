---
phase: 08-cv-upload-pdf-extraction
reviewed: 2026-04-27T20:30:33Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - electron/src/main/services/pdf-extract.ts
  - electron/src/main/ipc-handlers.ts
  - electron/src/preload/types.ts
  - electron/src/preload/index.ts
  - electron/src/renderer/components/CvPanel.tsx
  - electron/src/renderer/components/CvUploadModal.tsx
  - electron/src/renderer/components/CvConfirmModal.tsx
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-04-27T20:30:33Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 8 implements the CV upload flow: an Electron file picker for `.md`/`.pdf` files, `unpdf`-based PDF extraction in the main process, a review/edit modal for PDFs, a confirmation modal with mtime display, and an atomic write via the existing `lockAndWrite` path. The implementation closely follows the documented PATTERNS.md and RESEARCH.md design — all critical architectural constraints (sandbox safety, lockAndWrite reuse, Zod boundary validation, path-traversal prevention) are correctly applied.

One warning-level issue was found: a file-size gap between the picker cap (10 MB) and the write-schema cap (2 MB) that produces a raw Zod error string when a large `.md` file is selected and the user clicks Replace. Four info-level issues were found covering an inconsistent try/catch scope in `pdf-extract.ts`, a UTC-unlabeled timestamp display, a type declared inside a function body, and keydown listener churn from unstable callback references.

## Warnings

### WR-01: `.md` files between 2 MB and 10 MB pass the picker but fail at write with a raw Zod error

**File:** `electron/src/main/ipc-handlers.ts:47` and `electron/src/main/ipc-handlers.ts:139-145`

**Issue:** `MAX_FILE_BYTES = 10 MB` is checked in the `openCvFilePicker` handler for both `.md` and `.pdf` files (line 139). The write handler validates the payload against `UpdateCvSchema = z.string().min(1).max(2_000_000)` (2 MB, line 47). A user who selects a `.md` CV between 2 MB and 10 MB will pass the picker check, skip the review modal (`.md` goes straight to confirm), click Replace, and receive `result.error` containing Zod's raw message: `"String must contain at most 2000000 character(s)"`. This message is displayed verbatim in `CvConfirmModal`'s error banner (line 59 of `CvConfirmModal.tsx`). The user has no indication that the file was too large before the write attempt.

RESEARCH.md §A3 (10 MB) and §A4 (2 MB) acknowledge these are intentionally distinct caps, but the gap in user-facing error handling was not addressed in the plans.

**Fix:** Add a `.md`-specific size check in `openCvFilePicker` that uses the tighter 2 MB write cap (or a constant for it), so the error surfaces at pick time with a clear message rather than at write time with a raw Zod string:

```typescript
// ipc-handlers.ts — inside the openCvFilePicker handler, .md branch
const MAX_MD_BYTES = 2 * 1024 * 1024 // 2 MB — matches UpdateCvSchema cap
if (ext === '.md') {
  const stat = await fs.stat(filePath)
  if (stat.size > MAX_MD_BYTES) {
    return {
      cancelled: false,
      error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 2 MB for Markdown)`,
    }
  }
  const content = await fs.readFile(filePath, 'utf-8')
  return { cancelled: false, type: 'md' as const, content }
}
```

Alternatively, keep a single `MAX_FILE_BYTES` but apply it consistently: lower the picker cap to 2 MB and add a comment that the write schema cap drives this choice.

## Info

### IN-01: `fs.stat` and `fs.readFile` in `pdf-extract.ts` are outside the try/catch scope

**File:** `electron/src/main/services/pdf-extract.ts:11` and `electron/src/main/services/pdf-extract.ts:19`

**Issue:** The try/catch at line 20 wraps only the `unpdf` calls (`getDocumentProxy`, `extractText`). The `fs.stat` at line 11 and `fs.readFile` at line 19 are outside the block. If either throws (e.g., ENOENT, EPERM), the exception propagates as an unhandled rejection to the caller in `ipc-handlers.ts:156`. The caller's outer `try/catch` does handle it and returns `{ cancelled: false, error: err?.message }`, so there is no crash — but the error path is inconsistent: unpdf failures return `{ ok: false, error: … }` while fs failures throw and are caught by the caller. This makes `extractPdfText`'s contract ambiguous: it sometimes throws (fs errors) and sometimes returns an error result (unpdf errors).

**Fix:** Wrap the entire function body in a single try/catch to give it a uniform contract:

```typescript
export async function extractPdfText(filePath: string): Promise<PdfExtractResult> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.size > MAX_FILE_BYTES) {
      return { ok: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 10 MB)` }
    }
    const buffer = await fs.readFile(filePath)
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return { ok: true, text }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Could not extract text from PDF' }
  }
}
```

### IN-02: `formatMtime` displays a UTC timestamp without a "UTC" label

**File:** `electron/src/renderer/components/CvConfirmModal.tsx:11-14`

**Issue:** `formatMtime` slices the ISO string to `YYYY-MM-DD HH:mm` and replaces `T` with a space. `toISOString()` always returns UTC. The resulting display ("2026-04-10 21:18") looks like local time to most users. On a machine where local time differs from UTC, the displayed time will not match what `ls -la cv.md` shows.

**Fix:** Either append "UTC" to clarify the timezone, or convert to local time before formatting:

```typescript
// Option A — append UTC label (minimal change)
function formatMtime(iso: string | null): string {
  if (!iso) return 'never (file does not exist)'
  return iso.slice(0, 16).replace('T', ' ') + ' UTC'
}

// Option B — convert to local time (better UX)
function formatMtime(iso: string | null): string {
  if (!iso) return 'never (file does not exist)'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
```

### IN-03: `UploadStage` type is declared inside the component function body

**File:** `electron/src/renderer/components/CvPanel.tsx:29-35`

**Issue:** The `UploadStage` discriminated union type is declared at line 29 inside the `CvPanel` function body. TypeScript re-evaluates the type on every render. This has no runtime impact but violates the project pattern (all types in this file — `ToastState`, `Props` — are declared at module scope) and will be invisible to external type consumers.

**Fix:** Move the type declaration to module scope, above the `CvPanel` function:

```typescript
// module scope — before CvPanel
type UploadStage =
  | { kind: 'idle' }
  | { kind: 'opening' }
  | { kind: 'review'; content: string }
  | { kind: 'confirm'; content: string; mtimeIso: string | null; saving: boolean; errorMessage: string | null }
  | { kind: 'error'; message: string }
```

### IN-04: Keydown listener in `CvUploadModal` re-registers on every parent render

**File:** `electron/src/renderer/components/CvUploadModal.tsx:13-18`

**Issue:** The `useEffect` at line 13 depends on `onCancel`, which is passed from `CvPanel.tsx:196` as an inline arrow (`() => setUpload({ kind: 'idle' })`). Inline arrows create a new reference on every parent render, causing the useEffect to fire on each `CvPanel` render while the modal is open — removing and re-adding the `window` keydown listener each time. The same pattern exists in `CvConfirmModal.tsx:17-23`. This is functionally harmless but produces unnecessary listener churn.

**Fix:** Wrap the callbacks in `useCallback` in `CvPanel.tsx` to stabilize the references:

```typescript
// CvPanel.tsx
import { useCallback, useEffect, useState } from 'react'

const handleUploadCancel = useCallback(() => setUpload({ kind: 'idle' }), [])
```

Then pass `handleUploadCancel` as the `onCancel` prop instead of an inline arrow.

---

_Reviewed: 2026-04-27T20:30:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
