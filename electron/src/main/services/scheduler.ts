// Electron-side cron scheduler for scrape-vcs.mjs.
// Uses node-cron 4.2.1; a single in-flight lock (isScrapeActive) prevents overlap
// between scheduled runs and manual triggers.

import cron, { type ScheduledTask } from 'node-cron'
import type { BrowserWindow } from 'electron'
import { startOp, activeOpsCount } from './process-runner'
import { preferences } from './preferences'

let currentTask: ScheduledTask | null = null
let scrapeActive = false
let pollInterval: ReturnType<typeof setInterval> | null = null

export function isScrapeActive(): boolean {
  return scrapeActive
}

// Map of runId -> release function. Wired up by the polling loop in initScheduler.
const pendingReleases = new Map<string, () => void>()

// Public entry used by ipc-handlers runVcScrape and by the cron callback.
// Returns runId (spawn succeeded) or null (busy — caller should inform user).
export function triggerScrape(projectRoot: string, win: BrowserWindow): string | null {
  if (scrapeActive) return null
  scrapeActive = true
  const runId = startOp({
    kind: 'scrape',
    command: 'node',
    args: ['scrape-vcs.mjs'],
    cwd: projectRoot,
    win,
  })
  // Release lock when process-runner's activeOpsCount drops to zero.
  // A 60-minute safety timer provides a hard backstop against permanent stickiness.
  const release = (): void => { scrapeActive = false }
  const safetyTimer = setTimeout(release, 60 * 60 * 1000)
  pendingReleases.set(runId, () => { clearTimeout(safetyTimer); release() })
  return runId
}

export async function initScheduler(projectRoot: string, win: BrowserWindow): Promise<void> {
  // Poll activeOpsCount every 2s; release scrapeActive when all ops finish.
  // Use unref() so the timer doesn't block Electron's clean shutdown.
  pollInterval = setInterval(() => {
    if (pendingReleases.size === 0) return
    if (activeOpsCount() === 0) {
      for (const releaseFn of pendingReleases.values()) releaseFn()
      pendingReleases.clear()
    }
  }, 2000)
  pollInterval.unref()

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
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  pendingReleases.clear()
  scrapeActive = false
}
