import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const FALLBACK_STATES = [
  { id: 'evaluated', label: 'Evaluated', aliases: ['evaluada'] },
  { id: 'applied', label: 'Applied', aliases: ['aplicado', 'enviada', 'aplicada', 'sent'] },
  { id: 'responded', label: 'Responded', aliases: ['respondido'] },
  { id: 'interview', label: 'Interview', aliases: ['entrevista'] },
  { id: 'offer', label: 'Offer', aliases: ['oferta'] },
  { id: 'rejected', label: 'Rejected', aliases: ['rechazado', 'rechazada'] },
  { id: 'discarded', label: 'Discarded', aliases: ['descartado', 'descartada', 'cerrada', 'cancelada'] },
  { id: 'skip', label: 'SKIP', aliases: ['no_aplicar', 'no aplicar', 'skip', 'monitor'] },
];

const EXTRA_ALIAS_TO_ID = new Map([
  ['condicional', 'evaluated'],
  ['hold', 'evaluated'],
  ['evaluar', 'evaluated'],
  ['verificar', 'evaluated'],
  ['geo blocker', 'skip'],
]);

const catalogCache = new Map();

function loadStates(baseDir) {
  const candidates = [
    join(baseDir, 'templates', 'states.yml'),
    join(baseDir, 'states.yml'),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const data = yaml.load(readFileSync(path, 'utf-8'));
      if (Array.isArray(data?.states) && data.states.length > 0) {
        return data.states;
      }
    } catch {
      // Fall back to defaults below.
    }
  }

  return FALLBACK_STATES;
}

function buildCatalog(states) {
  const normalizedStates = states.map((state) => ({
    id: String(state.id || '').trim().toLowerCase(),
    label: String(state.label || state.id || '').trim(),
    aliases: Array.isArray(state.aliases) ? state.aliases.map((alias) => String(alias).trim()) : [],
  })).filter((state) => state.id && state.label);

  const idToState = new Map();
  const aliasToId = new Map(EXTRA_ALIAS_TO_ID);
  const canonicalIds = new Set();
  const canonicalLabels = new Set();

  for (const state of normalizedStates) {
    idToState.set(state.id, state);
    canonicalIds.add(state.id);
    canonicalLabels.add(state.label.toLowerCase());
    aliasToId.set(state.id, state.id);
    aliasToId.set(state.label.toLowerCase(), state.id);
    for (const alias of state.aliases) {
      aliasToId.set(alias.toLowerCase(), state.id);
    }
  }

  return {
    states: normalizedStates,
    idToState,
    aliasToId,
    canonicalIds,
    canonicalLabels,
  };
}

export function getStatusCatalog(baseDir) {
  if (!catalogCache.has(baseDir)) {
    catalogCache.set(baseDir, buildCatalog(loadStates(baseDir)));
  }
  return catalogCache.get(baseDir);
}

export function stripStatusDecorators(raw = '') {
  return String(raw ?? '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '')
    .trim();
}

export function normalizeStatusMeta(raw, baseDir) {
  const catalog = getStatusCatalog(baseDir);
  const clean = stripStatusDecorators(raw);
  const lower = clean.toLowerCase();

  let lookup = lower;
  let moveToNotes = null;

  if (/^(duplicado|dup)\b/i.test(clean) || /^repost/i.test(clean)) {
    lookup = 'discarded';
    moveToNotes = String(raw ?? '').trim();
  } else if (/geo.?blocker/i.test(clean)) {
    lookup = 'geo blocker';
  } else if (clean === '' || clean === '-' || clean === '—') {
    lookup = 'discarded';
  }

  const id = catalog.aliasToId.get(lookup);
  if (!id) {
    return {
      clean,
      id: null,
      label: null,
      moveToNotes,
      recognized: false,
    };
  }

  return {
    clean,
    id,
    label: catalog.idToState.get(id)?.label ?? id,
    moveToNotes,
    recognized: true,
  };
}

export function normalizeStatusId(raw, baseDir) {
  const meta = normalizeStatusMeta(raw, baseDir);
  return meta.recognized ? meta.id : meta.clean.toLowerCase();
}
