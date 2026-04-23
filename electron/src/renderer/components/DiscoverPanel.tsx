import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import type { VcCompany, VcFirmHealth } from '../../preload/types'
import { VcDropAlertBanner } from './VcDropAlertBanner'
import { DiscoverFilterToggle, type DiscoverFilter } from './DiscoverFilterToggle'
import { ScraperHealthPanel } from './ScraperHealthPanel'
import { CompanyTable } from './CompanyTable'
import { AddFirmButton } from './AddFirmButton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

interface Props {
  refreshKey: number
  scrapeActive: boolean
  onRunScrape: () => Promise<void> | void
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: VcCompany[]; firms: VcFirmHealth[] }

function isMatched(r: VcCompany): boolean {
  return Boolean(r.role_matches) || Boolean(r.funding_signal)
}

export function DiscoverPanel({ refreshKey, scrapeActive, onRunScrape }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [filter, setFilter] = useState<DiscoverFilter>('matched')   // D-07 default
  const [promotingKeys, setPromotingKeys] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const [rows, health] = await Promise.all([
        window.api.readVcCompanies(),
        window.api.readVcHealth(),
      ])
      setState({ kind: 'ready', rows, firms: health.firms })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData, refreshKey])

  useEffect(() => {
    const unsub = window.api.onFilesChanged(() => { void fetchData() })
    return () => unsub()
  }, [fetchData])

  const handlePromote = useCallback(async (row: VcCompany) => {
    const key = `${row.firm}\t${row.company}`
    setPromotingKeys((prev) => new Set(prev).add(key))
    try {
      await window.api.promoteToPipeline({
        firm: row.firm,
        company: row.company,
        careersUrl: row.careers_url,
      })
      // Reload — the TSV promoted flag was flipped main-side
      await fetchData()
    } finally {
      setPromotingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [fetchData])

  // Compute derived values unconditionally (before early returns) to satisfy Rules of Hooks
  const rows = state.kind === 'ready' ? state.rows : []
  const firms = state.kind === 'ready' ? state.firms : []
  const matchedCount = useMemo(() => rows.filter(isMatched).length, [rows])
  const filtered = useMemo(
    () => filter === 'matched' ? rows.filter(isMatched) : rows,
    [filter, rows],
  )

  if (state.kind === 'loading') return <EmptyState heading="Loading VC companies…" />
  if (state.kind === 'error') return <ErrorState heading="Could not load VC data" body={state.message} onRetry={() => void fetchData()} />

  return (
    <div className="flex flex-col h-full">
      <VcDropAlertBanner firms={firms} />
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-ctp-overlay shrink-0">
        <DiscoverFilterToggle
          value={filter}
          onChange={setFilter}
          matchedCount={matchedCount}
          totalCount={rows.length}
        />
        <div className="flex items-center gap-2">
          <AddFirmButton onAdded={fetchData} />
          <button
            type="button"
            onClick={() => void onRunScrape()}
            disabled={scrapeActive}
            className="inline-flex items-center gap-1 px-3 py-1 rounded border border-ctp-overlay text-label text-ctp-text hover:bg-ctp-overlay disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
            data-testid="run-scrape-btn"
          >
            {scrapeActive ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
            <span>{scrapeActive ? 'Scanning…' : 'Run scan now'}</span>
          </button>
        </div>
      </div>
      <div className="px-3 py-2 shrink-0">
        <ScraperHealthPanel firms={firms} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          heading={filter === 'matched' ? 'No matched companies' : 'No companies yet'}
          body={rows.length === 0
            ? 'Click "Run scan now" to discover companies across the configured VC portfolios.'
            : 'Switch to All to view every scraped company, or wait for the next scrape to pick up new matches.'}
        />
      ) : (
        <div className="flex-1 min-h-0">
          <CompanyTable rows={filtered} promotingKeys={promotingKeys} onPromote={handlePromote} />
        </div>
      )}
    </div>
  )
}
