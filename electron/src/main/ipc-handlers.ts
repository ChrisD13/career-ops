import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { existsSync } from 'fs'
import { parseApplications } from './parsers/applications'
import { parsePipeline } from './parsers/pipeline'
import { parseStatuses } from './parsers/statuses'
import { updateStatus as writeStatus } from './services/status-writer'
import { lockAndWrite } from './services/write-queue'
import type { MtimeCache } from './services/mtime-cache'
import { keyStore } from './services/key-store'
import { preferences } from './services/preferences'
import { streamEvaluation, verifyApiKey, cancelActiveEvaluation } from './services/evaluation-service'
import { startOp } from './services/process-runner'
import { readCompanies } from './services/vc-companies'
import { readHealth } from './services/vc-health'
import { listFirms, addFirm } from './services/vc-firms'
import { promoteToPipeline } from './services/promote'
import { probeUrl } from './services/url-probe'
import { triggerScrape, reconfigureScheduler } from './services/scheduler'
import { installUpdate, setDismissedVersion } from './services/updater'
import { extractPdfText, MAX_FILE_BYTES } from './services/pdf-extract'

const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)
const UpdateStatusSchema = z.object({
  num: z.number().int().positive(),
  newStatus: z.string().min(1).max(50),
})
const UrlSchema = z.string().url()
const ApiKeySchema = z.string().regex(/^sk-ant-/, 'Must be an Anthropic API key starting with sk-ant-')
const ModelSchema = z.enum(['claude-sonnet-4-6', 'claude-haiku-4-5'])
const PromoteSchema = z.object({
  firm: z.string().min(1).max(100),
  company: z.string().min(1).max(200),
  careersUrl: z.string().max(2048).optional().default(''),
})
const VcFirmSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[A-Za-z0-9 .&\-']+$/, 'invalid firm name characters'),
  portfolio_url: z.string().url(),
  keywords: z.array(z.string().max(100)).max(50).optional().default([]),
  bypassProbe: z.boolean().optional().default(false),
})
const CronSchema = z.string().min(9).max(100)
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/)
// Phase 8 — Markdown payload size cap (RESEARCH §A4 — 2 MB)
const UpdateCvSchema = z.string().min(1).max(2_000_000)

export interface HandlerDeps {
  projectRoot: string
  pendingGuiWrites: Set<string>
  mtimeCache: MtimeCache
  win: BrowserWindow
}

export function registerIpcHandlers(deps: HandlerDeps): void {
  const { projectRoot, pendingGuiWrites, mtimeCache, win } = deps
  const applicationsPath = path.join(projectRoot, 'data', 'applications.md')

  // ---------- Phase 1 (preserved) ----------
  ipcMain.handle('readTracker', async () => parseApplications(applicationsPath))
  ipcMain.handle('readPipeline', async () => parsePipeline(path.join(projectRoot, 'data', 'pipeline.md')))
  ipcMain.handle('readReport', async (_e, rawPath: unknown) => {
    const reportPath = ReportPathSchema.parse(rawPath)
    return fs.readFile(path.join(projectRoot, reportPath), 'utf-8')
  })
  ipcMain.handle('readStatuses', async () => parseStatuses(path.join(projectRoot, 'templates', 'states.yml')))
  ipcMain.handle('listReports', async () => {
    const dir = path.join(projectRoot, 'reports')
    const files = await fs.readdir(dir)
    return files.filter((f) => f.endsWith('.md')).sort().reverse()
  })

  // ---------- Write safety ----------
  ipcMain.handle('updateStatus', async (_e, raw: unknown) => {
    const { num, newStatus } = UpdateStatusSchema.parse(raw)
    return writeStatus(applicationsPath, num, newStatus, pendingGuiWrites)
  })

  // ---------- API key ----------
  ipcMain.handle('checkApiKey', async () => ({
    hasKey: await keyStore.hasKey(),
    backendWarning: keyStore.backendWarning() ?? undefined,
  }))
  ipcMain.handle('saveApiKey', async (_e, rawKey: unknown) => {
    try {
      const key = ApiKeySchema.parse(rawKey)
      await keyStore.save(key)
      return { success: true, warning: keyStore.backendWarning() ?? undefined }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to save key' }
    }
  })
  ipcMain.handle('verifyApiKey', async (_e, rawKey: unknown) => {
    try {
      const key = ApiKeySchema.parse(rawKey)
      return await verifyApiKey(key)
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Invalid key format' }
    }
  })

  // ---------- Preferences ----------
  ipcMain.handle('getModel', async () => ({ model: await preferences.getModel() }))
  ipcMain.handle('setModel', async (_e, raw: unknown) => {
    const model = ModelSchema.parse(raw)
    await preferences.setModel(model)
  })

  // ---------- Evaluation ----------
  ipcMain.handle('evaluateUrl', async (_e, raw: unknown) => {
    const url = UrlSchema.parse(raw)
    const apiKey = await keyStore.get()
    if (!apiKey) return { error: 'no-api-key' }
    const model = await preferences.getModel()
    return streamEvaluation({ url, apiKey, model, projectRoot, mtimeCache, win })
  })
  ipcMain.handle('cancelEvaluation', async () => {
    cancelActiveEvaluation()
  })

  // ---------- CV + operations ----------
  ipcMain.handle('readCv', async () => fs.readFile(path.join(projectRoot, 'cv.md'), 'utf-8'))
  // ---------- Phase 8 — CV upload ----------
  ipcMain.handle('openCvFilePicker', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select CV file',
      properties: ['openFile'],
      filters: [{ name: 'CV', extensions: ['md', 'pdf'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true }
    }
    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase()
    try {
      if (ext === '.md') {
        const stat = await fs.stat(filePath)
        if (stat.size > MAX_FILE_BYTES) {
          return {
            cancelled: false,
            error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 10 MB)`,
          }
        }
        const content = await fs.readFile(filePath, 'utf-8')
        return { cancelled: false, type: 'md' as const, content }
      }
      if (ext === '.pdf') {
        const result = await extractPdfText(filePath)
        if (!result.ok) {
          return { cancelled: false, error: result.error }
        }
        return { cancelled: false, type: 'pdf' as const, content: result.text }
      }
      return { cancelled: false, error: 'Unsupported file type. Choose a .md or .pdf file.' }
    } catch (err: any) {
      return { cancelled: false, error: err?.message ?? 'Could not read file. Check it exists and try again.' }
    }
  })

  ipcMain.handle('updateCv', async (_e, raw: unknown) => {
    try {
      const content = UpdateCvSchema.parse(raw)
      const cvPath = path.join(projectRoot, 'cv.md')
      // Pitfall §3: seed empty cv.md if missing, then lockAndWrite
      if (!existsSync(cvPath)) {
        await fs.writeFile(cvPath, '', 'utf-8')
      }
      await lockAndWrite(cvPath, () => content, pendingGuiWrites)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to write cv.md' }
    }
  })

  ipcMain.handle('getCvMtime', async () => {
    const cvPath = path.join(projectRoot, 'cv.md')
    try {
      const stat = await fs.stat(cvPath)
      return { mtimeIso: stat.mtime.toISOString() }
    } catch {
      return { mtimeIso: null }
    }
  })

  ipcMain.handle('regeneratePDF', async () => {
    const runId = startOp({
      kind: 'pdf',
      command: 'node',
      args: ['generate-pdf.mjs'],
      cwd: projectRoot,
      win,
    })
    return { runId }
  })

  ipcMain.handle('runScan', async () => {
    const runId = startOp({
      kind: 'scan',
      command: 'node',
      args: ['scan.mjs'],
      cwd: projectRoot,
      win,
    })
    return { runId }
  })

  ipcMain.handle('runBatch', async () => {
    // Inject the GUI-stored API key into batch env (Open Q4 resolution).
    // batch-runner.sh uses ANTHROPIC_API_KEY; CLI users continue to use their shell env.
    const apiKey = await keyStore.get()
    if (!apiKey) return { runId: '', error: 'no-api-key' }
    const runId = startOp({
      kind: 'batch',
      command: 'bash',
      args: ['batch/batch-runner.sh'],
      cwd: projectRoot,
      win,
      envOverrides: { ANTHROPIC_API_KEY: apiKey },
    })
    return { runId }
  })

  // ---------- Pipeline tools ----------
  ipcMain.handle('runMergeTracker', async () => {
    const runId = startOp({ kind: 'merge-tracker', command: 'node', args: ['merge-tracker.mjs'], cwd: projectRoot, win })
    return { runId }
  })

  ipcMain.handle('runCheckLiveness', async () => {
    const runId = startOp({ kind: 'check-liveness', command: 'node', args: ['check-liveness.mjs'], cwd: projectRoot, win })
    return { runId }
  })

  ipcMain.handle('runAnalyzePatterns', async () => {
    const runId = startOp({ kind: 'patterns', command: 'node', args: ['analyze-patterns.mjs', '--summary'], cwd: projectRoot, win })
    return { runId }
  })

  ipcMain.handle('runFollowupCadence', async () => {
    const runId = startOp({ kind: 'followup', command: 'node', args: ['followup-cadence.mjs', '--summary'], cwd: projectRoot, win })
    return { runId }
  })

  ipcMain.handle('runGenerateLatex', async () => {
    const runId = startOp({ kind: 'latex', command: 'node', args: ['generate-latex.mjs'], cwd: projectRoot, win })
    return { runId }
  })

  // ---------- Phase 3: VC Portfolio Discovery ----------
  ipcMain.handle('runVcScrape', async () => {
    const runId = triggerScrape(projectRoot, win)
    if (!runId) return { runId: '', error: 'scrape already in progress' }
    return { runId }
  })

  ipcMain.handle('readVcCompanies', async () => readCompanies(projectRoot))

  ipcMain.handle('readVcHealth', async () => readHealth(projectRoot))

  ipcMain.handle('promoteToPipeline', async (_e, raw: unknown) => {
    try {
      const { firm, company, careersUrl } = PromoteSchema.parse(raw)
      await promoteToPipeline(projectRoot, firm, company, careersUrl, pendingGuiWrites)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'promote failed' }
    }
  })

  ipcMain.handle('listVcFirms', async () => listFirms(projectRoot))

  ipcMain.handle('addVcFirm', async (_e, raw: unknown) => {
    let parsed: z.infer<typeof VcFirmSchema>
    try {
      parsed = VcFirmSchema.parse(raw)
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'invalid firm payload' }
    }

    // HEAD probe unless user bypassed it ("Save anyway")
    if (!parsed.bypassProbe) {
      const probe = await probeUrl(parsed.portfolio_url)
      if (!probe.ok) {
        return {
          success: false,
          kind: 'probe' as const,
          probeStatus: probe.status,
          error: probe.error ?? `URL unreachable (${probe.status ?? 'no response'})`,
        }
      }
    }

    try {
      await addFirm(
        projectRoot,
        {
          name: parsed.name,
          portfolio_url: parsed.portfolio_url,
          keywords: parsed.keywords,
        },
        pendingGuiWrites,
      )
      return {
        success: true,
        warning: parsed.bypassProbe ? 'Saved without URL verification' : undefined,
      }
    } catch (err: any) {
      return { success: false, kind: 'save' as const, error: err?.message ?? 'save failed' }
    }
  })

  ipcMain.handle('getVcScrapeInterval', async () => ({ interval: await preferences.getVcScrapeInterval() }))

  ipcMain.handle('setVcScrapeInterval', async (_e, raw: unknown) => {
    const expr = CronSchema.parse(raw)
    await preferences.setVcScrapeInterval(expr)   // throws if cron.validate fails
    await reconfigureScheduler(projectRoot, win)
  })

  // Phase 5 — auto-update
  ipcMain.handle('updater:install', async () => {
    installUpdate()
  })

  ipcMain.handle('updater:dismiss', async (_e, raw: unknown) => {
    try {
      const version = VersionSchema.parse(raw)
      await setDismissedVersion(version)
    } catch (err: any) {
      console.warn('[updater] dismiss failed:', err?.message)
      // non-fatal — dismiss is best-effort
    }
  })
}
