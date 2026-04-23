import { spawn, type ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import * as readline from 'readline'

export type OpKind = 'scan' | 'batch' | 'pdf' | 'scrape'

interface OpRun {
  kind: OpKind
  runId: string
  child: ChildProcess
}

const activeOps = new Map<string, OpRun>()

export interface StartOpOpts {
  kind: OpKind
  command: string
  args: string[]
  cwd: string
  win: BrowserWindow
  envOverrides?: Record<string, string>
}

export function startOp(opts: StartOpOpts): string {
  const runId = `${opts.kind}-${Date.now()}`
  const env = { ...process.env, ...(opts.envOverrides ?? {}) }

  const child = spawn(opts.command, opts.args, {
    cwd: opts.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      if (!opts.win.isDestroyed()) {
        opts.win.webContents.send('op:output', {
          runId, kind: opts.kind, stream: 'stdout', line, ts: Date.now(),
        })
      }
    })
  }
  if (child.stderr) {
    const rl = readline.createInterface({ input: child.stderr })
    rl.on('line', (line) => {
      if (!opts.win.isDestroyed()) {
        opts.win.webContents.send('op:output', {
          runId, kind: opts.kind, stream: 'stderr', line, ts: Date.now(),
        })
      }
    })
  }

  child.on('exit', (code, signal) => {
    activeOps.delete(runId)
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:done', { runId, kind: opts.kind, code, signal })
    }
  })

  child.on('error', (err) => {
    activeOps.delete(runId)
    if (!opts.win.isDestroyed()) {
      opts.win.webContents.send('op:output', {
        runId, kind: opts.kind, stream: 'stderr', line: `spawn error: ${err.message}`, ts: Date.now(),
      })
      opts.win.webContents.send('op:done', { runId, kind: opts.kind, code: -1, signal: null })
    }
  })

  activeOps.set(runId, { kind: opts.kind, runId, child })
  return runId
}

export function cancelOp(runId: string): boolean {
  const op = activeOps.get(runId)
  if (!op) return false
  op.child.kill('SIGTERM')
  return true
}

export function activeOpsCount(): number {
  return activeOps.size
}
