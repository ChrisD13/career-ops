// Heuristic funding-signal probe. NO Crunchbase API (per D-02).
// Two signal sources: firm blog RSS (12mo) + Google News RSS query (12mo).
// Word-boundary match required. Emits { funding_signal, funding_date } or empty strings.

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
const KEYWORDS = /\b(raised|raises|series\s+[a-f]|funding|seed\s+round|announces\s+\$)/i;

// Per-firm RSS cache keyed by firm name
const rssCache = new Map();

async function fetchText(url, timeoutMs = 6000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    // Guard against Google returning HTML error page (Pitfall 8)
    if (!ct.includes('xml') && !ct.includes('rss') && !ct.includes('atom')) {
      // Still return text — some feeds mislabel. parseFeed guards on parse failure.
    }
    return await res.text();
  } catch { return null; }
}

// Minimal RSS/Atom parser — extracts <item>/<entry> with <title> and <pubDate>/<published>.
// Avoids adding xml2js dep per §Don't Hand-Roll rule: this is a narrow need, not generic XML.
function parseFeed(xml) {
  if (!xml) return [];
  const items = [];
  const itemRe = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/g;
  const titleRe = /<title\b[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/;
  const dateRe = /<(?:pubDate|published|updated)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const t = titleRe.exec(block)?.[1]?.trim() ?? '';
    const d = dateRe.exec(block)?.[1]?.trim() ?? '';
    if (t) items.push({ title: t, date: d });
  }
  return items;
}

function withinTwelveMonths(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= TWELVE_MONTHS_MS;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function checkFirmBlog(company, firm) {
  const origin = (() => {
    try { return new URL(firm.portfolio_url).origin; } catch { return null; }
  })();
  if (!origin) return null;
  const feedUrl = `${origin}/feed/`;
  let items = rssCache.get(firm.name);
  if (!items) {
    const xml = await fetchText(feedUrl);
    items = xml ? parseFeed(xml) : [];
    rssCache.set(firm.name, items);
  }
  const nameRe = new RegExp(`\\b${escapeRegex(company.name)}\\b`, 'i');
  for (const item of items) {
    if (!withinTwelveMonths(item.date)) continue;
    if (nameRe.test(item.title)) {
      return { funding_signal: `Blog announcement via ${origin}/feed/`, funding_date: toIsoDate(item.date) };
    }
  }
  return null;
}

async function checkGoogleNews(company) {
  const q = encodeURIComponent(`"${company.name}" funding round`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US`;
  const xml = await fetchText(url, 8000);
  const items = xml ? parseFeed(xml) : [];
  for (const item of items) {
    if (!withinTwelveMonths(item.date)) continue;
    if (KEYWORDS.test(item.title)) {
      return { funding_signal: 'Press mention via news.google.com', funding_date: toIsoDate(item.date) };
    }
  }
  return null;
}

function toIsoDate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export async function detectFundingSignal(company, firm) {
  // Signal A first (blog), then fall back to Signal B (Google News)
  const blog = await checkFirmBlog(company, firm);
  if (blog) return blog;
  const news = await checkGoogleNews(company);
  if (news) return news;
  return { funding_signal: '', funding_date: '' };
}
