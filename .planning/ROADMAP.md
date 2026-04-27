# Roadmap: JobEngine v2

## Milestones

- ✅ **v1.0 JobEngine v2 MVP** — Phases 1–3 (shipped 2026-04-23)
- ✅ **v1.1 Live Validation + Analytics** — Phases 4–6 (shipped 2026-04-24)
- 📋 **v1.2 Setup & CV Management** — Phases 7–8 (planning)

## Phases

<details>
<summary>✅ v1.0 JobEngine v2 MVP (Phases 1–3) — SHIPPED 2026-04-23</summary>

- [x] Phase 1: Electron Shell + Read-Only Views (5/5 plans) — completed 2026-04-22
- [x] Phase 2: Write Safety + Anthropic Integration (6/6 plans) — completed 2026-04-22
- [x] Phase 3: VC Portfolio Discovery (3/3 plans) — completed 2026-04-23

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Live Validation + Analytics (Phases 4–6) — SHIPPED 2026-04-24</summary>

- [x] Phase 4: VC Adapter Validation (4/4 plans) — completed 2026-04-24
- [x] Phase 5: Electron Auto-Update (3/3 plans) — completed 2026-04-24
- [x] Phase 6: Response-Rate Analytics Dashboard (2/2 plans) — completed 2026-04-24

Full archive: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### v1.2 Setup & CV Management (Phases 7–8)

- [ ] **Phase 7: Desktop Shortcut Auto-Creation** — App registers itself in the Linux launcher on first packaged run, idempotently
- [ ] **Phase 8: CV Upload & PDF Extraction** — User refreshes `cv.md` from the app via file picker, with PDF-to-Markdown extraction and a review-and-confirm flow

## Phase Details

### Phase 7: Desktop Shortcut Auto-Creation
**Goal**: Eliminate the launcher friction — after first run of the packaged app, JobEngine appears in the Linux system launcher exactly like a natively installed application
**Depends on**: Phase 1 (Electron main-process app lifecycle), Phase 2 (`write-file-atomic` write pattern for the `.desktop` file)
**Requirements**: DESK-01, DESK-02
**Success Criteria** (what must be TRUE):
  1. After first launch of the packaged build, `~/.local/share/applications/jobengine.desktop` exists and JobEngine appears in the user's system launcher / app menu
  2. On every subsequent launch (packaged or dev), if the `.desktop` file already exists the app starts silently and never modifies it — manual edits by the user are preserved
  3. Shortcut creation is silent: no UI prompt, no error popup, and no behavior change when running the unpackaged dev build
**Plans**: 1
  - [ ] 07-01-PLAN.md — Create services/desktop-shortcut.ts (ensureDesktopShortcut) and wire into electron/src/main/index.ts

### Phase 8: CV Upload & PDF Extraction
**Goal**: User keeps `cv.md` fresh from inside the Electron app — pick a file, see what will be saved, confirm, done — without ever opening a terminal or text editor
**Depends on**: Phase 2 (`lockAndWrite` + `write-file-atomic` pattern for `cv.md` overwrites), Phase 7
**Requirements**: CV-01, CV-02, CV-03, CV-04, CV-05
**Success Criteria** (what must be TRUE):
  1. User can open a file picker from inside the app and select either a `.md` or `.pdf` file as the new CV source
  2. Selecting a `.md` file replaces `cv.md` byte-for-byte after the user confirms — no transformation
  3. Selecting a `.pdf` file shows the user the extracted Markdown in an editable review pane before any write happens
  4. Before either `.md` or `.pdf` content is written to `cv.md`, the user sees a confirmation prompt that displays the current `cv.md` last-modified date and gives the option to cancel
  5. After confirming, `cv.md` is updated atomically and the in-app CV view reflects the new content without a manual reload
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Electron Shell + Read-Only Views | v1.0 | 5/5 | Complete | 2026-04-22 |
| 2. Write Safety + Anthropic Integration | v1.0 | 6/6 | Complete | 2026-04-22 |
| 3. VC Portfolio Discovery | v1.0 | 3/3 | Complete | 2026-04-23 |
| 4. VC Adapter Validation | v1.1 | 4/4 | Complete | 2026-04-24 |
| 5. Electron Auto-Update | v1.1 | 3/3 | Complete | 2026-04-24 |
| 6. Response-Rate Analytics Dashboard | v1.1 | 2/2 | Complete | 2026-04-24 |
| 7. Desktop Shortcut Auto-Creation | v1.2 | 0/1 | Not started | - |
| 8. CV Upload & PDF Extraction | v1.2 | 0/? | Not started | - |
