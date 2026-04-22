# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- Root automation scripts use kebab-case CLI filenames: `scan.mjs`, `verify-pipeline.mjs`, `check-liveness.mjs`, `merge-tracker.mjs`, `batch/batch-runner.sh`.
- Dashboard Go files use short lowercase package filenames by responsibility: `dashboard/internal/data/career.go`, `dashboard/internal/ui/screens/pipeline.go`, `dashboard/internal/theme/theme.go`.
- Mode and documentation files mirror user-facing commands and locale directories: `modes/oferta.md`, `modes/auto-pipeline.md`, `modes/de/angebot.md`, `modes/ja/kyujin.md`.

**Functions:**
- JavaScript functions use lowerCamelCase and are usually verb-first: `buildTitleFilter`, `loadSeenUrls`, `normalizeTextForATS`, `checkPlaywright`.
- CLI entrypoints are explicit `main()`-style functions or a single top-level action such as `generatePDF()` in `generate-pdf.mjs`, followed by a terminal `.catch(...)`.
- Go exports use PascalCase for reusable API and constructors: `ParseApplications`, `ComputeMetrics`, `NewPipelineModel`, `NewTheme`.

**Variables:**
- JavaScript top-level configuration and path constants use uppercase snake case: `PORTALS_PATH`, `FETCH_TIMEOUT_MS`, `CANONICAL_STATES`, `ADDITIONS_DIR`.
- Mutable counters and accumulators use lowerCamelCase: `totalFound`, `badStatuses`, `warnings`, `scrollOffset`.
- Go package-level regex helpers use descriptive lowerCamel names with `re` prefixes in `dashboard/internal/data/career.go`: `reReportLink`, `reScoreValue`, `reBatchID`.

**Types:**
- Go structs and message types use PascalCase with clear suffixes: `CareerApplication`, `PipelineMetrics`, `PipelineOpenReportMsg`, `ViewerClosedMsg`.
- JavaScript favors plain object literals over class hierarchies; reusable shapes are implicit in helper returns, such as the offer objects created in `scan.mjs` and the `{ result, reason }` object returned by `liveness-core.mjs`.

## Code Style

**Formatting:**
- No repo-level formatter config is checked in. There is no `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `prettier.config.*`, `biome.json`, or `.editorconfig` at the project root.
- Root `.mjs` files use ESM imports, semicolons, single quotes, and compact helper functions. Representative files: `test-all.mjs`, `verify-pipeline.mjs`, `scan.mjs`, `generate-pdf.mjs`.
- Long scripts are split with visible section-divider comments instead of deep class structures. Examples: `scan.mjs`, `followup-cadence.mjs`, `analyze-patterns.mjs`, `test-all.mjs`.
- Shell automation in `batch/batch-runner.sh` uses strict mode (`set -euo pipefail`), uppercase environment-style variables, and named functions like `check_prerequisites()` and `init_state()`.
- Go code under `dashboard/` follows standard `gofmt` layout: grouped imports, tabs, brace-on-same-line, short receiver names, and constructor helpers such as `NewPipelineModel(...)` in `dashboard/internal/ui/screens/pipeline.go`.

**Linting:**
- No dedicated lint runner is configured in `package.json`.
- Quality gates are executable verification scripts instead of a linter stack: `doctor.mjs`, `verify-pipeline.mjs`, `cv-sync-check.mjs`, `check-liveness.mjs`, and `test-all.mjs`.
- The dashboard side currently relies on compiler validity through `cd dashboard && go build ./...` instead of `go test` or staticcheck wiring.

## Import Organization

**Order:**
1. Keep all imports at the top of the file.
2. Group runtime/core modules and external packages before relative imports; local modules stay last when present, as in `check-liveness.mjs` importing `./liveness-core.mjs`.
3. Use dynamic `await import(...)` only for optional or deferred work, such as loading `playwright` inside `doctor.mjs` or `fs/promises` inside `generate-pdf.mjs`.

**Path Aliases:**
- JavaScript uses direct relative imports only. Example: `check-liveness.mjs` imports `./liveness-core.mjs`.
- Go uses the module path from `dashboard/go.mod` and imports concrete internal packages such as `github.com/santifer/career-ops/dashboard/internal/data` and `github.com/santifer/career-ops/dashboard/internal/theme`.

**Representative Pattern:**
```js
import { chromium } from 'playwright';
import { readFile } from 'fs/promises';
import { classifyLiveness } from './liveness-core.mjs';
```
This top-of-file pattern from `check-liveness.mjs` is the standard shape for reusable JavaScript modules in the repo.

## Error Handling

**Patterns:**
- Validate required inputs early, print a human-readable message, and exit non-zero for misuse. Examples: `generate-pdf.mjs`, `check-liveness.mjs`, `scan.mjs`.
- Treat missing user data as a graceful no-op when the script is maintenance-oriented. `verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs`, and `merge-tracker.mjs` all return cleanly when `applications.md` is absent.
- Wrap async CLI entrypoints in `main().catch(...)` or equivalent fatal handlers. Examples: `scan.mjs`, `check-liveness.mjs`, `generate-pdf.mjs`, `doctor.mjs`.
- Use `try/finally` around resources that must close cleanly. `generate-pdf.mjs` always closes Chromium; `check-liveness.mjs` closes the browser after sequential URL checks.
- In Go, return errors from the data layer and decide user-facing behavior in the UI or main package. `dashboard/internal/data/career.go` returns `error` from `UpdateApplicationStatus`, while `dashboard/main.go` logs a warning and reloads state.

**Representative Pattern:**
```js
main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
```
This exact termination style appears in `scan.mjs` and `check-liveness.mjs`.

```go
err := data.UpdateApplicationStatus(msg.CareerOpsPath, msg.App, msg.NewStatus)
if err != nil {
	fmt.Fprintf(os.Stderr, "WARN: status update failed: %v\n", err)
}
```
This pattern from `dashboard/main.go` shows the usual Go split between returned errors and UI-level recovery.

## Logging

**Framework:** `console` in JavaScript and `fmt.Fprintf(os.Stderr, ...)` / `fmt.Sprintf(...)` in Go.

**Patterns:**
- CLI scripts print checklist-style output with emoji or marker prefixes rather than structured logs. See `doctor.mjs`, `verify-pipeline.mjs`, `test-all.mjs`, and `check-liveness.mjs`.
- Success, warning, and failure helpers are often tiny local wrappers, such as `pass()`, `fail()`, and `warn()` in `test-all.mjs`, or `error()`, `warn()`, and `ok()` in `verify-pipeline.mjs`.
- JSON output is used only where another tool is expected to consume it. `update-system.mjs check` prints JSON status objects; most other scripts optimize for operator readability.
- Go warnings go to stderr while TUI state stays interactive, as shown in `dashboard/main.go`.

## Comments

**When to Comment:**
- Start executable scripts with a file-level docblock explaining purpose, key checks, and usage. Examples: `doctor.mjs`, `verify-pipeline.mjs`, `test-all.mjs`, `check-liveness.mjs`.
- Use section headers to break long files into operational stages. Examples: `scan.mjs`, `followup-cadence.mjs`, `analyze-patterns.mjs`, `test-all.mjs`.
- Add inline comments for heuristics, compatibility fallbacks, or safety-sensitive behavior rather than narrating trivial assignments. Examples: mixed-format parsing in `dashboard/internal/data/career.go`, status normalization in `merge-tracker.mjs`, and SPA hydration waits in `check-liveness.mjs`.

**JSDoc/TSDoc:**
- JSDoc-style comments appear on file headers and a few non-trivial helpers, such as `normalizeTextForATS()` in `generate-pdf.mjs` and `parseTsvContent()` in `merge-tracker.mjs`.
- Small helpers usually omit docblocks if the name is self-explanatory.
- Go uses short package and type comments rather than exhaustive per-function documentation. Examples: `dashboard/internal/model/career.go` and `dashboard/internal/theme/theme.go`.

## Function Design

**Size:** Script files are often large and procedural, but they stay readable by factoring out focused helpers before the entrypoint. Good reference files are `scan.mjs`, `merge-tracker.mjs`, `followup-cadence.mjs`, and `dashboard/internal/data/career.go`.

**Parameters:**
- JavaScript helpers usually accept plain primitives or small object bags. `classifyLiveness({ status, finalUrl, bodyText, applyControls })` in `liveness-core.mjs` is the clearest reusable pattern.
- CLI scripts parse `process.argv` locally near the entrypoint instead of building a shared options library. See `scan.mjs`, `generate-pdf.mjs`, `check-liveness.mjs`, and `test-all.mjs`.
- Go constructors and update methods prefer explicit typed parameters over generic maps. Examples: `NewPipelineModel(...)` in `dashboard/internal/ui/screens/pipeline.go` and `UpdateApplicationStatus(...)` in `dashboard/internal/data/career.go`.

**Return Values:**
- JavaScript returns plain objects, arrays, sets, or `null` sentinels. Examples: `detectApi()` returns an object or `null`; `parseTsvContent()` returns a parsed object or `null`; `classifyLiveness()` returns `{ result, reason }`.
- Go uses typed returns and `error` values where mutation can fail. `LoadReportSummary(...) (archetype, tldr, remote, comp string)` and `UpdateApplicationStatus(...) error` are the main patterns.
- Scripts that are mainly side-effectful still summarize results in-process before `process.exit(...)`, rather than returning values to another library.

## Module Design

**Exports:**
- Most root `.mjs` files are single-purpose executables with no exports: `doctor.mjs`, `verify-pipeline.mjs`, `scan.mjs`, `merge-tracker.mjs`, `normalize-statuses.mjs`.
- Shared logic is extracted only when reused across scripts. The clearest example is `liveness-core.mjs`, which exports `classifyLiveness` for `check-liveness.mjs` and `test-all.mjs`.
- Go code is organized into small internal packages with explicit constructors and exported helpers: `dashboard/internal/model`, `dashboard/internal/data`, `dashboard/internal/theme`, and `dashboard/internal/ui/screens`.

**Barrel Files:** Not used. Import concrete files directly in JavaScript and concrete packages directly in Go.

**Prescriptive Guidance For New Code:**
- Put new Node quality or maintenance scripts at the repo root as standalone `.mjs` files when they operate on the main tracker and mode files.
- Extract shared pure logic into a sibling module only after a second caller appears; `liveness-core.mjs` is the existing model to follow.
- Keep dashboard additions inside the existing package boundaries under `dashboard/internal/...` and expose constructors or typed helpers instead of cross-package globals.

---

*Convention analysis: 2026-04-11*
