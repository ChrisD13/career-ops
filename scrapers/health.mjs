import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import writeFileAtomic from 'write-file-atomic';

/**
 * Classify a raw error or condition into a canonical reason code.
 * @param {Error|null|undefined} err — thrown error, or null/undefined if adapter returned 0 companies
 * @returns {'selector_miss'|'timeout'|'robots_block'|'network_error'}
 */
export function normalizeReason(err) {
  if (!err) return 'selector_miss';
  if (err.name === 'TimeoutError') return 'timeout';
  const msg = err.message ?? '';
  if (/timeout/i.test(msg)) return 'timeout';
  if (/robots/i.test(msg)) return 'robots_block';
  return 'network_error';
}

export function readHealth(path) {
  if (!existsSync(path)) return { firms: [] };
  try {
    const raw = readFileSync(path, 'utf-8');
    const json = JSON.parse(raw);
    return { firms: Array.isArray(json.firms) ? json.firms : [] };
  } catch { return { firms: [] }; }
}

export async function writeHealth(path, firmUpdates) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const existing = readHealth(path);
  const byName = new Map(existing.firms.map(f => [f.name, f]));
  const nowIso = new Date().toISOString();

  for (const upd of firmUpdates) {
    const prev = byName.get(upd.name) ?? {};
    const count = upd.count ?? 0;
    // Baseline rule: never decrease (high-water mark). First run sets baseline = count.
    const prevBaseline = prev.baseline_count ?? 0;
    const baseline = upd.status === 'OK' ? Math.max(prevBaseline, count) : prevBaseline;
    byName.set(upd.name, {
      name: upd.name,
      last_run: nowIso,
      company_count: count,
      baseline_count: baseline,
      status: upd.status,
      ...(upd.reason ? { reason: upd.reason } : {}),
    });
  }
  await writeFileAtomic(path, JSON.stringify({ firms: Array.from(byName.values()) }, null, 2));
}
