export default async function scrape(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    const companies = await page.$$eval('a[href^="http"]', (nodes) => {
      const seen = new Set();
      return nodes
        .filter(a => !a.href.includes('khoslaventures.com') && a.textContent.trim().length > 0 && a.textContent.trim().length < 80)
        .map(a => ({ name: a.textContent.trim(), website: a.href, careers_url: '' }))
        .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
    });
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}
