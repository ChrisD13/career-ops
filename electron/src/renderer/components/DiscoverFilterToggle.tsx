export type DiscoverFilter = 'matched' | 'all'

interface Props {
  value: DiscoverFilter
  onChange: (v: DiscoverFilter) => void
  matchedCount: number
  totalCount: number
}

export function DiscoverFilterToggle({ value, onChange, matchedCount, totalCount }: Props) {
  return (
    <div role="radiogroup" aria-label="Filter" className="inline-flex rounded border border-ctp-overlay overflow-hidden">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'matched'}
        onClick={() => onChange('matched')}
        className={`px-3 py-1 text-label ${value === 'matched' ? 'bg-ctp-mauve text-ctp-base' : 'bg-ctp-surface text-ctp-subtext hover:text-ctp-text'}`}
        data-testid="filter-toggle-matched"
      >
        Matched ({matchedCount})
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'all'}
        onClick={() => onChange('all')}
        className={`px-3 py-1 text-label ${value === 'all' ? 'bg-ctp-mauve text-ctp-base' : 'bg-ctp-surface text-ctp-subtext hover:text-ctp-text'}`}
        data-testid="filter-toggle-all"
      >
        All ({totalCount})
      </button>
    </div>
  )
}
