import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'
import cron from 'node-cron'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_VC_INTERVAL = '0 9 1 * *'   // monthly, 1st of month at 09:00 local
const ALLOWED_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5'] as const
export type AllowedModel = typeof ALLOWED_MODELS[number]

interface Prefs { model: AllowedModel; vcScrapeInterval: string }

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'preferences.json')
}

async function load(): Promise<Prefs> {
  const p = prefsPath()
  if (!existsSync(p)) return { model: DEFAULT_MODEL, vcScrapeInterval: DEFAULT_VC_INTERVAL }
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const json = JSON.parse(raw)
    const model = ALLOWED_MODELS.includes(json.model) ? json.model : DEFAULT_MODEL
    const vcScrapeInterval =
      typeof json.vcScrapeInterval === 'string' && cron.validate(json.vcScrapeInterval)
        ? json.vcScrapeInterval
        : DEFAULT_VC_INTERVAL
    return { model, vcScrapeInterval }
  } catch {
    return { model: DEFAULT_MODEL, vcScrapeInterval: DEFAULT_VC_INTERVAL }
  }
}

export const preferences = {
  async getModel(): Promise<AllowedModel> {
    return (await load()).model
  },
  async setModel(model: string): Promise<void> {
    if (!ALLOWED_MODELS.includes(model as AllowedModel)) {
      throw new Error(`Unsupported model: ${model}`)
    }
    const current = await load()
    await writeFileAtomic(prefsPath(), JSON.stringify({ ...current, model }, null, 2))
  },
  async getVcScrapeInterval(): Promise<string> {
    return (await load()).vcScrapeInterval
  },
  async setVcScrapeInterval(expr: string): Promise<void> {
    if (!cron.validate(expr)) throw new Error('Invalid cron expression')
    const current = await load()
    await writeFileAtomic(prefsPath(), JSON.stringify({ ...current, vcScrapeInterval: expr }, null, 2))
  },
  DEFAULT_MODEL,
  DEFAULT_VC_INTERVAL,
  ALLOWED_MODELS,
}
