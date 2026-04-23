export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    const loadAll = page.locator('button:has-text("Load All"), button:has-text("Load all")').first();
    if (await loadAll.isVisible().catch(() => false)) {
      await loadAll.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    const companies = await page.$$eval(
      'article[data-portfolio-company], .portfolio-company, .company-card, li.portfolio__item',
      (nodes) => nodes.map(n => ({
        name: (n.querySelector('h3, h2, .company-name, .portfolio__title')?.textContent ?? '').trim(),
        website: n.querySelector('a[href^="http"]:not([href*="a16z.com"])')?.href ?? '',
        careers_url: '',
      })).filter(c => c.name)
    );
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
