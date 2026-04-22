import Anthropic from '@anthropic-ai/sdk'
import type { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import * as path from 'path'
import type { MtimeCache } from './mtime-cache'

interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-4-6': { in: 3.0, out: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5':  { in: 1.0, out: 5.0,  cacheRead: 0.10, cacheWrite: 1.25 },
}

export function calculateCost(model: string, usage: Usage): number {
  const p = PRICES[model] ?? PRICES['claude-sonnet-4-6']
  return (
    usage.input_tokens * p.in +
    usage.output_tokens * p.out +
    usage.cache_read_input_tokens * p.cacheRead +
    usage.cache_creation_input_tokens * p.cacheWrite
  ) / 1_000_000
}

export async function verifyApiKey(rawKey: string): Promise<{ ok: boolean; error?: string }> {
  const client = new Anthropic({ apiKey: rawKey })
  try {
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    return { ok: true }
  } catch (err: any) {
    if (err?.status === 401) return { ok: false, error: 'Invalid API key' }
    if (err?.status === 429) return { ok: false, error: 'Rate limited — try again in a moment' }
    return { ok: false, error: err?.message ?? 'Verification failed' }
  }
}

interface EvaluationParams {
  url: string
  apiKey: string
  model: string
  projectRoot: string
  mtimeCache: MtimeCache
  win: BrowserWindow
}

// Module-level singleton — only one evaluation in-flight at a time
let active: { controller: AbortController } | null = null

async function buildStablePrefix(projectRoot: string, mtimeCache: MtimeCache): Promise<string> {
  const parts: string[] = []
  const join = (rel: string) => path.join(projectRoot, rel)

  // Order: _shared → oferta → cv → article-digest (optional) → profile.yml → _profile
  // Per D-11 + Pitfall 3: article-digest.md included when present to boost prefix toward
  // Sonnet's 2048-token cache minimum
  parts.push(await mtimeCache.read(join('modes/_shared.md')))
  parts.push(await mtimeCache.read(join('modes/oferta.md')))
  parts.push(await mtimeCache.read(join('cv.md')))

  const digestPath = join('article-digest.md')
  if (existsSync(digestPath)) {
    parts.push(await mtimeCache.read(digestPath))
  }

  parts.push(await mtimeCache.read(join('config/profile.yml')))
  parts.push(await mtimeCache.read(join('modes/_profile.md')))

  return parts.join('\n\n---\n\n')
}

export async function streamEvaluation(params: EvaluationParams): Promise<{ evaluationId: string }> {
  // Abort any in-flight evaluation before starting a new one
  if (active) {
    active.controller.abort()
    active = null
  }

  const evaluationId = `eval-${Date.now()}`
  const controller = new AbortController()
  active = { controller }

  const client = new Anthropic({ apiKey: params.apiKey })

  // Assemble context BEFORE starting the stream so errors surface synchronously
  let stablePrefix: string
  try {
    stablePrefix = await buildStablePrefix(params.projectRoot, params.mtimeCache)
  } catch (err: any) {
    active = null
    if (!params.win.isDestroyed()) {
      params.win.webContents.send('evaluation:error', {
        message: `Failed to load context files: ${err?.message ?? String(err)}`,
      })
    }
    return { evaluationId }
  }

  // Fire-and-forget async work; errors are surfaced as IPC events
  ;(async () => {
    try {
      const stream = client.messages.stream(
        {
          model: params.model,
          max_tokens: 8192,
          system: [
            {
              type: 'text',
              text: stablePrefix,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [
            {
              role: 'user',
              content: `Evaluate this job URL and produce an A-G report: ${params.url}`,
            },
          ],
        },
        { signal: controller.signal },
      )

      stream.on('text', (delta: string) => {
        if (!params.win.isDestroyed()) {
          params.win.webContents.send('evaluation:token', delta)
        }
      })

      // Pitfall 4: usage must come from finalMessage(), not from streamed usage events
      const finalMessage = await stream.finalMessage()
      // Persist mtime cache AFTER a successful stream so repeat runs hit the cache
      try { await params.mtimeCache.persist() } catch { /* non-fatal */ }

      if (!params.win.isDestroyed()) {
        const usage = finalMessage.usage as Usage
        params.win.webContents.send('evaluation:done', {
          usage,
          stopReason: finalMessage.stop_reason ?? 'end_turn',
          costUsd: calculateCost(params.model, usage),
          model: params.model,
        })
      }
    } catch (err: any) {
      if (err?.name === 'APIUserAbortError') {
        if (!params.win.isDestroyed()) {
          params.win.webContents.send('evaluation:cancelled')
        }
      } else if (!params.win.isDestroyed()) {
        params.win.webContents.send('evaluation:error', {
          status: err?.status,
          type: err?.error?.type,
          message: err?.message ?? 'Unknown streaming error',
          retryAfter: err?.headers?.['retry-after'],
        })
      }
    } finally {
      // Pitfall 9: always clear the active singleton
      if (active?.controller === controller) active = null
    }
  })()

  return { evaluationId }
}

export function cancelActiveEvaluation(): void {
  if (active) {
    active.controller.abort()
    // active is cleared in the stream's finally block
  }
}
