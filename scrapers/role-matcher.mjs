import { detectApi, buildTitleFilter } from '../scan.mjs';

export function extractRoleKeywords(profile) {
  const primary = profile?.target_roles?.primary ?? [];
  const archetypes = (profile?.target_roles?.archetypes ?? []).map(a => a.name).filter(Boolean);
  // Lowercase, trim, dedupe
  const all = [...primary, ...archetypes].map(s => String(s).toLowerCase().trim()).filter(Boolean);
  return Array.from(new Set(all));
}

// Probes ATS (Greenhouse/Ashby/Lever) on company.website or careers_url, parses listings,
// applies buildTitleFilter against keywords. Returns comma-separated matched keyword list.
export async function detectRoleMatches(company, roleKeywords) {
  const apiInfo = detectApi({ careers_url: company.careers_url, website: company.website });
  if (!apiInfo) return '';
  const filter = buildTitleFilter({ positive: roleKeywords, negative: [] });
  try {
    const res = await fetch(apiInfo.url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return '';
    const json = await res.json();
    const titles = extractTitles(json, apiInfo.type);
    const matches = new Set();
    for (const title of titles) {
      const lower = title.toLowerCase();
      for (const kw of roleKeywords) {
        if (lower.includes(kw) && filter(title)) matches.add(kw);
      }
    }
    return Array.from(matches).join(',');
  } catch { return ''; }
}

function extractTitles(json, type) {
  if (type === 'greenhouse') return (json.jobs ?? []).map(j => j.title ?? '');
  if (type === 'ashby') return (json.jobs ?? []).map(j => j.title ?? '');
  if (type === 'lever') return Array.isArray(json) ? json.map(j => j.text ?? '') : [];
  return [];
}
