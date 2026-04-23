export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 45000 });
    const companies = await page.$$eval('.company, .portfolio-company, a[href*="/company/"]', (nodes) => {
      const seen = new Set();
      return nodes.map(n => ({
        name: (n.querySelector('h3, h2, .company-name')?.textContent ?? n.textContent ?? '').trim(),
        website: n.querySelector('a[href^="http"]:not([href*="lsvp.com"])')?.href ?? '',
        careers_url: '',
      })).filter(c => { if (!c.name || seen.has(c.name)) return false; seen.add(c.name); return true; });
    });
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
