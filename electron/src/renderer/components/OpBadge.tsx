interface Props {
  kind: 'scan' | 'batch' | 'pdf' | 'scrape'
  active: boolean
  code?: number | null
}

const LABELS: Record<string, string> = { scan: 'Scan', batch: 'Batch', pdf: 'PDF', scrape: 'VC Scrape' }

export function OpBadge({ kind, active, code }: Props) {
  const state = active ? 'active' : code === 0 ? 'ok' : code !== null && code !== undefined ? 'fail' : 'idle'
  return (
    <span
      className={`op-badge op-badge--${kind} op-badge--${state}`}
      data-testid="op-badge"
      data-kind={kind}
      data-state={state}
    >
      {LABELS[kind]}
    </span>
  )
}
