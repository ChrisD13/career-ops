export default async function scrape(_context, { log, firm }) {
  log(`[${firm.name}] Benchmark has no public portfolio page — set portfolio_url to a mirror (e.g. vcbacked.co) in config/vc-firms.yml to enable, or leave disabled.`);
  return [];
}
