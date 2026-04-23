interface Props { signal: string; date: string }

export function FundingSignalBadge({ signal, date }: Props) {
  if (!signal) return <span className="text-ctp-subtext text-label">—</span>
  const tooltip = date ? `${signal} (${date})` : signal
  const label = signal.startsWith('Blog') ? 'Blog' : signal.startsWith('Press') ? 'Press' : 'Signal'
  return (
    <span
      className="inline-flex items-center px-1 rounded text-label font-semibold bg-ctp-green/20 text-ctp-green"
      title={tooltip}
      data-testid="funding-signal-badge"
    >
      {label}
    </span>
  )
}
