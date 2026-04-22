# Phase 1: Electron Shell + Read-Only Views — Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 19 new files
**Analogs found:** 14 / 19 (5 are net-new with no codebase analog — use RESEARCH.md patterns)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `electron/src/main/index.ts` | config/entry | request-response | `dashboard/internal/ui/screens/pipeline.go` (app bootstrap) | partial |
| `electron/src/main/ipc-handlers.ts` | service | request-response | `lib/statuses.mjs` (`getStatusCatalog`) | role-match |
| `electron/src/main/parsers/applications.ts` | utility | transform | `dashboard/internal/data/career.go` (`ParseApplications`) | exact |
| `electron/src/main/parsers/pipeline.ts` | utility | transform | `dashboard/internal/data/career.go` (file-read + line-split loop) | role-match |
| `electron/src/main/parsers/statuses.ts` | utility | transform | `lib/statuses.mjs` (`loadStates` + `buildCatalog`) | exact |
| `electron/src/main/watcher.ts` | service | event-driven | `liveness-core.mjs` (shared-module pattern) | partial |
| `electron/src/preload/index.ts` | middleware | request-response | (no codebase analog — Electron-specific) | none |
| `electron/src/renderer/main.tsx` | config/entry | request-response | (no codebase analog — React-specific) | none |
| `electron/src/renderer/App.tsx` | component | request-response | `dashboard/internal/ui/screens/pipeline.go` (screen-level shell + layout) | partial |
| `electron/src/renderer/components/TrackerPanel.tsx` | component | CRUD | `dashboard/internal/ui/screens/pipeline.go` (`renderBody` + `renderAppLine`) | role-match |
| `electron/src/renderer/components/ReportViewer.tsx` | component | file-I/O | `dashboard/internal/ui/screens/viewer.go` (markdown file render) | role-match |
| `electron/src/renderer/components/PipelinePanel.tsx` | component | CRUD | `dashboard/internal/ui/screens/pipeline.go` (pipeline inbox concept) | role-match |
| `electron/src/renderer/components/Sidebar.tsx` | component | request-response | `dashboard/internal/ui/screens/pipeline.go` (`renderTabs`) | partial |
| `electron/src/renderer/components/SplitPaneLayout.tsx` | component | request-response | (no codebase analog — CSS layout) | none |
| `electron/src/renderer/components/FileChangeBanner.tsx` | component | event-driven | `liveness-core.mjs` (signal-emit pattern) | partial |
| `electron/src/renderer/components/ScoreBadge.tsx` | component | transform | `dashboard/internal/ui/screens/pipeline.go` (`scoreStyle`) | partial |
| `electron/src/renderer/components/StatusBadge.tsx` | component | transform | `dashboard/internal/ui/screens/pipeline.go` (`statusColorMap` + `statusLabel`) | partial |
| `electron/tailwind.config.js` | config | transform | `dashboard/internal/theme/catppuccin.go` (color tokens) | role-match |
| `electron/electron.vite.config.ts` | config | transform | (no codebase analog — electron-vite specific) | none |

---

## Pattern Assignments

### `electron/src/main/parsers/applications.ts` (utility, transform)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/data/career.go`

This is the primary analog for the parser. Port the Go logic to TypeScript — the research doc already provides a complete TypeScript translation. The key patterns to copy are:

**File-read + line-split loop** (career.go lines 34–54):
```go
content, err := os.ReadFile(filePath)
lines := strings.Split(string(content), "\n")
for _, line := range lines {
    line = strings.TrimSpace(line)
    if line == "" || strings.HasPrefix(line, "# ") || strings.HasPrefix(line, "|---") || strings.HasPrefix(line, "| #") {
        continue
    }
    if !strings.HasPrefix(line, "|") {
        continue
    }
```

**Tab-mixed vs pure-pipe delimiter detection** (career.go lines 57–73):
```go
if strings.Contains(line, "\t") {
    line = strings.TrimPrefix(line, "|")
    line = strings.TrimSpace(line)
    parts := strings.Split(line, "\t")
    for _, p := range parts {
        fields = append(fields, strings.TrimSpace(strings.Trim(p, "|")))
    }
} else {
    line = strings.Trim(line, "|")
    parts := strings.Split(line, "|")
    for _, p := range parts {
        fields = append(fields, strings.TrimSpace(p))
    }
}
```

**Field mapping with min-8-fields guard** (career.go lines 75–102):
```go
if len(fields) < 8 {
    continue
}
num++
app := model.CareerApplication{
    Number:  num,
    Date:    fields[1],
    Company: fields[2],
    Role:    fields[3],
    Status:  fields[5],
    HasPDF:  strings.Contains(fields[6], "✅"),
}
app.ScoreRaw = fields[4]
if sm := reScoreValue.FindStringSubmatch(fields[4]); sm != nil {
    app.Score, _ = strconv.ParseFloat(sm[1], 64)
}
if rm := reReportLink.FindStringSubmatch(fields[7]); rm != nil {
    app.ReportNumber = rm[1]
    app.ReportPath = rm[2]
}
if len(fields) > 8 {
    app.Notes = fields[8]
}
```

**Compiled regex patterns** (career.go lines 16–27) — translate to TypeScript constants:
```go
reReportLink = regexp.MustCompile(`\[(\d+)\]\(([^)]+)\)`)
reScoreValue = regexp.MustCompile(`(\d+\.?\d*)/5`)
```

**Status normalization — strip bold + trailing date** (career.go `NormalizeStatus`, lines 474–479):
```go
s := strings.ReplaceAll(raw, "**", "")
s = strings.TrimSpace(strings.ToLower(s))
if idx := strings.Index(s, " 202"); idx > 0 {
    s = strings.TrimSpace(s[:idx])
}
```

Also cross-reference `lib/statuses.mjs` `stripStatusDecorators` (lines 85–91) for the Node.js equivalent:
```javascript
export function stripStatusDecorators(raw = '') {
  return String(raw ?? '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '')
    .trim();
}
```

---

### `electron/src/main/parsers/statuses.ts` (utility, transform)

**Analog:** `/home/desachri/JobEngine/lib/statuses.mjs`

This is an exact analog. The Electron main process version does the same thing: reads `templates/states.yml`, parses with `js-yaml`, returns a typed array. Use `fs.promises` instead of `readFileSync`.

**Import block** (statuses.mjs lines 1–3):
```javascript
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
```
TypeScript version uses `import * as fs from 'fs/promises'` and `import yaml from 'js-yaml'`.

**Fallback states constant** (statuses.mjs lines 5–14) — copy verbatim as TypeScript:
```javascript
const FALLBACK_STATES = [
  { id: 'evaluated', label: 'Evaluated', aliases: ['evaluada'] },
  { id: 'applied', label: 'Applied', aliases: ['aplicado', 'enviada', 'aplicada', 'sent'] },
  { id: 'responded', label: 'Responded', aliases: ['respondido'] },
  { id: 'interview', label: 'Interview', aliases: ['entrevista'] },
  { id: 'offer', label: 'Offer', aliases: ['oferta'] },
  { id: 'rejected', label: 'Rejected', aliases: ['rechazado', 'rechazada'] },
  { id: 'discarded', label: 'Discarded', aliases: ['descartado', 'descartada', 'cerrada', 'cancelada'] },
  { id: 'skip', label: 'SKIP', aliases: ['no_aplicar', 'no aplicar', 'skip', 'monitor'] },
];
```

**loadStates with two-path candidate pattern** (statuses.mjs lines 26–44):
```javascript
function loadStates(baseDir) {
  const candidates = [
    join(baseDir, 'templates', 'states.yml'),
    join(baseDir, 'states.yml'),
  ];
  for (const path of candidates) {
    try {
      const data = yaml.load(readFileSync(path, 'utf-8'));
      if (Array.isArray(data?.states) && data.states.length > 0) {
        return data.states;
      }
    } catch {
      // Fall back to defaults below.
    }
  }
  return FALLBACK_STATES;
}
```
The Electron version calls `await fs.readFile(path, 'utf-8')` instead of `readFileSync`.

**buildCatalog — id/alias normalization** (statuses.mjs lines 46–76):
```javascript
function buildCatalog(states) {
  const normalizedStates = states.map((state) => ({
    id: String(state.id || '').trim().toLowerCase(),
    label: String(state.label || state.id || '').trim(),
    aliases: Array.isArray(state.aliases) ? state.aliases.map((alias) => String(alias).trim()) : [],
  })).filter((state) => state.id && state.label);
  // ...returns { states, idToState, aliasToId }
}
```

For the IPC handler, only `states` (the array) needs to be returned to the renderer — the full catalog maps are main-process-only.

---

### `electron/src/main/parsers/pipeline.ts` (utility, transform)

**Analog:** `/home/desachri/JobEngine/data/pipeline.md` (data format reference) + `/home/desachri/JobEngine/dashboard/internal/data/career.go` (file-read pattern)

The pipeline.md format observed (lines 5–40 of the file): each entry is `- [ ] URL | Company | Role` under a `## Pendientes` section header. The parser must skip section headers and blank lines.

**File-read pattern to copy from career.go** (lines 34–43):
```go
content, err := os.ReadFile(filePath)
// ...
lines := strings.Split(string(content), "\n")
for _, line := range lines {
    line = strings.TrimSpace(line)
    if line == "" || strings.HasPrefix(line, "#") {
        continue
    }
```

**Checkbox-line regex** — the exact format from the data file:
```
- [ ] https://... | Company | Role Title
- [x] https://... | Company | Role Title   (done entries)
```
Match with: `/^-\s+\[( |x)\]\s+(.+)/`

Split `rest` on ` | ` — first part is URL, second is company, third is role. Confirmed in actual pipeline.md data (lines 5-40).

---

### `electron/src/main/ipc-handlers.ts` (service, request-response)

**Analog:** `/home/desachri/JobEngine/lib/statuses.mjs` (module-export pattern) + RESEARCH.md Pattern 2

`lib/statuses.mjs` shows the project's convention for exporting multiple named functions from a single module. The IPC handlers file follows the same single-module, multiple-named-exports pattern.

**Module export pattern** (statuses.mjs lines 78–83):
```javascript
export function getStatusCatalog(baseDir) { ... }
export function stripStatusDecorators(raw = '') { ... }
export function normalizeStatusMeta(raw, baseDir) { ... }
export function normalizeStatusId(raw, baseDir) { ... }
```

The IPC handler equivalent exports a single `registerIpcHandlers(projectRoot)` function that registers all channels. Copy the Zod path-validation pattern from RESEARCH.md Pattern 2 (lines 356–377 of RESEARCH.md) — there is no codebase analog for Zod usage.

**Async fs.promises pattern** — the project mandates async I/O (from CONTEXT.md §Established Patterns). No sync file reads. The `lib/statuses.mjs` uses `readFileSync` (synchronous) — the Electron version MUST use `fs.promises.readFile` instead.

---

### `electron/src/main/watcher.ts` (service, event-driven)

**Analog:** `/home/desachri/JobEngine/liveness-core.mjs` (shared-module export pattern)

`liveness-core.mjs` shows the pattern for a module that exports a single pure function called by multiple consumers. `watcher.ts` follows the same structure: one exported function `startFileWatcher(projectRoot, win)` called from `index.ts`.

**Shared module export shape** (liveness-core.mjs lines 46–75):
```javascript
export function classifyLiveness({ status = 0, finalUrl = '', bodyText = '', applyControls = [] } = {}) {
  // all logic self-contained, pure inputs/outputs
  return { result: '...', reason: '...' }
}
```

The `startFileWatcher` function mirrors this: receives its dependencies as parameters (`projectRoot: string, win: BrowserWindow`), no module-level side effects until called, returns void (side effect is chokidar subscription).

There is no event-emitter or file-watcher pattern in the existing Node.js codebase — copy chokidar pattern from RESEARCH.md Pattern 4 (lines 474–522 of RESEARCH.md).

---

### `electron/src/main/index.ts` (config/entry, request-response)

**Analog:** No direct analog. The closest structural reference is the Bubbletea app bootstrap in `dashboard/internal/ui/screens/pipeline.go` (`NewPipelineModel` + `Init`), which shows the project's pattern of: initialize with parameters, then wire side effects.

**Project root resolution convention** — follow RESEARCH.md Pattern 11. Critical: `path.resolve(__dirname, '../../..')` from `electron/out/main/index.js` reaches project root.

**BrowserWindow security flags** — use RESEARCH.md Pattern 1 verbatim (lines 263–303 of RESEARCH.md). Non-negotiable per ELEC-01.

---

### `electron/src/preload/index.ts` (middleware, request-response)

**Analog:** None in codebase — this is Electron-specific. Use RESEARCH.md Pattern 2 (lines 310–344 of RESEARCH.md) verbatim.

Key constraint: sandbox mode means NO `require('fs')` or any Node.js imports in this file. Only `contextBridge` and `ipcRenderer` from the `electron` package.

---

### `electron/src/renderer/App.tsx` (component, request-response)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` (overall shell structure)

The Go `PipelineModel` serves as the conceptual analog: it owns top-level state (`apps`, `filtered`, `sortMode`, `activeTab`), delegates rendering to sub-functions, and manages navigation state. The React `App.tsx` does the same: owns `activePanel` state, renders `<Sidebar>` + content area, passes IPC data down as props.

**State shape to mirror from pipeline.go** (lines 98–114):
```go
type PipelineModel struct {
    apps          []model.CareerApplication
    filtered      []model.CareerApplication
    cursor        int
    sortMode      string
    activeTab     int
    viewMode      string
    width, height int
    reportCache   map[string]reportSummary
    statusPicker  bool
}
```
React equivalent: `activePanel` (string union), `trackerRows` (TrackerRow[]), `statuses` (StatusEntry[]), `filesChanged` (boolean), `openReportPath` (string | null).

**View composition pattern** (pipeline.go `View()`, lines 538–578):
```go
func (m PipelineModel) View() string {
    header := m.renderHeader()
    tabs := m.renderTabs()
    body := m.renderBody()
    // ...
    return lipgloss.JoinVertical(lipgloss.Left, header, tabs, body, ...)
}
```
React equivalent: `<div className="flex h-screen">` wrapping `<Sidebar>` + `<main>` with conditional panel renders.

---

### `electron/src/renderer/components/TrackerPanel.tsx` (component, CRUD)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` (`renderBody` + `renderAppLine`)

**Column width map from pipeline.go** (lines 728–737):
```go
scoreW  := 5
dateW   := 10
companyW := 16
statusW := 12
compW   := 14
// Role gets remaining space
roleW := m.width - scoreW - dateW - companyW - statusW - compW - 12
```
The React version uses pixel widths (from RESEARCH.md Pattern 6): `num:48, date:88, company:160, role:200, score:72, status:120, pdf:48, report:72, notes:flex`.

**Empty-state pattern** (pipeline.go `renderBody`, lines 688–694):
```go
if len(m.filtered) == 0 {
    emptyStyle := lipgloss.NewStyle().Foreground(m.theme.Subtext).Padding(1, 2)
    return emptyStyle.Render("No offers match this filter")
}
```
React equivalent: conditional render of `<EmptyState>` component when `rows.length === 0`.

**Score coloring thresholds** (pipeline.go `scoreStyle`, lines 906–917):
```go
case score >= 4.2: return Green + Bold
case score >= 3.8: return Yellow
case score >= 3.0: return Text (neutral)
default:           return Red
```
Copy these exact thresholds into `ScoreBadge.tsx`.

**react-window FixedSizeList** — no codebase analog. Use RESEARCH.md Pattern 6 (lines 571–616 of RESEARCH.md). Critical: pass numeric `height` (not `"100%"`), use `ResizeObserver`.

---

### `electron/src/renderer/components/ReportViewer.tsx` (component, file-I/O)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/viewer.go`

`viewer.go` shows what the report viewer must do: read file content, split into lines, render with scroll. The React version replaces the terminal line-buffer with `react-markdown`.

**Content structure** (viewer.go lines 29–40):
```go
func NewViewerModel(t theme.Theme, path, title string, ...) ViewerModel {
    content, err := os.ReadFile(path)
    // ...
    return ViewerModel{
        lines: strings.Split(string(content), "\n"),
        title: title,
    }
}
```
React equivalent: receive `content: string` as prop (content already loaded via IPC); `react-markdown` handles line splitting internally.

**No direct analog for react-markdown rendering** — use RESEARCH.md Pattern 7 (lines 625–678 of RESEARCH.md) for the component map. The markdown heading → Tailwind class mapping in Pattern 7 is authoritative.

---

### `electron/src/renderer/components/PipelinePanel.tsx` (component, CRUD)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` (pipeline inbox concept — `renderBody` showing list with URL entries)

The pipeline.go `renderAppLine` (lines 725–789) shows the column layout for a list row. The `PipelinePanel` is simpler — it shows `PipelineEntry[]` (url, company, role, done) not the full tracker row.

**Done/pending visual distinction from pipeline.go** — the Go TUI uses `filterAll`/`filterApplied` tabs to separate done items. The React panel uses a simpler `done` boolean flag from the parser — render done items with `line-through` or `opacity-50` styling (Claude's discretion).

**Empty-state and section-header pattern** (pipeline.go lines 688–715):
```go
if len(m.filtered) == 0 {
    return emptyStyle.Render("No offers match this filter")
}
// Section headers in grouped mode:
headerStyle.Render(fmt.Sprintf("── %s (%d)", strings.ToUpper(statusLabel(norm)), count))
```

---

### `electron/src/renderer/components/Sidebar.tsx` (component, request-response)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` (`renderTabs`, lines 601–631)

The Go tab bar shows the same navigation concepts (Tracker, Reports, Pipeline). The React sidebar is a vertical rail instead of a horizontal tab bar, but the active/inactive state pattern is identical.

**Active tab highlight pattern** (pipeline.go `renderTabs`, lines 606–621):
```go
if i == m.activeTab {
    style := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Blue)
    tabs = append(tabs, style.Render(label))
    underParts = append(underParts, strings.Repeat("━", lipgloss.Width(label)))
} else {
    style := lipgloss.NewStyle().Foreground(m.theme.Subtext)
    tabs = append(tabs, style.Render(label))
}
```
React equivalent: `className={active ? 'text-ctp-blue font-semibold' : 'text-ctp-subtext'}` with a left-border indicator for the active nav item.

---

### `electron/src/renderer/components/ScoreBadge.tsx` and `StatusBadge.tsx` (component, transform)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` (`scoreStyle` lines 906–917, `statusColorMap` lines 919–930, `statusLabel` lines 954–975)

**Score color thresholds** (pipeline.go lines 906–917):
```go
func (m PipelineModel) scoreStyle(score float64) lipgloss.Style {
    switch {
    case score >= 4.2: return Green + Bold
    case score >= 3.8: return Yellow
    case score >= 3.0: return Text
    default:           return Red
    }
}
```

**Status color map** (pipeline.go lines 919–930):
```go
return map[string]lipgloss.Color{
    "interview": m.theme.Green,
    "offer":     m.theme.Green,
    "applied":   m.theme.Sky,
    "responded": m.theme.Blue,
    "evaluated": m.theme.Text,
    "skip":      m.theme.Red,
    "rejected":  m.theme.Subtext,
    "discarded": m.theme.Subtext,
}
```
React equivalent uses Tailwind classes: `interview/offer → text-ctp-green`, `applied → text-ctp-sky`, `responded → text-ctp-blue`, `evaluated → text-ctp-text`, `skip → text-ctp-red`, `rejected/discarded → text-ctp-subtext`.

**Status labels** (pipeline.go `statusLabel`, lines 954–975) — copy the same 8 canonical label strings.

---

### `electron/tailwind.config.js` (config, transform)

**Analog:** `/home/desachri/JobEngine/dashboard/internal/theme/catppuccin.go`

The Go theme file is the canonical source of Catppuccin Mocha hex values for this project. The Tailwind config maps these same values to CSS custom properties.

**Catppuccin Mocha hex values** (catppuccin.go lines 6–23):
```go
Base:    "#1e1e2e"
Surface: "#313244"
Overlay: "#45475a"
Text:    "#cdd6f4"
Subtext: "#a6adc8"
Blue:    "#89b4fa"
Mauve:   "#cba6f7"
Green:   "#a6e3a1"
Yellow:  "#f9e2af"
Sky:     "#89dceb"
Peach:   "#fab387"
Red:     "#f38ba8"
```

These are the authoritative values. The Tailwind config pattern (CSS variable + `rgb()` wrapper for opacity support) comes from RESEARCH.md Pattern 8 (lines 685–746 of RESEARCH.md) — there is no codebase Tailwind analog.

---

### `electron/electron.vite.config.ts` (config, transform)

**Analog:** None in codebase. Use RESEARCH.md Pattern 9 verbatim (lines 755–791 of RESEARCH.md).

---

### `electron/src/renderer/components/SplitPaneLayout.tsx` (component, request-response)

**Analog:** None in codebase. The Go TUI has no split-pane concept (it navigates between full-screen views). Use RESEARCH.md Pattern 10 verbatim (lines 800–832 of RESEARCH.md).

Default split: 45% left (tracker) / 55% right (report). Pure CSS flex — no library.

---

### `electron/src/renderer/components/FileChangeBanner.tsx` (component, event-driven)

**Analog:** `/home/desachri/JobEngine/liveness-core.mjs` (event signal pattern — conceptual only)

`liveness-core.mjs` returns `{ result, reason }` signals that callers act on. The `FileChangeBanner` renders in response to a signal (`filesChanged: boolean`) pushed from the main process via `onFilesChanged` IPC. The structural pattern: signal arrives → state flag flips → component becomes visible → user action clears flag.

No codebase UI analog exists. The banner is a simple conditional render:
- Hidden when `filesChanged === false`
- Visible when `filesChanged === true`: `role="status"` div with `bg-ctp-yellow/15` tint + click handler that calls `window.api.readTracker()` and clears the flag.

---

## Shared Patterns

### Async file I/O (applies to all `electron/src/main/` files)

**Source:** CONTEXT.md §Established Patterns + `lib/statuses.mjs`
**Rule:** All file reads use `fs.promises` — never `fs.readFileSync`. The existing `lib/statuses.mjs` uses `readFileSync` (it runs in CLI context where sync is acceptable), but the CONTEXT.md explicitly overrides this for Electron main process.

```typescript
// Correct in Electron main — async
import * as fs from 'fs/promises'
const content = await fs.readFile(filePath, 'utf-8')

// Wrong in Electron main — blocks event loop
import { readFileSync } from 'fs'
const content = readFileSync(filePath, 'utf-8')  // NEVER
```

---

### Catppuccin Mocha color tokens (applies to all renderer components)

**Source:** `/home/desachri/JobEngine/dashboard/internal/theme/catppuccin.go` (hex values)
**Apply to:** All `*.tsx` components using color classes

Use `ctp-` prefixed Tailwind classes: `text-ctp-blue`, `bg-ctp-surface`, `border-ctp-overlay`, etc. For opacity variants use the `/` modifier: `bg-ctp-yellow/15` (banner tint). Do NOT hardcode hex values in component files — always use the Tailwind token.

The color-to-semantic mapping from pipeline.go `statusColorMap`:
- Interactive/active: `ctp-blue`
- Success/interview/offer: `ctp-green`
- Applied: `ctp-sky`
- Responded: `ctp-blue`
- Warning/score-medium: `ctp-yellow`
- Error/skip: `ctp-red`
- Neutral/subtext: `ctp-subtext`
- Surface/hover: `ctp-surface` / `ctp-overlay`

---

### Project root path resolution (applies to all `electron/src/main/` files that read data)

**Source:** RESEARCH.md Pattern 11 + CONTEXT.md §Integration Points
**Apply to:** `index.ts`, `ipc-handlers.ts`, `watcher.ts`

Compute once at startup, pass to all consumers:
```typescript
// In src/main/index.ts
function resolveProjectRoot(): string {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '../../..')
    // __dirname = electron/out/main → up 3 levels = project root
  }
  return path.resolve(app.getAppPath(), '..')
}
```

All parsers and the watcher receive `projectRoot` as a parameter — never compute paths with `__dirname` inside individual functions.

---

### Status normalization (applies to `parsers/applications.ts` and renderer badge components)

**Source:** `/home/desachri/JobEngine/lib/statuses.mjs` lines 85–91 + `/home/desachri/JobEngine/dashboard/internal/data/career.go` lines 473–503

The project has two status-normalization implementations that agree. Use the Node.js version as the TypeScript reference:

```javascript
// From lib/statuses.mjs stripStatusDecorators (lines 85-91)
export function stripStatusDecorators(raw = '') {
  return String(raw ?? '')
    .replace(/\*\*/g, '')          // remove bold markers
    .trim()
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '')  // strip trailing date
    .trim();
}
```

The 8 canonical status IDs (from `templates/states.yml`): `evaluated`, `applied`, `responded`, `interview`, `offer`, `rejected`, `discarded`, `skip`. These are the only valid values for the status dropdown in `StatusSelect.tsx`.

---

### IPC path validation (applies to `ipc-handlers.ts` and `preload/index.ts`)

**Source:** RESEARCH.md Pattern 2 (no codebase analog)
**Apply to:** `readReport` IPC channel exclusively

```typescript
// Zod schema in main — validate before any fs.readFile
const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)

ipcMain.handle('readReport', async (_event, rawPath: unknown) => {
  const reportPath = ReportPathSchema.parse(rawPath)  // throws ZodError on path traversal
  return fs.readFile(path.join(projectRoot, reportPath), 'utf-8')
})
```

---

### Shared module export shape (applies to all `electron/src/main/` modules)

**Source:** `/home/desachri/JobEngine/liveness-core.mjs` (module structure) + `/home/desachri/JobEngine/lib/statuses.mjs` (multiple named exports)

Each main-process module exports one or more named functions. No default exports. No module-level side effects (no file reads at import time — all I/O is inside function bodies). This matches the existing `.mjs` script conventions in the project root.

---

## No Analog Found

Files with no close codebase match (planner MUST use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason | RESEARCH.md Pattern |
|------|------|-----------|--------|---------------------|
| `electron/src/preload/index.ts` | middleware | request-response | Electron contextBridge is unique to Electron apps | Pattern 2 (lines 310–344) |
| `electron/src/renderer/main.tsx` | config/entry | request-response | React root bootstrap — no React in codebase | Standard React pattern |
| `electron/src/renderer/components/SplitPaneLayout.tsx` | component | request-response | No split-pane concept in Go TUI | Pattern 10 (lines 800–832) |
| `electron/electron.vite.config.ts` | config | transform | No Vite/webpack config in codebase | Pattern 9 (lines 755–791) |
| `electron/package.json` | config | — | Electron sub-project manifest | Code Examples section (lines 942–966) |

---

## Metadata

**Analog search scope:**
- `/home/desachri/JobEngine/dashboard/internal/data/career.go` — parser reference
- `/home/desachri/JobEngine/dashboard/internal/ui/screens/pipeline.go` — pipeline/tracker UI reference
- `/home/desachri/JobEngine/dashboard/internal/ui/screens/viewer.go` — report viewer reference
- `/home/desachri/JobEngine/dashboard/internal/theme/catppuccin.go` — color token reference
- `/home/desachri/JobEngine/lib/statuses.mjs` — status loading/normalization reference
- `/home/desachri/JobEngine/liveness-core.mjs` — shared module pattern reference
- `/home/desachri/JobEngine/package.json` — root manifest (existing deps: js-yaml, playwright)
- `/home/desachri/JobEngine/templates/states.yml` — canonical status values
- `/home/desachri/JobEngine/data/pipeline.md` — actual pipeline format (verified)

**Files scanned:** 8 codebase files read in full
**Pattern extraction date:** 2026-04-22
**No TypeScript or React files exist in the codebase** — all UI analogs are Go (Bubbletea/lipgloss). Concept-level patterns apply; implementation syntax comes from RESEARCH.md.
