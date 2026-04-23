import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import * as path from 'path'
import { lockAndWrite } from './write-queue'
import type { VcCompany } from '../../preload/types'

const COLS = ['firm', 'company', 'careers_url', 'funding_signal', 'funding_date', 'role_matches', 'discovered_at', 'promoted'] as const

function parseRow(line: string): VcCompany | null {
  const parts = line.split('\t')
  if (parts.length < COLS.length) return null
  const row: Record<string, string> = {}
  COLS.forEach((c, i) => { row[c] = parts[i] ?? '' })
  return {
    firm: row.firm,
    company: row.company,
    careers_url: row.careers_url,
    funding_signal: row.funding_signal,
    funding_date: row.funding_date,
    role_matches: row.role_matches,
    discovered_at: row.discovered_at,
    promoted: row.promoted === 'true',
  }
}

export async function readCompanies(projectRoot: string): Promise<VcCompany[]> {
  const tsvPath = path.join(projectRoot, 'data', 'vc-companies.tsv')
  if (!existsSync(tsvPath)) return []
  const raw = await fs.readFile(tsvPath, 'utf-8')
  const lines = raw.split('\n').filter(Boolean)
  if (lines.length < 2) return []
  return lines.slice(1).map(parseRow).filter((r): r is VcCompany => r !== null)
}

// Flip the `promoted` column to 'true' for one (firm, company) pair, atomically.
// Uses lockAndWrite from write-queue.ts so the file watcher doesn't surface this write.
export async function markPromoted(
  projectRoot: string,
  firm: string,
  company: string,
  pendingGuiWrites: Set<string>,
): Promise<void> {
  const tsvPath = path.join(projectRoot, 'data', 'vc-companies.tsv')
  if (!existsSync(tsvPath)) return
  await lockAndWrite(tsvPath, (current) => {
    const lines = current.split('\n')
    if (lines.length < 2) return current
    const promotedIdx = COLS.indexOf('promoted')
    const firmIdx = COLS.indexOf('firm')
    const companyIdx = COLS.indexOf('company')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue
      const parts = lines[i].split('\t')
      if (parts[firmIdx] === firm && parts[companyIdx] === company) {
        parts[promotedIdx] = 'true'
        lines[i] = parts.join('\t')
      }
    }
    return lines.join('\n')
  }, pendingGuiWrites)
}

export const COLS_ARRAY = COLS
