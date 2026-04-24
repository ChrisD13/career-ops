export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    // a16z portfolio uses Alpine.js (wr25Portfolio component) — cards are hydrated client-side
    // after initial load. networkidle is unreliable here, so wait for domcontentloaded and
    // then give Alpine time to render the card buttons.
    await page.goto(firm.portfolio_url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const loadAll = page.locator('button:has-text("Load All"), button:has-text("Load all")').first();
    if (await loadAll.isVisible().catch(() => false)) {
      await loadAll.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    // Primary selector (post-WR25 redesign): hydrated card buttons with aria-label = company name.
    // Fallbacks preserved for resilience against future theme changes.
    const companies = await page.$$eval(
      'button.group\\/card, article[data-portfolio-company], .portfolio-company, .company-card, li.portfolio__item',
      (nodes) => nodes.map(n => {
        // WR25 card: <button class="group/card" aria-label="Company Name">
        const ariaLabel = n.getAttribute?.('aria-label') ?? '';
        const bindExpr = 'item.company';
        const nameFromAria = ariaLabel && !ariaLabel.includes(bindExpr) ? ariaLabel : '';
        const nameFromHeading = (n.querySelector('h3, h2, .company-name, .portfolio__title')?.textContent ?? '').trim();
        return {
          name: (nameFromAria || nameFromHeading).trim(),
          website: n.querySelector('a[href^="http"]:not([href*="a16z.com"])')?.href ?? '',
          careers_url: '',
        };
      }).filter(c => c.name)
    );
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
