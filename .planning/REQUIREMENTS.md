# Requirements — v1.1 Live Validation + Analytics

## VC Adapter Validation

- [ ] **ADPT-01** — All 10 VC firm scrapers return ≥1 company record against live pages
- [ ] **ADPT-02** — Scraper errors (selector miss, timeout, robots block) are visible per-firm in the Discover health panel
- [ ] **ADPT-03** — A regression test fixture captures expected output per adapter so future DOM changes are caught before runtime

## Electron Auto-Update

- [ ] **UPD-01** — App checks GitHub Releases for a newer version on startup (background, non-blocking)
- [ ] **UPD-02** — User sees an in-app banner/dialog showing version and release notes when an update is available
- [ ] **UPD-03** — User can trigger download + install with one click, or dismiss and be reminded on next launch

## Response-Rate Analytics

- [ ] **ANAL-01** — User can view a panel showing score-to-outcome correlation (score buckets vs response rate)
- [ ] **ANAL-02** — Funnel visualization shows counts at each stage: applied → responded → interview → offer
- [ ] **ANAL-03** — Panel refreshes automatically when `applications.md` changes on disk

## Future Requirements (deferred)

- Human UAT for v1.0 Phases 2 + 3 — deferred until project feature-complete
- Crunchbase API for funding signals — heuristics sufficient for v1.x
- Inline report editing — read-only view preserved
- Mobile app — desktop Electron only

## Out of Scope

- Automatic application submission — ethical constraint, user always reviews before Submit
- Cloud sync / remote state — local-only
- SQLite or any database — file-backed state preserved
- Multi-language modes changes — modes layer is user-configured, not Electron's concern
- Interview prep panel — project scope is discovery and application automation only

## Traceability

| REQ-ID | Phase |
|--------|-------|
| ADPT-01, ADPT-02, ADPT-03 | Phase 4 |
| UPD-01, UPD-02, UPD-03 | Phase 5 |
| ANAL-01, ANAL-02, ANAL-03 | Phase 6 |
