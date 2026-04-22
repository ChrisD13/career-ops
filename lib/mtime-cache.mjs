// lib/mtime-cache.mjs
// REQUIREMENTS.md API-05: skip re-reads of stable context files when mtime is unchanged.
// Sidecar persistence at data/.mtime-cache.json.

import { promises as fs } from 'fs'
import { join } from 'path'

const SIDECAR_REL = 'data/.mtime-cache.json'

// Module-level singleton: { filePath -> { mtimeMs, content } }
const cache = new Map()
let sidecarPath = null

export async function initMtimeCache(projectRoot) {
  sidecarPath = join(projectRoot, SIDECAR_REL)
  try {
    const raw = await fs.readFile(sidecarPath, 'utf-8')
    const json = JSON.parse(raw)
    for (const [p, mtimeMs] of Object.entries(json)) {
      if (typeof mtimeMs === 'number') {
        cache.set(p, { mtimeMs, content: '' })
      }
    }
  } catch {
    // Missing or corrupt — start fresh.
  }
}

export async function readWithMtimeCache(filePath) {
  const stat = await fs.stat(filePath)
  const cached = cache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.content) {
    return cached.content
  }
  const content = await fs.readFile(filePath, 'utf-8')
  cache.set(filePath, { mtimeMs: stat.mtimeMs, content })
  return content
}

export async function persistMtimeCache() {
  if (!sidecarPath) throw new Error('persistMtimeCache called before initMtimeCache')
  const snapshot = {}
  for (const [p, entry] of cache) snapshot[p] = entry.mtimeMs
  const tmp = sidecarPath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2))
  await fs.rename(tmp, sidecarPath)
}

// Test-only helper (not exported for production consumers)
export function _resetCache() { cache.clear(); sidecarPath = null }
