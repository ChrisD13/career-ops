import { promises as fs } from 'fs'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'

interface CacheEntry { mtimeMs: number; content: string }

export class MtimeCache {
  private cache = new Map<string, CacheEntry>()
  private sidecarPath: string

  constructor(projectRoot: string) {
    this.sidecarPath = path.join(projectRoot, 'data', '.mtime-cache.json')
  }

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.sidecarPath, 'utf-8')
      const json = JSON.parse(raw) as Record<string, unknown>
      for (const [p, mtimeMs] of Object.entries(json)) {
        if (typeof mtimeMs === 'number') {
          this.cache.set(p, { mtimeMs, content: '' })
        }
      }
    } catch {
      // Missing or corrupt — start fresh
    }
  }

  async read(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    const cached = this.cache.get(filePath)
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.content) {
      return cached.content
    }
    const content = await fs.readFile(filePath, 'utf-8')
    this.cache.set(filePath, { mtimeMs: stat.mtimeMs, content })
    return content
  }

  async persist(): Promise<void> {
    const snapshot: Record<string, number> = {}
    for (const [p, entry] of this.cache) snapshot[p] = entry.mtimeMs
    await writeFileAtomic(this.sidecarPath, JSON.stringify(snapshot, null, 2))
  }

  // For tests only
  _size(): number { return this.cache.size }
}
