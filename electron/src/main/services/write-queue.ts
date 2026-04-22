import lockfile from 'proper-lockfile'
import writeFileAtomic from 'write-file-atomic'
import { promises as fs } from 'fs'

function isWSL(): boolean {
  return !!process.env.WSL_DISTRO_NAME || !!process.env.WSLENV
}

export const GUI_WRITE_SUPPRESSION_MS = isWSL() ? 3000 : 1500

export async function lockAndWrite(
  filePath: string,
  transform: (currentContent: string) => string | Promise<string>,
  pendingGuiWrites?: Set<string>,
): Promise<void> {
  const release = await lockfile.lock(filePath, {
    stale: 10_000,
    retries: { retries: 5, minTimeout: 100, maxTimeout: 1000, factor: 2 },
  })
  try {
    const current = await fs.readFile(filePath, 'utf-8')
    const next = await transform(current)
    if (pendingGuiWrites) {
      pendingGuiWrites.add(filePath)
      setTimeout(() => pendingGuiWrites.delete(filePath), GUI_WRITE_SUPPRESSION_MS)
    }
    await writeFileAtomic(filePath, next)
  } finally {
    await release()
  }
}
