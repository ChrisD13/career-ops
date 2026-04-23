import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReason } from '../scrapers/health.mjs';

test('normalizeReason(null) returns selector_miss', () => {
  assert.equal(normalizeReason(null), 'selector_miss');
});

test('normalizeReason(undefined) returns selector_miss', () => {
  assert.equal(normalizeReason(undefined), 'selector_miss');
});

test('normalizeReason(Error with /timeout/i message) returns timeout', () => {
  assert.equal(normalizeReason(new Error('Timeout 30000ms exceeded')), 'timeout');
});

test('normalizeReason(Error with name=TimeoutError) returns timeout even if message does not match', () => {
  const err = new Error('some unrelated wording');
  err.name = 'TimeoutError';
  assert.equal(normalizeReason(err), 'timeout');
});

test('normalizeReason(Error with /robots/i message) returns robots_block', () => {
  assert.equal(normalizeReason(new Error('robots disallow')), 'robots_block');
});

test('normalizeReason(generic thrown error) falls back to network_error', () => {
  assert.equal(normalizeReason(new Error('ECONNRESET')), 'network_error');
});
