import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import * as path from 'path'
import type { VcFirmHealth } from '../../preload/types'

export async function readHealth(projectRoot: string): Promise<{ firms: VcFirmHealth[] }> {
  const p = path.join(projectRoot, 'data', 'vc-health.json')
  if (!existsSync(p)) return { firms: [] }
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const json = JSON.parse(raw) as unknown
    if (typeof json !== 'object' || json === null || !Array.isArray((json as Record<string, unknown>).firms)) {
      return { firms: [] }
    }
    const rawFirms = (json as Record<string, unknown>).firms as unknown[]
    // Validate each entry's shape; drop malformed ones
    const firms: VcFirmHealth[] = rawFirms
      .filter((f): f is Record<string, unknown> =>
        typeof f === 'object' && f !== null &&
        typeof (f as Record<string, unknown>).name === 'string' &&
        typeof (f as Record<string, unknown>).status === 'string'
      )
      .map((f) => ({
        name: String(f.name),
        last_run: String(f.last_run ?? ''),
        company_count: Number(f.company_count ?? 0),
        baseline_count: Number(f.baseline_count ?? 0),
        status: (['OK', 'Stale', 'Error'].includes(String(f.status)) ? f.status : 'Error') as VcFirmHealth['status'],
        ...(f.reason ? { reason: String(f.reason) } : {}),
      }))
    return { firms }
  } catch {
    return { firms: [] }
  }
}
