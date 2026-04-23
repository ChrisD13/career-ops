export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  const all = new Map();
  try {
    for (let pageNum = 1; pageNum <= 15; pageNum++) {
      const url = pageNum === 1 ? firm.portfolio_url : `${firm.portfolio_url}?page=${pageNum}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const batch = await page.$$eval('a[href*="/companies/"], .portfolio-company, .company', (nodes) =>
        nodes.map(n => ({
          name: (n.querySelector('h3, h2, .name')?.textContent ?? n.textContent ?? '').trim(),
          website: n.querySelector('a[href^="http"]:not([href*="generalcatalyst.com"])')?.href ?? '',
        })).filter(c => c.name)
      );
      if (batch.length === 0) break;
      for (const c of batch) if (!all.has(c.name)) all.set(c.name, { ...c, careers_url: '' });
    }
    if (all.size === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return Array.from(all.values());
  } finally {
    await page.close();
  }
}
