export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 45000 });
    // Wait up to 5s for client-side population after networkidle
    await page.waitForSelector('a[href*="/companies/"]', { timeout: 5000 }).catch(() => {});
    const companies = await page.$$eval('a[href*="/companies/"]', (nodes) => {
      const seen = new Set();
      return nodes.map(n => {
        const name = (n.textContent ?? '').trim();
        const href = n.href ?? '';
        return { name, website: href, careers_url: '' };
      }).filter(c => {
        if (!c.name || seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      });
    });
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
