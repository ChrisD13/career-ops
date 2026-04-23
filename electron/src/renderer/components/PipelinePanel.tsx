import { useEffect, useState } from 'react'
import type { PipelineEntry } from '../../preload/types'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

interface Props {
  refreshKey: number
  onRunScan: () => void
  onRunBatch: () => void
  onRunMergeTracker: () => void
  onRunCheckLiveness: () => void
  onRunAnalyzePatterns: () => void
  onRunFollowupCadence: () => void
  scanActive: boolean
  batchActive: boolean
  mergeTrackerActive: boolean
  checkLivenessActive: boolean
  patternsActive: boolean
  followupActive: boolean
  hasApiKey: boolean
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: PipelineEntry[] }

export function PipelinePanel({
  refreshKey, onRunScan, onRunBatch, onRunMergeTracker, onRunCheckLiveness, onRunAnalyzePatterns, onRunFollowupCadence,
  scanActive, batchActive, mergeTrackerActive, checkLivenessActive, patternsActive, followupActive, hasApiKey,
}: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const fetchData = () => {
    let cancelled = false
    setState({ kind: 'loading' })
    window.api.readPipeline()
      .then(entries => { if (!cancelled) setState({ kind: 'ready', entries }) })
      .catch(err => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = fetchData()
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  if (state.kind === 'loading') return <EmptyState heading="Loading pipeline..." />
  if (state.kind === 'error') {
    return <ErrorState heading="Could not load pipeline" body={state.message} onRetry={fetchData} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="pipeline-panel__actions">
        <button
          type="button"
          className="pipeline-panel__action"
          onClick={onRunScan}
          disabled={scanActive}
          data-testid="pipeline-scan"
        >
          {scanActive ? 'Scanning…' : 'Scan'}
        </button>
        <button
          type="button"
          className="pipeline-panel__action pipeline-panel__action--primary"
          onClick={onRunBatch}
          disabled={batchActive || !hasApiKey}
          title={!hasApiKey ? 'Set your API key in Settings to run batch' : undefined}
          data-testid="pipeline-batch"
        >
          {batchActive ? 'Running batch…' : 'Run Batch'}
        </button>
      </div>
      <div className="pipeline-panel__actions pipeline-panel__actions--tools">
        <button
          type="button"
          className="pipeline-panel__action pipeline-panel__action--tool"
          onClick={onRunMergeTracker}
          disabled={mergeTrackerActive}
          data-testid="pipeline-merge-tracker"
          title="Merge batch/tracker additions into applications.md"
        >
          {mergeTrackerActive ? 'Merging…' : 'Merge Tracker'}
        </button>
        <button
          type="button"
          className="pipeline-panel__action pipeline-panel__action--tool"
          onClick={onRunCheckLiveness}
          disabled={checkLivenessActive}
          data-testid="pipeline-check-liveness"
          title="Check if pipeline URLs are still live job postings"
        >
          {checkLivenessActive ? 'Checking…' : 'Check Liveness'}
        </button>
        <button
          type="button"
          className="pipeline-panel__action pipeline-panel__action--tool"
          onClick={onRunAnalyzePatterns}
          disabled={patternsActive}
          data-testid="pipeline-patterns"
          title="Analyze rejection patterns (output in ops log)"
        >
          {patternsActive ? 'Analyzing…' : 'Patterns'}
        </button>
        <button
          type="button"
          className="pipeline-panel__action pipeline-panel__action--tool"
          onClick={onRunFollowupCadence}
          disabled={followupActive}
          data-testid="pipeline-followup"
          title="Show follow-up schedule for active applications (output in ops log)"
        >
          {followupActive ? 'Calculating…' : 'Follow-up Cadence'}
        </button>
      </div>
      <div className="h-9 flex items-center px-4 border-b border-ctp-overlay bg-ctp-surface sticky top-0">
        <span className="text-label text-ctp-subtext uppercase tracking-wider">
          Pipeline ({state.entries.filter(e => !e.done).length} pending)
        </span>
      </div>
      {state.entries.length === 0 ? (
        <EmptyState
          heading="Pipeline inbox is empty"
          body="Add job URLs to data/pipeline.md to see them here."
        />
      ) : (
        <ul role="list" className="divide-y divide-ctp-overlay/30 flex-1 overflow-y-auto">
          {state.entries.map((entry, i) => (
            <li
              key={`${entry.url}-${i}`}
              className={`px-4 py-2 flex flex-col gap-0.5 hover:bg-ctp-surface/50 ${entry.done ? 'opacity-50 line-through' : ''}`}
            >
              <span className="font-mono text-body text-ctp-text break-all">{entry.url}</span>
              <span className="text-label text-ctp-subtext">
                {entry.company}{entry.company && entry.role ? ' — ' : ''}{entry.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
