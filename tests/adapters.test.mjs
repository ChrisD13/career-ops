import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

import a16z from '../scrapers/adapters/a16z.mjs';
import sequoia from '../scrapers/adapters/sequoia.mjs';
import benchmark from '../scrapers/adapters/benchmark.mjs';
import accel from '../scrapers/adapters/accel.mjs';
import generalCatalyst from '../scrapers/adapters/general-catalyst.mjs';
import coatue from '../scrapers/adapters/coatue.mjs';
import foundersFund from '../scrapers/adapters/founders-fund.mjs';
import khosla from '../scrapers/adapters/khosla.mjs';
import indexVentures from '../scrapers/adapters/index-ventures.mjs';
import lightspeed from '../scrapers/adapters/lightspeed.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'adapters');
const EMPTY_HTML = '<!doctype html><html><body><p>No portfolio companies here.</p></body></html>';

// Table: each enabled adapter's fixture, portfolio_url, and import.
// Benchmark is handled separately — it has no network and no fixture.
const ADAPTERS = [
  { name: 'a16z',             portfolio_url: 'https://a16z.com/portfolio/',                 fixture: 'a16z.html',             scrape: a16z },
  { name: 'Sequoia',          portfolio_url: 'https://www.sequoiacap.com/our-companies/',   fixture: 'sequoia.html',          scrape: sequoia },
  { name: 'Accel',            portfolio_url: 'https://www.accel.com/companies',             fixture: 'accel.html',            scrape: accel },
  { name: 'General Catalyst', portfolio_url: 'https://www.generalcatalyst.com/portfolio',   fixture: 'general-catalyst.html', scrape: generalCatalyst },
  { name: 'Coatue',           portfolio_url: 'https://www.coatue.com/portfolio',            fixture: 'coatue.html',           scrape: coatue },
  { name: 'Founders Fund',    portfolio_url: 'https://foundersfund.com/portfolio/',         fixture: 'founders-fund.html',    scrape: foundersFund },
  { name: 'Khosla',           portfolio_url: 'https://www.khoslaventures.com/portfolio/',   fixture: 'khosla.html',           scrape: khosla },
  { name: 'Index',            portfolio_url: 'https://www.indexventures.com/companies/',    fixture: 'index-ventures.html',   scrape: indexVentures },
  { name: 'Lightspeed',       portfolio_url: 'https://lsvp.com/portfolio/',                 fixture: 'lightspeed.html',       scrape: lightspeed },
];

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser.close(); });

for (const adapter of ADAPTERS) {
  const fixturePath = join(fixturesDir, adapter.fixture);
  const fixtureHtml = readFileSync(fixturePath, 'utf-8');

  test(
    `${adapter.name} adapter parses portfolio companies from captured fixture`,
    async () => {
      const ctx = await browser.newContext();
      try {
        // RESEARCH pitfall 2: fresh context per test prevents route leaks between firms
        await ctx.route(adapter.portfolio_url, (route) =>
          route.fulfill({ contentType: 'text/html', body: fixtureHtml })
        );
        const firm = { name: adapter.name, portfolio_url: adapter.portfolio_url };
        const companies = await adapter.scrape(ctx, { log: () => {}, firm });
        assert.ok(Array.isArray(companies), `${adapter.name}: expected array`);
        assert.ok(companies.length > 0, `${adapter.name}: fixture yielded no companies — selector drift?`);
        assert.ok(
          typeof companies[0].name === 'string' && companies[0].name.length > 0,
          `${adapter.name}: first company has no .name`,
        );
      } finally {
        await ctx.close();
      }
    },
  );

  test(`${adapter.name} adapter returns empty array when selectors do not match`, async () => {
    const ctx = await browser.newContext();
    try {
      await ctx.route(adapter.portfolio_url, (route) =>
        route.fulfill({ contentType: 'text/html', body: EMPTY_HTML })
      );
      const firm = { name: adapter.name, portfolio_url: adapter.portfolio_url };
      const companies = await adapter.scrape(ctx, { log: () => {}, firm });
      assert.deepEqual(companies, [], `${adapter.name}: expected [] against stripped HTML`);
    } finally {
      await ctx.close();
    }
  });
}

// Benchmark no-op contract. Per RESEARCH pitfall 3 we pass a real context (not null)
// so a future accidental context-use in benchmark.mjs does not silently hide behind null.
// No route is registered because benchmark never calls page.goto().
test('Benchmark adapter is a no-op (no public portfolio page)', async () => {
  const ctx = await browser.newContext();
  try {
    const firm = { name: 'Benchmark', portfolio_url: '' };
    const companies = await benchmark(ctx, { log: () => {}, firm });
    assert.deepEqual(companies, []);
  } finally {
    await ctx.close();
  }
});
