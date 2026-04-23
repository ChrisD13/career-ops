// HEAD probe for Add Firm — verifies a portfolio URL is reachable before saving.
// SSRF guard: only http(s), no private-IP literals in host, 5s timeout.

const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i

export interface ProbeResult {
  ok: boolean
  status?: number
  error?: string
}

export async function probeUrl(rawUrl: string): Promise<ProbeResult> {
  let u: URL
  try { u = new URL(rawUrl) } catch { return { ok: false, error: 'invalid url' } }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'scheme must be http or https' }
  }
  if (PRIVATE_HOST_RE.test(u.hostname)) {
    return { ok: false, error: 'private/loopback host not allowed' }
  }
  try {
    const res = await fetch(u.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'JobEngineBot/1.0' },
    })
    return { ok: res.ok, status: res.status }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    return { ok: false, error: e?.name === 'TimeoutError' ? 'timeout' : (e?.message ?? 'probe failed') }
  }
}
