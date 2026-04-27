---
phase: 08-cv-upload-pdf-extraction
plan: 01
subsystem: electron
tags: [electron, ipc, pdf-extraction, file-dialog, unpdf, cv]
key-files:
  created: [electron/src/main/services/pdf-extract.ts]
  modified: [electron/package.json, electron/src/main/ipc-handlers.ts, electron/src/preload/index.ts, electron/src/preload/types.ts]
key-decisions: ["Retried npm install with --legacy-peer-deps after an existing vite/@vitejs-plugin-react peer conflict blocked the exact unpdf pin", "Applied the documented seed-if-missing guard before lockAndWrite because cv.md can be absent while lockAndWrite always reads first", "Scoped task commits to plan files only because the worktree already contained unrelated local changes"]
requirements-completed: [CV-01, CV-02, CV-03, CV-05]
completed: 2026-04-27T20:11:40Z
---

# Phase 08 Plan 01: CV Upload IPC Surface Summary

Main-process CV upload plumbing now exists end-to-end: the app can pick `.md` or `.pdf` files, extract PDF text via `unpdf`, atomically replace root `cv.md`, and expose the entire contract through typed `window.api.*` bridges.

## Tasks Completed
- PASS — Task 1: Installed exact `unpdf` pin, added `electron/src/main/services/pdf-extract.ts`, and extended preload typings with `CvPickerResult`, `CvUpdateResult`, `CvMtimeResult`, and the three new `ElectronAPI` method signatures.
- PASS — Task 2: Added `openCvFilePicker`, `updateCv`, and `getCvMtime` IPC handlers in main, exposed matching preload invokes, and returned the project to a clean `npx tsc --noEmit`.

## Verification Results
- `cd electron && npx tsc --noEmit` → exit 0
- `cd electron && jq -r '.dependencies.unpdf' package.json` → `1.6.0`
- `grep -n "from 'unpdf'" electron/src/main/services/pdf-extract.ts` → `2:import { extractText, getDocumentProxy } from 'unpdf'`
- `rg -n "from 'pdf-parse'|require\\('pdf-parse'\\)" electron/src` → no matches
- IPC channel presence:
  - `openCvFilePicker` → `ipc-handlers.ts:125`, `preload/index.ts:45`, `preload/types.ts:208`
  - `updateCv` → `ipc-handlers.ts:161`, `preload/index.ts:46`, `preload/types.ts:209`
  - `getCvMtime` → `ipc-handlers.ts:176`, `preload/index.ts:47`, `preload/types.ts:210`
- Atomic write path:
  - `electron/src/main/ipc-handlers.ts:169` → `await lockAndWrite(cvPath, () => content, pendingGuiWrites)`
  - `electron/src/main/ipc-handlers.ts:167` → `await fs.writeFile(cvPath, '', 'utf-8')`

## Decisions Made
- Recorded the summary `subsystem` as `electron` because the plan frontmatter did not provide a `subsystem` key and every touched file lives in the Electron main/preload surface.
- Kept the `.md` branch on the same `MAX_FILE_BYTES` 10 MB guard as the PDF branch so the picker enforces the plan’s "Files larger than 10 MB" truth consistently for both accepted file types.
- Preserved the existing error-as-result IPC pattern everywhere; no new handler throws across the context bridge.

## Issues Encountered
- The literal `npm install unpdf@1.6.0 --save-exact` failed on an existing `vite@8` vs `@vitejs/plugin-react` peer-resolution conflict; rerunning with `--legacy-peer-deps` added the exact pin without changing any unrelated dependency versions.
- The worktree already had unrelated local changes, so task commits were intentionally scoped to the plan files instead of using a literal `git add -A`.
- The plan-level `grep -c "from 'pdf-parse'" electron/src/` check targets a directory without recursion; an equivalent repository-wide `rg` no-match check was used for verification.

## Self-Check
`PASSED` — reran all 31 acceptance-criteria checks across Task 1 and Task 2; every check returned `PASS` and the aggregate self-check reported `OVERALL PASSED`.

## IPC Contract Surface
- `openCvFilePicker: () => Promise<CvPickerResult>`
- `updateCv: (content: string) => Promise<CvUpdateResult>`
- `getCvMtime: () => Promise<CvMtimeResult>`

## pdf-extract.ts API
- `MAX_FILE_BYTES = 10 * 1024 * 1024`
- `extractPdfText(filePath): Promise<{ ok: true; text: string } | { ok: false; error: string }>`
- Implementation uses `unpdf` named imports `extractText` and `getDocumentProxy`, stats the file before reading, and normalizes parser failures into `{ ok: false, error }`.

## Seed-If-Missing Confirmation
- `updateCv` now seeds `cv.md` with `''` when the file does not exist, then immediately routes the real write through `lockAndWrite`.
- This mirrors the existing `vc-firms.ts:38-42` first-write safety pattern while keeping the only direct `fs.writeFile` to the documented empty-file seed path.
