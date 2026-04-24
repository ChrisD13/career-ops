export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    // Primary: React-rendered tiles (.portfolio-tile) where the name sits in h2.tile-heading > span
    // and the internal link is a full-card overlay <a href="/company/{slug}/"> with no text content.
    // Fallback: older list markup where the anchor itself contained the name.
    const companies = await page.$$eval('.portfolio-tile, a[href*="/company/"], a[href*="/companies/"]', (nodes) => {
      const seen = new Set();
      return nodes.map(n => {
        const nameFromHeading = (n.querySelector('h2.tile-heading, .tile-heading, h3, h2, .name')?.textContent ?? '').trim();
        const anchor = n.matches?.('a') ? n : n.querySelector('a[href*="/company/"], a[href*="/companies/"]');
        const href = anchor?.href ?? '';
        const name = nameFromHeading || (anchor?.textContent ?? n.textContent ?? '').trim();
        return { name, website: href, careers_url: '' };
      }).filter(c => { if (!c.name || seen.has(c.name)) return false; seen.add(c.name); return true; });
    });
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
