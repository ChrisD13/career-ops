# Requirements — v1.2 Setup & CV Management

## Desktop Shortcut

- [ ] **DESK-01** — App creates `~/.local/share/applications/jobengine.desktop` on first launch (packaged build only), enabling the app to appear in the system launcher
- [x] **DESK-02** — Shortcut creation is idempotent: skips silently if the `.desktop` file already exists, never overwrites user modifications

## CV Management

- [x] **CV-01** — User can open a file picker from within the app and select a `.md` or `.pdf` file to replace `cv.md`
- [x] **CV-02** — When a `.md` file is selected, its content replaces `cv.md` directly with no conversion
- [x] **CV-03** — When a `.pdf` file is selected, its text content is extracted and written to `cv.md` as plain Markdown
- [x] **CV-04** — After PDF extraction, user sees the converted Markdown in a review pane and can edit it before saving
- [x] **CV-05** — User sees a confirmation prompt before overwrite showing the current `cv.md` last-modified date

## Future Requirements (deferred)

- Human UAT backlog — 14 items deferred from v1.0–v1.1 (require packaged AppImage or live services)
- Windows/macOS shortcut support — `.desktop` is Linux-only; platform-specific shortcuts deferred

## Out of Scope

- Automatic CV parsing/structuring — raw content preserved as-is; AI reformatting is a future feature
- CV versioning / history — single `cv.md` file; git history is sufficient
- Multiple CV profiles — single canonical CV per project

## Traceability

| REQ-ID | Phase |
|--------|-------|
| DESK-01 | Phase 7 |
| DESK-02 | Phase 7 |
| CV-01 | Phase 8 |
| CV-02 | Phase 8 |
| CV-03 | Phase 8 |
| CV-04 | Phase 8 |
| CV-05 | Phase 8 |
