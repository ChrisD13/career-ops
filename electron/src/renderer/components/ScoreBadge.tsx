interface Props {
  score: number | null
  raw: string
}

export function ScoreBadge({ score, raw }: Props) {
  let classes = 'bg-ctp-overlay text-ctp-subtext'
  let display = raw || '—'
  if (score !== null) {
    if (score >= 4.0) classes = 'bg-ctp-green text-ctp-base'
    else if (score >= 2.5) classes = 'bg-ctp-yellow text-ctp-base'
    else classes = 'bg-ctp-red text-ctp-base'
    display = score.toFixed(1)
  }
  return (
    <span className={`inline-flex items-center justify-center px-1 rounded text-label font-semibold ${classes}`}>
      {display}
    </span>
  )
}
