#!/usr/bin/env node

/**
 * scrape-vcs.mjs — VC portfolio discovery scraper
 *
 * Loads config/vc-firms.yml, iterates enabled firms via per-firm adapters
 * (Playwright headless), applies funding + role-match heuristics, writes
 * data/vc-companies.tsv + data/vc-health.json atomically. Serialized with
 * random 500–2000ms delays between requests; honors robots.txt.
 *
 * Usage:
 *   node scrape-vcs.mjs                  # scrape all enabled firms
 *   node scrape-vcs.mjs --dry-run        # preview without writing
 *   node scrape-vcs.mjs --firm a16z      # scrape a single firm (case-insensitive match)
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { chromium } from 'playwright';
import yaml from 'js-yaml';
import { checkAllowed, randomDelay, USER_AGENT } from './scrapers/robots.mjs';
import { detectFundingSignal } from './scrapers/funding-detector.mjs';
import { detectRoleMatches, extractRoleKeywords } from './scrapers/role-matcher.mjs';
import { writeCompaniesTsv, readExistingCompanies, mergeCompanies } from './scrapers/tsv-writer.mjs';
import { writeHealth } from './scrapers/health.mjs';
import adapters from './scrapers/adapters/index.mjs';

const CONFIG_PATH = 'config/vc-firms.yml';
const PROFILE_PATH = 'config/profile.yml';
const TSV_PATH = 'data/vc-companies.tsv';
const HEALTH_PATH = 'data/vc-health.json';

// Ensure data/ exists
mkdirSync('data', { recursive: true });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const firmFlagIdx = args.indexOf('--firm');
  const firmFilter = firmFlagIdx !== -1 ? (args[firmFlagIdx + 1] ?? '').toLowerCase() : null;

  if (!existsSync(CONFIG_PATH)) {
    console.error(`Error: ${CONFIG_PATH} not found. Copy from config/vc-firms.example.yml first.`);
    process.exit(1);
  }

  const firmsDoc = yaml.load(readFileSync(CONFIG_PATH, 'utf-8'));
  let firms;
  if (firmFilter) {
    // When --firm is specified, bypass enabled/portfolio_url filter (explicit intent)
    firms = (firmsDoc?.firms ?? []).filter(f => f.name.toLowerCase().includes(firmFilter));
    if (firms.length === 0) {
      console.error(`Error: no firms match --firm ${firmFilter}`);
      process.exit(1);
    }
  } else {
    firms = (firmsDoc?.firms ?? []).filter(f => f.enabled !== false && f.portfolio_url);
  }

  const profile = existsSync(PROFILE_PATH)
    ? yaml.load(readFileSync(PROFILE_PATH, 'utf-8'))
    : {};
  const roleKeywords = extractRoleKeywords(profile);

  console.log(`${'━'.repeat(45)}`);
  console.log(`VC Scrape — ${new Date().toISOString().slice(0, 10)}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`${'━'.repeat(45)}`);
  console.log(`Firms to scan:       ${firms.length}`);
  console.log(`Role keywords:       ${roleKeywords.length}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });

  const allFresh = [];
  const healthUpdates = [];

  for (const firm of firms) {
    try {
      if (firm.portfolio_url) {
        const { allowed } = await checkAllowed(firm.portfolio_url);
        if (!allowed) {
          console.log(`[${firm.name}] robots.txt disallows — skipping`);
          healthUpdates.push({ name: firm.name, status: 'Error', reason: 'robots.txt disallow', count: 0 });
          await randomDelay();
          continue;
        }
      }

      console.log(`[${firm.name}] scraping…`);
      const adapter = adapters[firm.name] ?? adapters.__generic__;
      const discovered = await adapter(context, { log: console.log, firm });
      console.log(`[${firm.name}] adapter returned ${discovered.length} companies`);

      const nowIso = new Date().toISOString();
      for (const c of discovered) {
        // enrich each company with funding + role-match (serialized with delay)
        const careers_url = c.careers_url || c.website || '';
        const enriched = { ...c, careers_url };
        const { funding_signal, funding_date } = await detectFundingSignal(enriched, firm);
        const role_matches = await detectRoleMatches(enriched, roleKeywords);
        allFresh.push({
          firm: firm.name,
          company: enriched.name,
          careers_url,
          funding_signal,
          funding_date,
          role_matches,
          discovered_at: nowIso,
          promoted: 'false',
        });
        await randomDelay();
      }

      healthUpdates.push({ name: firm.name, status: 'OK', count: discovered.length });
    } catch (err) {
      console.error(`[${firm.name}] error: ${err.message}`);
      healthUpdates.push({ name: firm.name, status: 'Error', reason: err.message, count: 0 });
    }
    await randomDelay();
  }

  await browser.close();

  // Merge with existing TSV so the `promoted=true` flag survives re-scrapes
  const existing = readExistingCompanies(TSV_PATH);
  const merged = mergeCompanies(existing, allFresh);

  const withSignal = merged.filter(c => c.funding_signal).length;
  const withMatch = merged.filter(c => c.role_matches).length;

  console.log('');
  console.log(`${'━'.repeat(45)}`);
  console.log(`Firms scanned:       ${firms.length}`);
  console.log(`Fresh companies:     ${allFresh.length}`);
  console.log(`Total (merged):      ${merged.length}`);
  console.log(`With funding signal: ${withSignal}`);
  console.log(`Role-matched:        ${withMatch}`);
  console.log(`${'━'.repeat(45)}`);

  if (dryRun) {
    console.log('Dry-run — no files written.');
    return;
  }

  await writeCompaniesTsv(TSV_PATH, merged);
  await writeHealth(HEALTH_PATH, healthUpdates);
  console.log(`Wrote ${TSV_PATH} (${merged.length} rows) and ${HEALTH_PATH}.`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch(err => {
    console.error('Fatal:', err?.stack ?? err?.message ?? err);
    process.exit(1);
  });
}

export { main };
