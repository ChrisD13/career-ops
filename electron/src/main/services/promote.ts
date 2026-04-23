import * as path from 'path'
import { existsSync, promises as fs } from 'fs'
import { lockAndWrite } from './write-queue'
import { markPromoted } from './vc-companies'

// pipeline.md line format: `- [ ] {url}` (per data contract — see data/pipeline.md analog).
// If a URL is empty, we insert the company name as a local stub: `- [ ] {company} — no careers URL`.
// Dedup: if the exact URL is already in pipeline.md, no-op (caller still flips promoted flag).

export async function promoteToPipeline(
  projectRoot: string,
  firm: string,
  company: string,
  careersUrl: string,
  pendingGuiWrites: Set<string>,
): Promise<void> {
  const pipelinePath = path.join(projectRoot, 'data', 'pipeline.md')
  // Ensure file exists
  if (!existsSync(pipelinePath)) {
    await fs.mkdir(path.dirname(pipelinePath), { recursive: true })
    await fs.writeFile(pipelinePath, '# Pipeline\n\n', 'utf-8')
  }
  const entry = careersUrl.trim()
    ? `- [ ] ${careersUrl.trim()}`
    : `- [ ] ${company} — no careers URL (VC: ${firm})`

  await lockAndWrite(pipelinePath, (current) => {
    // Dedup on URL (or full line if no URL)
    const needle = careersUrl.trim() || entry
    if (current.includes(needle)) return current
    const trimmed = current.endsWith('\n') ? current : current + '\n'
    return trimmed + entry + '\n'
  }, pendingGuiWrites)

  // After pipeline write succeeds, flip the promoted flag on the TSV row
  await markPromoted(projectRoot, firm, company, pendingGuiWrites)
}
