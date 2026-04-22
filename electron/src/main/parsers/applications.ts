import { promises as fs } from 'fs'
import { TrackerRow } from '../../preload/types'

const SCORE_RE = /(\d+\.?\d*)\/5/
const REPORT_LINK_RE = /\[(\d+)\]\(([^)]+)\)/
const BOLD_RE = /\*\*/g
const TRAILING_DATE_RE = /\s+\d{4}-\d{2}-\d{2}.*$/

export async function parseApplications(filePath: string): Promise<TrackerRow[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const rows: TrackerRow[] = []
  let num = 0

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('# ')) continue
    if (line.startsWith('|---')) continue
    if (line.startsWith('| #')) continue
    if (!line.startsWith('|')) continue

    let fields: string[]
    if (line.includes('\t')) {
      const stripped = line.replace(/^\|/, '').trim()
      fields = stripped.split('\t').map(f => f.replace(/\|/g, '').trim())
    } else {
      fields = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(f => f.trim())
    }
    if (fields.length < 8) continue
    num++

    const scoreRaw = fields[4] ?? ''
    const scoreMatch = SCORE_RE.exec(scoreRaw)
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null

    const statusRaw = fields[5] ?? ''
    const status = statusRaw.replace(BOLD_RE, '').trim().replace(TRAILING_DATE_RE, '').trim()

    const reportRaw = fields[7] ?? ''
    const reportMatch = REPORT_LINK_RE.exec(reportRaw)
    const reportLink = reportMatch ? reportMatch[1] : ''
    const reportPath = reportMatch ? reportMatch[2] : ''

    rows.push({
      num,
      date: fields[1] ?? '',
      company: fields[2] ?? '',
      role: fields[3] ?? '',
      scoreRaw,
      score,
      status,
      hasPDF: fields[6].includes('✅'),
      reportLink,
      reportPath,
      notes: fields[8] ?? '',
    })
  }

  return rows
}
