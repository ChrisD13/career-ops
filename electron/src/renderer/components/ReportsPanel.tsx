import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ReportViewer } from './ReportViewer'

const FILENAME_RE = /^(\d+)-(.+)-(\d{4}-\d{2}-\d{2})\.md$/

interface ParsedName {
  filename: string
  num: string
  slug: string
  date: string
}

function parseFilename(filename: string): ParsedName {
  const m = FILENAME_RE.exec(filename)
  if (!m) return { filename, num: '', slug: filename.replace(/\.md$/, ''), date: '' }
  return { filename, num: m[1], slug: m[2], date: m[3] }
}

interface Props {
  refreshKey: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; filenames: string[] }

export function ReportsPanel({ refreshKey }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    window.api.listReports()
      .then(filenames => {
        if (cancelled) return
        setState({ kind: 'ready', filenames })
        // Preserve selection if still valid; otherwise clear
        if (selected && !filenames.includes(selected)) setSelected(null)
      })
      .catch(err => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const parsed = useMemo(
    () => state.kind === 'ready' ? state.filenames.map(parseFilename) : [],
    [state],
  )

  if (state.kind === 'loading') return <EmptyState heading="Loading reports..." />
  if (state.kind === 'error') {
    return (
      <ErrorState
        heading="Could not list reports"
        body={state.message}
      />
    )
  }
  if (state.filenames.length === 0) {
    return (
      <EmptyState
        heading="No reports yet"
        body="Evaluation reports from reports/*.md will appear here once you run your first evaluation."
      />
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="w-72 shrink-0 flex flex-col border-r border-ctp-overlay overflow-y-auto bg-ctp-surface/50">
        <div className="h-9 flex items-center px-3 border-b border-ctp-overlay shrink-0">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">Reports ({parsed.length})</span>
        </div>
        <ul role="list" className="flex flex-col">
          {parsed.map(p => {
            const active = p.filename === selected
            const activeClasses = active
              ? 'border-l-[3px] border-ctp-blue bg-ctp-overlay text-ctp-text'
              : 'border-l-[3px] border-transparent text-ctp-subtext hover:bg-ctp-surface hover:text-ctp-text'
            return (
              <li key={p.filename}>
                <button
                  type="button"
                  onClick={() => setSelected(p.filename)}
                  className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 ${activeClasses} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset`}
                >
                  <span className="text-body">
                    {p.num && <span className="text-ctp-subtext mr-1">#{p.num}</span>}
                    {p.slug || p.filename}
                  </span>
                  {p.date && <span className="text-label text-ctp-subtext">{p.date}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {selected
          ? <ReportViewer path={`reports/${selected}`} refreshKey={refreshKey} />
          : (
            <EmptyState
              heading="Select a report to read it"
              body="Choose any evaluation report from the list on the left."
            />
          )}
      </div>
    </div>
  )
}
