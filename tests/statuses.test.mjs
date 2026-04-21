import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { getStatusCatalog, normalizeStatusId, normalizeStatusMeta } from '../lib/statuses.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('status catalog loads canonical states from templates/states.yml', () => {
  const catalog = getStatusCatalog(repoRoot);

  assert.equal(catalog.canonicalIds.has('evaluated'), true);
  assert.equal(catalog.canonicalIds.has('skip'), true);
  assert.equal(catalog.idToState.get('skip').label, 'SKIP');
});

test('normalizeStatusMeta handles YAML aliases and supported extras', () => {
  assert.equal(normalizeStatusId('aplicado 2026-04-10', repoRoot), 'applied');
  assert.equal(normalizeStatusId('monitor', repoRoot), 'skip');
  assert.equal(normalizeStatusId('condicional', repoRoot), 'evaluated');
  assert.equal(normalizeStatusId('geo blocker', repoRoot), 'skip');
});

test('normalizeStatusMeta preserves duplicate/repost notes while canonicalizing', () => {
  const duplicate = normalizeStatusMeta('DUP reposted 2026-04-10', repoRoot);
  assert.equal(duplicate.recognized, true);
  assert.equal(duplicate.label, 'Discarded');
  assert.match(duplicate.moveToNotes, /DUP reposted 2026-04-10/);
});
