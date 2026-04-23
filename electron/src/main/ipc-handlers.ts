import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { parseApplications } from './parsers/applications'
import { parsePipeline } from './parsers/pipeline'
import { parseStatuses } from './parsers/statuses'
import { updateStatus as writeStatus } from './services/status-writer'
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
}
