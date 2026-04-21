import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

import {
  appendToPipeline,
  appendToScanHistory,
  buildTitleFilter,
  detectApi,
  ensurePipelineFile,
  getStandaloneScopeWarnings,
  loadSeenCompanyRoles,
  loadSeenUrls,
  resolveScanTargets,
} from '../scan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'scanner');

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'career-ops-scan-'));
}

test('detectApi recognizes supported ATS patterns', () => {
  assert.deepEqual(
    detectApi({ careers_url: 'https://jobs.ashbyhq.com/example' }),
    {
      type: 'ashby',
      url: 'https://api.ashbyhq.com/posting-api/job-board/example?includeCompensation=true',
    },
  );

  assert.deepEqual(
    detectApi({ careers_url: 'https://jobs.lever.co/example' }),
    {
      type: 'lever',
      url: 'https://api.lever.co/v0/postings/example',
    },
  );

  assert.deepEqual(
    detectApi({ careers_url: 'https://job-boards.greenhouse.io/example' }),
    {
      type: 'greenhouse',
      url: 'https://boards-api.greenhouse.io/v1/boards/example/jobs',
    },
  );

  assert.equal(detectApi({ careers_url: 'https://openai.com/careers' }), null);
});

test('buildTitleFilter honors positive and negative keywords', () => {
  const filter = buildTitleFilter({
    positive: ['AI', 'Platform'],
    negative: ['Junior'],
  });

  assert.equal(filter('Senior AI Engineer'), true);
  assert.equal(filter('Platform Engineer'), true);
  assert.equal(filter('Junior AI Engineer'), false);
  assert.equal(filter('Finance Manager'), false);
});

test('loadSeenUrls and loadSeenCompanyRoles parse canonical tracker files from fixtures', () => {
  const root = makeTempDir();
  const dataDir = join(root, 'data');
  cpSync(fixturesDir, dataDir, { recursive: true });

  const seenUrls = loadSeenUrls({
    scanHistoryPath: join(dataDir, 'scan-history.tsv'),
    pipelinePath: join(dataDir, 'pipeline.md'),
    applicationsPath: join(dataDir, 'applications.md'),
  });

  assert.equal(seenUrls.has('https://jobs.example.com/seen-in-history'), true);
  assert.equal(seenUrls.has('https://jobs.example.com/pending-role'), true);
  assert.equal(seenUrls.has('https://jobs.example.com/acme-applied'), true);

  const seenCompanyRoles = loadSeenCompanyRoles({
    applicationsPath: join(dataDir, 'applications.md'),
  });

  assert.equal(seenCompanyRoles.has('acme::senior product manager'), true);
});

test('appendToPipeline creates data/pipeline.md on first run', () => {
  const root = makeTempDir();
  const pipelinePath = join(root, 'data', 'pipeline.md');

  ensurePipelineFile({ pipelinePath });
  assert.equal(existsSync(pipelinePath), true);

  appendToPipeline([
    {
      url: 'https://jobs.example.com/new-role',
      company: 'Acme',
      title: 'Senior AI Engineer',
    },
  ], { pipelinePath });

  const content = readFileSync(pipelinePath, 'utf-8');
  assert.match(content, /## Pendientes/);
  assert.match(content, /https:\/\/jobs\.example\.com\/new-role \| Acme \| Senior AI Engineer/);
});

test('appendToScanHistory creates header and appends rows', () => {
  const root = makeTempDir();
  const scanHistoryPath = join(root, 'data', 'scan-history.tsv');

  appendToScanHistory([
    {
      url: 'https://jobs.example.com/new-role',
      source: 'ashby-api',
      title: 'Senior AI Engineer',
      company: 'Acme',
    },
  ], '2026-04-14', { scanHistoryPath });

  const content = readFileSync(scanHistoryPath, 'utf-8');
  assert.match(content, /^url\tfirst_seen\tportal\ttitle\tcompany\tstatus/m);
  assert.match(content, /https:\/\/jobs\.example\.com\/new-role\t2026-04-14\tashby-api\tSenior AI Engineer\tAcme\tadded/);
});

test('scanner scope warnings make the API-only contract explicit', () => {
  const config = yaml.load(readFileSync(join(fixturesDir, 'portals-api-mismatch.yml'), 'utf-8'));
  const scope = resolveScanTargets(config);
  const warnings = getStandaloneScopeWarnings(scope).join('\n');

  assert.match(warnings, /only covers API-detectable boards/i);
  assert.match(warnings, /search_queries are ignored/i);
  assert.match(warnings, /use `\/career-ops scan`/i);
});
