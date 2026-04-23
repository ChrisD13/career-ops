export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    // Click "Load More" until exhausted (cap 20 iterations for safety)
    for (let i = 0; i < 20; i++) {
      const btn = page.locator('button:has-text("Load More"), button:has-text("Load more")').first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click().catch(() => { i = 20; });
      await page.waitForTimeout(1000);
    }
    const companies = await page.$$eval(
      'a[href*="/companies/"], article.company, .company-tile',
      (nodes) => {
        const seen = new Set();
        return nodes.map(n => ({
          name: (n.querySelector('h3, h2, .name')?.textContent ?? n.textContent ?? '').trim(),
          website: n.querySelector('a[href^="http"]:not([href*="accel.com"])')?.href ?? '',
          careers_url: '',
        })).filter(c => { if (!c.name || seen.has(c.name)) return false; seen.add(c.name); return true; });
      }
    );
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
