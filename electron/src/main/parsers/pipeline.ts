import { promises as fs } from 'fs'
import { PipelineEntry } from '../../preload/types'

const LINE_RE = /^-\s+\[( |x)\]\s+(.+)/

export async function parsePipeline(filePath: string): Promise<PipelineEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const entries: PipelineEntry[] = []

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    const m = LINE_RE.exec(line)
    if (!m) continue
    const done = m[1] === 'x'
    const rest = m[2]
    const parts = rest.split(' | ').map(p => p.trim())
    entries.push({
      url: parts[0] ?? '',
      company: parts[1] ?? '',
      role: parts[2] ?? '',
      done,
    })
  }

  return entries
}
