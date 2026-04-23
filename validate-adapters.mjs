#!/usr/bin/env node

/**
 * validate-adapters.mjs — VC adapter live-validation tool
 *
 * Runs every enabled VC adapter against its live portfolio page and reports
 * OK / Error per firm using canonical reason codes. Not part of `npm test`
 * (hits real networks; slow). Use to confirm selectors still work and to
 * capture fresh HTML fixtures for the regression harness.
 *
 * Usage:
 *   node validate-adapters.mjs                   # validate all enabled firms
 *   node validate-adapters.mjs --firm a16z       # single firm (substring match)
 *   node validate-adapters.mjs --capture         # after OK, save HTML to tests/fixtures/adapters/{firm}.html
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { chromium } from 'playwright';
import yaml from 'js-yaml';
import adapters from './scrapers/adapters/index.mjs';
import { normalizeReason } from './scrapers/health.mjs';

const CONFIG_PATH = 'config/vc-firms.yml';
const FIXTURE_DIR = 'tests/fixtures/adapters';

// Hardcoded filename map — resolves 'Index' → 'index-ventures.html' collision
// (firm.name.toLowerCase() would produce 'index.html', which is ambiguous).
const FIXTURE_FILENAMES = {
  'a16z': 'a16z.html',
  'Sequoia': 'sequoia.html',
  'Accel': 'accel.html',
  'General Catalyst': 'general-catalyst.html',
  'Coatue': 'coatue.html',
  'Founders Fund': 'founders-fund.html',
  'Khosla': 'khosla.html',
  'Index': 'index-ventures.html',
  'Lightspeed': 'lightspeed.html',
};

async function main() {
  const args = process.argv.slice(2);
  const captureFlag = args.includes('--capture');
  const firmFlagIdx = args.indexOf('--firm');
  const firmFilter = firmFlagIdx !== -1 ? (args[firmFlagIdx + 1] ?? '').toLowerCase() : null;

  if (!existsSync(CONFIG_PATH)) {
    console.error(`Error: ${CONFIG_PATH} not found. Copy from config/vc-firms.example.yml first.`);
    process.exit(1);
  }

  const firmsDoc = yaml.load(readFileSync(CONFIG_PATH, 'utf-8'));
  let firms;
  if (firmFilter) {
    firms = (firmsDoc?.firms ?? []).filter(f => f.name.toLowerCase().includes(firmFilter));
    if (firms.length === 0) {
      console.error(`Error: no firms match --firm ${firmFilter}`);
      process.exit(1);
    }
  } else {
    firms = (firmsDoc?.firms ?? []).filter(f => f.enabled !== false && f.portfolio_url);
  }

  console.log(`${'━'.repeat(45)}`);
  console.log(`Adapter Validation — ${new Date().toISOString().slice(0, 10)}${captureFlag ? ' (capture)' : ''}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Firms to validate: ${firms.length}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  let okCount = 0;
  let errCount = 0;

  for (const firm of firms) {
    const ctx = await browser.newContext();
    try {
      const adapter = adapters[firm.name] ?? adapters.__generic__;
      const companies = await adapter(ctx, { log: () => {}, firm });
      if (companies.length > 0) {
        okCount++;
        console.log(`[${firm.name}] OK (${companies.length} companies)`);
        if (captureFlag) {
          const filename = FIXTURE_FILENAMES[firm.name] ?? `${firm.name.toLowerCase().replace(/\s+/g, '-')}.html`;
          const page = await ctx.newPage();
          try {
            await page.goto(firm.portfolio_url, { waitUntil: 'networkidle', timeout: 45000 });
            const html = await page.content();
            mkdirSync(FIXTURE_DIR, { recursive: true });
            writeFileSync(`${FIXTURE_DIR}/${filename}`, html);
            console.log(`  Fixture saved: ${FIXTURE_DIR}/${filename} (${html.length} bytes)`);
          } finally {
            await page.close();
          }
        }
      } else {
        errCount++;
        const reason = normalizeReason(null);
        console.log(`[${firm.name}] Error: ${reason} (0 companies — selector drift?)`);
      }
    } catch (err) {
      errCount++;
      const reason = normalizeReason(err);
      console.log(`[${firm.name}] Error: ${reason} — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  console.log('');
  console.log(`${'━'.repeat(45)}`);
  console.log(`OK:    ${okCount}`);
  console.log(`Error: ${errCount}`);
  console.log(`${'━'.repeat(45)}`);

  if (errCount > 0) process.exit(1);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal:', err?.stack ?? err?.message ?? err);
    process.exit(1);
  });
}

export { main };
