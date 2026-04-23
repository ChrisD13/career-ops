import a16z from './a16z.mjs';
import sequoia from './sequoia.mjs';
import benchmark from './benchmark.mjs';
import accel from './accel.mjs';
import generalCatalyst from './general-catalyst.mjs';
import coatue from './coatue.mjs';
import foundersFund from './founders-fund.mjs';
import khosla from './khosla.mjs';
import indexVentures from './index-ventures.mjs';
import lightspeed from './lightspeed.mjs';

// Generic fallback for user-added firms — same contract, best-effort selector
async function generic(context, { log, firm }) {
  const page = await context.newPage();
  try {
    await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 30000 });
    const companies = await page.$$eval('a[href^="http"]', (nodes) => {
      const origin = (() => { try { return new URL(document.location.href).origin; } catch { return ''; }})();
      const seen = new Set();
      return nodes
        .filter(a => origin && !a.href.startsWith(origin) && a.textContent.trim().length > 0 && a.textContent.trim().length < 80)
        .map(a => ({ name: a.textContent.trim(), website: a.href, careers_url: '' }))
        .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
    });
    if (companies.length === 0) log(`[${firm.name}] no cards found — selector drift?`);
    return companies;
  } finally {
    await page.close();
  }
}

const adapters = {
  'a16z': a16z,
  'Sequoia': sequoia,
  'Benchmark': benchmark,
  'Accel': accel,
  'General Catalyst': generalCatalyst,
  'Coatue': coatue,
  'Founders Fund': foundersFund,
  'Khosla': khosla,
  'Index': indexVentures,
  'Lightspeed': lightspeed,
  __generic__: generic,
};

export default adapters;
