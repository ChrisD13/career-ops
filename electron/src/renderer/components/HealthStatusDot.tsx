interface Props { status: 'OK' | 'Stale' | 'Error'; reason?: string }

const COLORS = { OK: 'bg-ctp-green', Stale: 'bg-ctp-yellow', Error: 'bg-ctp-red' } as const

export function HealthStatusDot({ status, reason }: Props) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${COLORS[status]}`}
      title={reason ? `${status}: ${reason}` : status}
      aria-label={status}
      data-testid="health-status-dot"
      data-status={status}
    />
  )
}
