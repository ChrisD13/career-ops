import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import * as path from 'path'
import yaml from 'js-yaml'
import { lockAndWrite } from './write-queue'
import type { VcFirmConfig } from '../../preload/types'

function firmsPath(projectRoot: string): string {
  return path.join(projectRoot, 'config', 'vc-firms.yml')
}

export async function listFirms(projectRoot: string): Promise<VcFirmConfig[]> {
  const p = firmsPath(projectRoot)
  if (!existsSync(p)) return []
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const doc = yaml.load(raw) as { firms?: VcFirmConfig[] } | null
    const firms = Array.isArray(doc?.firms) ? doc!.firms : []
    return firms.map((f) => ({
      name: String(f.name ?? ''),
      portfolio_url: String(f.portfolio_url ?? ''),
      keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
      ...(typeof f.enabled === 'boolean' ? { enabled: f.enabled } : {}),
    })).filter((f) => f.name)
  } catch {
    return []
  }
}

// Append a firm. Uses lockAndWrite for atomic YAML rewrite under lockfile.
// Caller (ipc-handlers) is responsible for HEAD-probe + duplicate-name validation.
export async function addFirm(
  projectRoot: string,
  firm: VcFirmConfig,
  pendingGuiWrites: Set<string>,
): Promise<void> {
  const p = firmsPath(projectRoot)
  // Ensure file exists (first-run safety) — if missing, seed with empty firms list
  if (!existsSync(p)) {
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, 'firms: []\n', 'utf-8')
  }
  await lockAndWrite(p, (current) => {
    const doc = (yaml.load(current) as { firms?: VcFirmConfig[] } | null) ?? { firms: [] }
    const firms: VcFirmConfig[] = Array.isArray(doc.firms) ? doc.firms : []
    // Duplicate-name guard (case-insensitive)
    if (firms.some((f) => String(f.name ?? '').toLowerCase() === firm.name.toLowerCase())) {
      throw new Error(`Firm "${firm.name}" already exists`)
    }
    firms.push(firm)
    return yaml.dump({ firms }, { lineWidth: 120, noRefs: true })
  }, pendingGuiWrites)
}
