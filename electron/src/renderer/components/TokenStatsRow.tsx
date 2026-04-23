import type { EvaluationUsage } from '../../preload/types'

interface Props {
  usage: EvaluationUsage | null
  costUsd: number | null
  status: 'streaming' | 'done' | 'idle'
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function fmtCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

export function TokenStatsRow({ usage, costUsd, status }: Props) {
  if (!usage) return null
  return (
    <div className="token-stats" data-status={status} data-testid="token-stats">
      <div className="token-stats__cell">
        <span className="token-stats__label">Input</span>
        <span className="token-stats__value">{fmt(usage.input_tokens)}</span>
      </div>
      <div className="token-stats__cell">
        <span className="token-stats__label">Output</span>
        <span className="token-stats__value">{fmt(usage.output_tokens)}</span>
      </div>
      <div className="token-stats__cell">
        <span className="token-stats__label">Cache Read</span>
        <span className="token-stats__value">{fmt(usage.cache_read_input_tokens)}</span>
      </div>
      <div className="token-stats__cell">
        <span className="token-stats__label">Cache Write</span>
        <span className="token-stats__value">{fmt(usage.cache_creation_input_tokens)}</span>
      </div>
      <div className="token-stats__cell">
        <span className="token-stats__label">Cost</span>
        <span className="token-stats__value">
          {costUsd !== null ? fmtCost(costUsd) : '—'}
        </span>
      </div>
    </div>
  )
}
