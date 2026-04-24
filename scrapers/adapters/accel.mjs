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
      '.company-card_component, a[href*="/companies/"], article.company, .company-tile',
      (nodes) => {
        const seen = new Set();
        return nodes.map(n => ({
          // Post-redesign: name lives in <h3 accel-content="company-name" class="sr-only">
          // Fallbacks: older h3/h2/.name heading or raw text content.
          name: (
            n.querySelector('[accel-content="company-name"], h3.sr-only, h3, h2, .name')?.textContent
            ?? n.textContent
            ?? ''
          ).trim(),
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
