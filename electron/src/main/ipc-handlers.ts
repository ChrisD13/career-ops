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

const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)
const UpdateStatusSchema = z.object({
  num: z.number().int().positive(),
  newStatus: z.string().min(1).max(50),
})
const UrlSchema = z.string().url()
const ApiKeySchema = z.string().regex(/^sk-ant-/, 'Must be an Anthropic API key starting with sk-ant-')
const ModelSchema = z.enum(['claude-sonnet-4-6', 'claude-haiku-4-5'])

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
}
