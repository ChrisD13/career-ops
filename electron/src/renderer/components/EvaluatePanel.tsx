import { useState, type KeyboardEvent } from 'react'
import { StreamingReportView } from './StreamingReportView'
import { TokenStatsRow } from './TokenStatsRow'
import { InlineErrorBanner } from './InlineErrorBanner'
import { ApiKeyBanner } from './ApiKeyBanner'
import { useEvaluationStream } from '../hooks/useEvaluationStream'

interface Props {
  hasKey: boolean
  backendWarning: string | null
  onOpenSettings: () => void
}

export function EvaluatePanel({ hasKey, backendWarning, onOpenSettings }: Props) {
  const [url, setUrl] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)
  const { state, start, stop } = useEvaluationStream()

  const isStreaming = state.status === 'streaming'
  const canStart = hasKey && url.trim().length > 0 && !isStreaming

  const handleClick = async () => {
    if (isStreaming) {
      await stop()
      return
    }
    if (!canStart) return
    setErrorDismissed(false)
    await start(url.trim())
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canStart) {
      void handleClick()
    }
  }

  const showError = state.status === 'error' && state.error && !errorDismissed

  return (
    <section className="evaluate-panel" data-testid="evaluate-panel">
      <header className="evaluate-panel__header">
        <h2 className="evaluate-panel__title">Evaluate</h2>
        <div className="evaluate-panel__controls">
          <input
            type="url"
            className="evaluate-panel__url"
            placeholder="Paste a job URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            aria-label="Job URL"
          />
          <button
            type="button"
            className="evaluate-panel__go"
            onClick={handleClick}
            disabled={!hasKey || (!canStart && !isStreaming)}
            data-status={state.status}
          >
            {isStreaming ? 'Stop Evaluation' : 'Evaluate'}
          </button>
        </div>
      </header>

      {!hasKey && (
        <ApiKeyBanner variant="missing" onOpenSettings={onOpenSettings} />
      )}
      {hasKey && backendWarning && (
        <ApiKeyBanner
          variant="backend-warning"
          message={backendWarning}
          onOpenSettings={onOpenSettings}
        />
      )}

      {showError && state.error && (
        <InlineErrorBanner
          message={state.error.message}
          retryAfter={state.error.retryAfter}
          onDismiss={() => setErrorDismissed(true)}
        />
      )}

      <StreamingReportView markdown={state.markdown} status={state.status} />

      {state.usage && (
        <TokenStatsRow
          usage={state.usage}
          costUsd={state.costUsd}
          status={isStreaming ? 'streaming' : 'done'}
        />
      )}
    </section>
  )
}
