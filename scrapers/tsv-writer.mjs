import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';
import writeFileAtomic from 'write-file-atomic';

const HEADER = 'firm\tcompany\tcareers_url\tfunding_signal\tfunding_date\trole_matches\tdiscovered_at\tpromoted\n';
const COLS = ['firm','company','careers_url','funding_signal','funding_date','role_matches','discovered_at','promoted'];

export function readExistingCompanies(tsvPath) {
  if (!existsSync(tsvPath)) return [];
  const raw = readFileSync(tsvPath, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const parts = line.split('\t');
    const obj = {};
    COLS.forEach((c, i) => { obj[c] = parts[i] ?? ''; });
    return obj;
  });
}

export async function writeCompaniesTsv(tsvPath, companies) {
  const dir = dirname(tsvPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const body = companies.map(c => COLS.map(col => {
    const v = c[col];
    if (v === true) return 'true';
    if (v === false) return 'false';
    return String(v ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ');
  }).join('\t')).join('\n') + (companies.length ? '\n' : '');
  await writeFileAtomic(tsvPath, HEADER + body);
}

// Merge helper: dedupe by (firm, company), preserve promoted flag from existing rows
export function mergeCompanies(existing, fresh) {
  const byKey = new Map();
  for (const row of existing) byKey.set(`${row.firm}\t${row.company}`, row);
  for (const row of fresh) {
    const key = `${row.firm}\t${row.company}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      ...row,
      promoted: prev?.promoted === 'true' ? 'true' : (row.promoted ?? 'false'),
    });
  }
  return Array.from(byKey.values());
}
