import lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'
import { promises as fs } from 'fs'
import { GUI_WRITE_SUPPRESSION_MS } from './write-queue'

export type StatusUpdateError = 'lock-timeout' | 'not-found' | 'parse-error' | 'fs-error'

export interface StatusUpdateResult {
  success: boolean
  error?: StatusUpdateError
  message?: string
}

export async function updateStatus(
  filePath: string,
  reportNumber: number,
  newStatus: string,
  pendingGuiWrites: Set<string>,
): Promise<StatusUpdateResult> {
  let release: (() => Promise<void>) | null = null
  try {
    release = await lockfile.lock(filePath, {
      stale: 10_000,
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000, factor: 2 },
    })
  } catch (err: any) {
    return { success: false, error: 'lock-timeout', message: err?.message ?? 'Lock acquisition timed out' }
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const marker = `[${reportNumber}]`
    let found = false
    let parseError = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.startsWith('|')) continue
      if (line.includes('---')) continue
      if (!line.includes(marker)) continue

      const parts = line.split('|').map((s) => s.trim())
      // Expected: 11 parts (empty bookends + 9 columns)
      // [0]=''  [1]=num  [2]=date  [3]=company  [4]=role  [5]=score  [6]=STATUS  [7]=pdf  [8]=report  [9]=notes  [10]=''
      if (parts.length < 10) {
        parseError = true
        break
      }
      parts[6] = newStatus
      lines[i] = '| ' + parts.slice(1, -1).join(' | ') + ' |'
      found = true
      break
    }

    if (parseError) {
      return { success: false, error: 'parse-error', message: `Row with ${marker} is malformed` }
    }
    if (!found) {
      return { success: false, error: 'not-found', message: `No row with report ${marker}` }
    }

    pendingGuiWrites.add(filePath)
    setTimeout(() => pendingGuiWrites.delete(filePath), GUI_WRITE_SUPPRESSION_MS)
    await writeFileAtomic(filePath, lines.join('\n'))
    return { success: true }
  } catch (err: any) {
    return { success: false, error: 'fs-error', message: err?.message ?? 'File system error' }
  } finally {
    if (release) await release()
  }
}
