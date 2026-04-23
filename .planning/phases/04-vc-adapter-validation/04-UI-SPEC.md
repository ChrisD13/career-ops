# Phase 4: VC Adapter Validation — UI Design Contract

**Status:** Ready for planning
**Scope:** Minor enhancement to existing ScraperHealthPanel component
**Date:** 2026-04-23

---

## 1. Design System

**Framework:** Catppuccin Mocha (ctp-*) — existing design system. All changes must use existing tokens.

**Existing components affected:**
- `ScraperHealthPanel.tsx` — collapsible panel, already renders OK/Stale/Error rows
- `HealthStatusDot.tsx` — colored dot; reason currently tooltip-only via `title` attribute

---

## 2. UI Change: Reason Text in Error Rows (ADPT-02)

**What changes:** When a firm has `status === 'Error'`, the reason code is currently shown only as a tooltip on the status dot. Surface it as visible inline text next to the dot.

**Before:** `● Error` (reason in title tooltip only)
**After:** `● Error — selector_miss` (reason as dim text, inline)

### Layout

```
| Firm Name | ● Error — selector_miss | 2026-04-22 | 0 | 42 |
```

- Reason text: `text-ctp-subtext text-label` (same as Last Run column)
- Separator: ` — ` (em dash with spaces)
- Only show reason when `f.reason` is non-empty AND `f.status === 'Error'`
- Stale rows: no reason text (Stale doesn't use canonical reason codes)
- OK rows: no reason text

### Canonical Reason Codes (display as-is)
- `selector_miss` — adapter returned 0 companies
- `timeout` — page load exceeded 30s
- `robots_block` — robots.txt disallowed the URL
- `network_error` — fetch/navigation failed

---

## 3. Non-Changes

- Panel collapse/expand behavior: unchanged
- HealthStatusDot: add `data-reason` attribute for test targeting; visual unchanged
- Table columns: unchanged (Firm, Status, Last Run, Companies, Baseline)
- No new modal, drawer, or full-page view needed
- No color changes — Error is already `ctp-red`

---

## 4. Accessibility

- Reason text inherits panel's font-size (`text-label`)
- HealthStatusDot already has `aria-label={status}` — no change needed
- Tooltip on dot still shows full `Status: reason` for screen readers

---

## 5. Verification

- ScraperHealthPanel renders `selector_miss` text visible in Error row (not tooltip-only)
- OK and Stale rows show no reason text
- Existing `data-testid="health-panel-toggle"` and `data-testid="health-status-dot"` attributes preserved
