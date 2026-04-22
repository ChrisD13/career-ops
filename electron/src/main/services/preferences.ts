import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const ALLOWED_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5'] as const
export type AllowedModel = typeof ALLOWED_MODELS[number]

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'preferences.json')
}

async function load(): Promise<{ model: AllowedModel }> {
  const p = prefsPath()
  if (!existsSync(p)) return { model: DEFAULT_MODEL }
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const json = JSON.parse(raw)
    const model = ALLOWED_MODELS.includes(json.model) ? json.model : DEFAULT_MODEL
    return { model }
  } catch {
    return { model: DEFAULT_MODEL }
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
    const next = { ...current, model }
    await writeFileAtomic(prefsPath(), JSON.stringify(next, null, 2))
  },
  DEFAULT_MODEL,
  ALLOWED_MODELS,
}
