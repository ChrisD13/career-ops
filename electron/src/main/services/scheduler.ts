// Electron-side cron scheduler for scrape-vcs.mjs.
// Uses node-cron 4.2.1; a single in-flight lock (isScrapeActive) prevents overlap
// between scheduled runs and manual triggers.

import cron, { type ScheduledTask } from 'node-cron'
import type { BrowserWindow } from 'electron'
import { startOp } from './process-runner'
import { preferences } from './preferences'

let currentTask: ScheduledTask | null = null
let scrapeActive = false

export function isScrapeActive(): boolean {
  return scrapeActive
}

// Public entry used by ipc-handlers runVcScrape and by the cron callback.
// Returns runId (spawn succeeded) or null (busy — caller should inform user).
export function triggerScrape(projectRoot: string, win: BrowserWindow): string | null {
  if (scrapeActive) return null
  scrapeActive = true
  // Release lock when this specific scrape process exits via onExit callback.
  // A 60-minute safety timer provides a hard backstop against permanent stickiness.
  const release = (): void => { scrapeActive = false }
  const safetyTimer = setTimeout(release, 60 * 60 * 1000)
  const runId = startOp({
    kind: 'scrape',
    command: 'node',
    args: ['scrape-vcs.mjs'],
    cwd: projectRoot,
    win,
    onExit: () => { clearTimeout(safetyTimer); release() },
  })
  return runId
}

export async function initScheduler(projectRoot: string, win: BrowserWindow): Promise<void> {
  const expr = await preferences.getVcScrapeInterval()
  currentTask = cron.schedule(expr, () => { triggerScrape(projectRoot, win) })
}

export async function reconfigureScheduler(projectRoot: string, win: BrowserWindow): Promise<void> {
  if (currentTask) { currentTask.stop() }
  const expr = await preferences.getVcScrapeInterval()
  currentTask = cron.schedule(expr, () => { triggerScrape(projectRoot, win) })
}

export function stopScheduler(): void {
  if (currentTask) { currentTask.stop(); currentTask = null }
  scrapeActive = false
}
