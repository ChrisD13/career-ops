# Changelog

## [1.6.0](https://github.com/ChrisD13/career-ops/compare/v1.5.0...v1.6.0) (2026-04-23)


### Features

* **01-02:** chokidar v5 file watcher with 300ms debounce and WSL polling fallback ([b9882d4](https://github.com/ChrisD13/career-ops/commit/b9882d42485351e712f02d5fac1ac276057b3cf9))
* **01-02:** Electron main entry — ELEC-01 security baseline + CSP header + IPC/watcher wiring ([77626c6](https://github.com/ChrisD13/career-ops/commit/77626c6ceae35752d1a2c34ed14690e0596c7acf))
* **01-02:** IPC handlers with Zod path validation + preload contextBridge (6 methods) ([7e7ebf2](https://github.com/ChrisD13/career-ops/commit/7e7ebf2ba1048714cf89af8596839c9e8aa0c079))
* **01-02:** shared types + main-process parsers (applications, pipeline, statuses) ([db31e1f](https://github.com/ChrisD13/career-ops/commit/db31e1fd5e4ca13a91d7ae1deb2f263146a58bfa))
* **01-03:** add AppShell — Sidebar, React root, App wiring ([55ac598](https://github.com/ChrisD13/career-ops/commit/55ac5986b10aabb47b2e460fdb24ac3a99e6132d))
* **01-03:** add shared presentational components ([8647af5](https://github.com/ChrisD13/career-ops/commit/8647af5ff3d09ea056fc5c4303affb85d95c6787))
* **01-04:** TrackerPanel virtualized list + SplitPaneLayout ([73b707f](https://github.com/ChrisD13/career-ops/commit/73b707f584358f2d037d191d8f6dd0fbaa29e94f))
* **01-04:** TrackerRow + StatusSelect presentational components ([98f2668](https://github.com/ChrisD13/career-ops/commit/98f26682e7ad7633add1e6e0df12cd33dffa96cd))
* **01-04:** wire TrackerPanel + SplitPaneLayout into App.tsx ([c1a04e6](https://github.com/ChrisD13/career-ops/commit/c1a04e6010a81f8d3783b59b27bb759313a90b26))
* **01-05:** ReportsPanel and PipelinePanel with IPC data loading ([1e37be4](https://github.com/ChrisD13/career-ops/commit/1e37be4649310c63d4dbc1ce3aabc6267b9f4b73))
* **01-05:** ReportViewer with react-markdown, remark-gfm, rehype-sanitize ([3741067](https://github.com/ChrisD13/career-ops/commit/3741067615a796d82285f1cadd741188c639a154))
* **01-05:** wire ReportViewer, ReportsPanel, PipelinePanel into App.tsx ([6251d11](https://github.com/ChrisD13/career-ops/commit/6251d11cc67af82015f925197ac532130d39a6aa))
* **02-01:** add proper-lockfile to merge-tracker.mjs + install write-safety packages ([7d4c1a0](https://github.com/ChrisD13/career-ops/commit/7d4c1a082a6f3e3772c97d096f56e4e6986e6126))
* **02-01:** create mtime-cache in lib/ and electron/services/, gitignore sidecar ([2a9dd8c](https://github.com/ChrisD13/career-ops/commit/2a9dd8ceeca25d82d052dd5cc64d81e5441ecb2e))
* **02-01:** create write-queue + status-writer services, extend watcher with pendingGuiWrites ([c57e947](https://github.com/ChrisD13/career-ops/commit/c57e9478e609108c1cdc054008fccffcfc9d3653))
* **02-02:** create key-store, evaluation-service, process-runner, preferences services ([12da055](https://github.com/ChrisD13/career-ops/commit/12da055bb0ab0dcb26dd4e818648acaed3ad2abe))
* **02-02:** extend preload types+bridge and ipc-handlers with 12 new channels ([d2e906f](https://github.com/ChrisD13/career-ops/commit/d2e906f30dc37f24bdf3da7e1ce4af3398af97af))
* **02-02:** wire pendingGuiWrites + MtimeCache into main/index.ts ([357877e](https://github.com/ChrisD13/career-ops/commit/357877ef968ffa9e3c50a2e7ea87995210816f80))
* **02-03:** build settings slide-over with API key field, model select, verify button ([b1ddfab](https://github.com/ChrisD13/career-ops/commit/b1ddfab76d324a53efa36b1bddeb76cccc401eff))
* **02-03:** create streaming report view, token stats row, inline error banner + CSS ([062b992](https://github.com/ChrisD13/career-ops/commit/062b992cc9f319e3ef80e3fc634d49daf98eb727))
* **02-03:** create useEvaluationStream hook and EvaluatePanel assembly ([2dc4286](https://github.com/ChrisD13/career-ops/commit/2dc42862b6049de6afe18e1f84b7f1be06530507))
* **02-04:** extend TrackerRow with per-row edit state; refactor TrackerPanel coordinator ([e5607ee](https://github.com/ChrisD13/career-ops/commit/e5607eefe0af5027d817a04460829636044a1743))
* **02-04:** rewrite StatusSelect for per-row inline editing + add StatusUpdateToast ([bfefa2e](https://github.com/ChrisD13/career-ops/commit/bfefa2e0e3403622554eb37c144f8ee5fa9a1618))
* **02-05:** add CvPanel with Regenerate PDF action and PdfToast primitive ([e7c75a7](https://github.com/ChrisD13/career-ops/commit/e7c75a79573a918920b7d0a3508fd41c9286a0c8))
* **02-05:** add OperationsLogDrawer, useOperationsLog hook, DrawerTab, OpBadge ([ae62f8a](https://github.com/ChrisD13/career-ops/commit/ae62f8afb80fb3832ab4002324aa36d3f4a0423d))
* **02-05:** wire 5-panel Sidebar + GearIcon + Settings + Ops drawer + PipelinePanel actions into App.tsx ([04d2275](https://github.com/ChrisD13/career-ops/commit/04d2275f9473a50c7eac2023b9b3403616377b7b))
* **02-06:** add phase-02 automated verification runner ([0816b40](https://github.com/ChrisD13/career-ops/commit/0816b40072c89e08a028e3ccc7e582835c2e5258))
* **03-01:** add scrape-vcs.mjs CLI orchestrator with dry-run and --firm flags ([efbcb7a](https://github.com/ChrisD13/career-ops/commit/efbcb7af702df652f82c128970bb79424327756a))
* **03-01:** add scraper deps, vc-firms config, and library modules ([ad20f98](https://github.com/ChrisD13/career-ops/commit/ad20f98c976734ac41c4f28446e1ccf9646e70ac))
* **03-01:** implement 10 per-firm Playwright adapters and adapter registry ([508ec9a](https://github.com/ChrisD13/career-ops/commit/508ec9ace66fb320eecad6253f9f58c4f71d7125))
* **03-02:** add 6 main-process services for VC discovery ([32f7e0b](https://github.com/ChrisD13/career-ops/commit/32f7e0b58049d48f518b1dad5077c980e2e2e823))
* **03-02:** extend preload types, bridge, preferences, watcher, OpKind for VC scrape ([a0968d1](https://github.com/ChrisD13/career-ops/commit/a0968d14d14c352c8ddc2db9a8259b50055ca9e4))
* **03-02:** wire 8 VC IPC handlers + bootstrap scheduler in app lifecycle ([c45314c](https://github.com/ChrisD13/career-ops/commit/c45314ca8653ff6d7dbdb92bc8381938e36fb5d0))
* **03-03:** add Discover panel primitives — badges, health panel, filter toggle, drop alert ([aca84e0](https://github.com/ChrisD13/career-ops/commit/aca84e07790a18293ff97a1959e389488cdfedd7))
* **03-03:** build virtualized CompanyTable + CompanyRow + DiscoverPanel ([2b924d4](https://github.com/ChrisD13/career-ops/commit/2b924d4374803fa38c1084137f4aa319c61cc923))
* **03-03:** wire Discover panel end-to-end — Add Firm modal, Settings VC section, Sidebar + App integration ([fb4df3a](https://github.com/ChrisD13/career-ops/commit/fb4df3adefbaf303edbc48f355d2bcb4df70aabf))
* add Gemini CLI native integration and evaluator script  ([#349](https://github.com/ChrisD13/career-ops/issues/349)) ([0853486](https://github.com/ChrisD13/career-ops/commit/0853486d2c01a35adafea2cc6b6d8c429b843588))
* add Gemini CLI native integration and evaluator script (closes [#344](https://github.com/ChrisD13/career-ops/issues/344)) ([0853486](https://github.com/ChrisD13/career-ops/commit/0853486d2c01a35adafea2cc6b6d8c429b843588))
* add LaTeX/Overleaf CV export mode with pdflatex compilation ([#362](https://github.com/ChrisD13/career-ops/issues/362)) ([b824953](https://github.com/ChrisD13/career-ops/commit/b824953d0e3b7f8c6105dfcce7e17257c95ce6cd))
* add LaTeX/Overleaf CV export mode with pdflatex compilation (closes [#47](https://github.com/ChrisD13/career-ops/issues/47)) ([b824953](https://github.com/ChrisD13/career-ops/commit/b824953d0e3b7f8c6105dfcce7e17257c95ce6cd))
* **electron:** add GUI buttons for day-to-day CLI scripts + auto-install root deps ([34a3cdf](https://github.com/ChrisD13/career-ops/commit/34a3cdfb8c45debd9cd429cf513ecf86b75ea34f))


### Bug Fixes

* **01:** resolve UI-SPEC typography blocking issues ([a48bdf0](https://github.com/ChrisD13/career-ops/commit/a48bdf0c1dedcb13d066f846b85d4152245116da))
* **03:** WR-01 release scrapeActive lock per-runId via onExit callback instead of polling global op count ([ed8dd00](https://github.com/ChrisD13/career-ops/commit/ed8dd007afaa9c34f04d04b8ce254be9144e5c09))
* **03:** WR-02 add 172.16.0.0/12 RFC1918 range to SSRF guard ([d9bbe5a](https://github.com/ChrisD13/career-ops/commit/d9bbe5af341ddb109c018aaa0d9fcb8af2270e37))
* **03:** WR-03 use tab separator in TSV dedup key to prevent collisions on names with spaces ([a2b8229](https://github.com/ChrisD13/career-ops/commit/a2b822939609f3453999553939f6480b4d0dc16f))
* **03:** WR-04 add key prop to custom cron input to force remount when interval changes ([a890fc9](https://github.com/ChrisD13/career-ops/commit/a890fc9d7fae2715d591c0d5dcbd7827ad6da1f2))
* **03:** WR-05 replace fragile substring probe-failure detection with explicit kind discriminator ([e0db080](https://github.com/ChrisD13/career-ops/commit/e0db08030a12538ed9b6fef443138ca8610e9286))
* **ci:** gracefully handle missing dependency graph in dependency-review ([#343](https://github.com/ChrisD13/career-ops/issues/343)) ([7c5fecb](https://github.com/ChrisD13/career-ops/commit/7c5fecb00d60521f77b33724eb345a28257d8832))
* **ci:** gracefully handle missing dependency graph in dependency-review workflow ([#352](https://github.com/ChrisD13/career-ops/issues/352)) ([7c5fecb](https://github.com/ChrisD13/career-ops/commit/7c5fecb00d60521f77b33724eb345a28257d8832))
* **electron:** force CJS .js output so electron-vite dev can find entry file ([b8d820a](https://github.com/ChrisD13/career-ops/commit/b8d820a22e9435de41d035523b2022423a19965e))
* **pt:** restore diacritical marks in PT-BR modes ([#358](https://github.com/ChrisD13/career-ops/issues/358)) ([3a4c596](https://github.com/ChrisD13/career-ops/commit/3a4c596cb0a522f562ba38b35c210facaf38a503))
* **pt:** restore diacritical marks in PT-BR modes ([#359](https://github.com/ChrisD13/career-ops/issues/359)) ([3a4c596](https://github.com/ChrisD13/career-ops/commit/3a4c596cb0a522f562ba38b35c210facaf38a503))
* **scan:** exit 0 when portals.yml missing instead of crashing ([630cd49](https://github.com/ChrisD13/career-ops/commit/630cd49ca44a7e41ae8a875756b85e8fa551fe56))

## [1.5.0](https://github.com/santifer/career-ops/compare/v1.4.0...v1.5.0) (2026-04-14)


### Features

* add --min-score flag to batch runner ([#249](https://github.com/santifer/career-ops/issues/249)) ([cb0c7f7](https://github.com/santifer/career-ops/commit/cb0c7f7d7d3b9f3f1c3dc75ccac0a08d2737c01e))
* add {{PHONE}} placeholder to CV template ([#287](https://github.com/santifer/career-ops/issues/287)) ([e71595f](https://github.com/santifer/career-ops/commit/e71595f8ba134971ecf1cc3c3420d9caf21eed43))
* **dashboard:** add manual refresh shortcut ([#246](https://github.com/santifer/career-ops/issues/246)) ([4b5093a](https://github.com/santifer/career-ops/commit/4b5093a8ef1733c449ec0821f722f996625fcb84))


### Bug Fixes

* add stopword filtering and overlap ratio to roleMatch ([#248](https://github.com/santifer/career-ops/issues/248)) ([4da772d](https://github.com/santifer/career-ops/commit/4da772d3a4996bc9ecbe2d384d1e9d2ed75b9819))
* **dashboard:** show dates in pipeline list ([#298](https://github.com/santifer/career-ops/issues/298)) ([e5e2a6c](https://github.com/santifer/career-ops/commit/e5e2a6cffe9a5b9f3cec862df25410d02ecc9aa4))
* ensure data/ and output/ dirs exist before writing in scripts ([#261](https://github.com/santifer/career-ops/issues/261)) ([4b834f6](https://github.com/santifer/career-ops/commit/4b834f6f7f8f1b647a6bf76e43b017dcbe9cd52f))
* remove wellfound, lever and remotefront from portals.example.yml ([#286](https://github.com/santifer/career-ops/issues/286)) ([ecd013c](https://github.com/santifer/career-ops/commit/ecd013cc6f59e3a1a8ef77d34e7abc15e8075ed3))

## [1.4.0](https://github.com/santifer/career-ops/compare/v1.3.0...v1.4.0) (2026-04-13)


### Features

* add GitHub Actions CI + auto-labeler + welcome bot + /run skill ([2ddf22a](https://github.com/santifer/career-ops/commit/2ddf22a6a2731b38bcaed5786c4855c4ab9fe722))
* **dashboard:** add Catppuccin Latte light theme with auto-detection ([ff686c8](https://github.com/santifer/career-ops/commit/ff686c8af97a7bf93565fe8eeac677f998cc9ece))
* **dashboard:** add progress analytics screen ([623c837](https://github.com/santifer/career-ops/commit/623c837bf3155fd5b7413554240071d40585dd7e))
* **dashboard:** add vim motions to pipeline screen ([#262](https://github.com/santifer/career-ops/issues/262)) ([d149e54](https://github.com/santifer/career-ops/commit/d149e541402db0c88161a71c73899cd1836a1b2d))
* **dashboard:** aligned tables and markdown syntax rendering in viewer ([dbd1d3f](https://github.com/santifer/career-ops/commit/dbd1d3f7177358d0384d6e661d1b0dfc1f60bd4e))


### Bug Fixes

* **ci:** use pull_request_target for labeler on fork PRs ([#260](https://github.com/santifer/career-ops/issues/260)) ([2ecf572](https://github.com/santifer/career-ops/commit/2ecf57206c2eb6e35e2a843d6b8365f7a04c53d6))
* correct _shared.md → _profile.md reference in CUSTOMIZATION.md (closes [#137](https://github.com/santifer/career-ops/issues/137)) ([a91e264](https://github.com/santifer/career-ops/commit/a91e264b6ea047a76d8c033aa564fe01b8f9c1d9))
* replace grep -P with POSIX-compatible grep in batch-runner.sh ([637b39e](https://github.com/santifer/career-ops/commit/637b39e383d1174c8287f42e9534e9e3cdfabb19))
* test-all.mjs scans only git-tracked files, avoids false positives ([47c9f98](https://github.com/santifer/career-ops/commit/47c9f984d8ddc70974f15c99b081667b73f1bb9a))
* use execFileSync to prevent shell injection in test-all.mjs ([c99d5a6](https://github.com/santifer/career-ops/commit/c99d5a6526f923b56c3790b79b0349f402fa00e2))
