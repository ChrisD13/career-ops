const STATUS_COLOR: Record<string, string> = {
  evaluated: 'bg-ctp-mauve text-ctp-base',
  applied:   'bg-ctp-sky text-ctp-base',
  responded: 'bg-ctp-sky text-ctp-base',
  interview: 'bg-ctp-peach text-ctp-base',
  offer:     'bg-ctp-peach text-ctp-base',
  rejected:  'bg-ctp-overlay text-ctp-subtext',
  discarded: 'bg-ctp-overlay text-ctp-subtext',
  skip:      'bg-ctp-overlay text-ctp-subtext',
}

const STATUS_LABEL: Record<string, string> = {
  evaluated: 'Evaluated',
  applied:   'Applied',
  responded: 'Responded',
  interview: 'Interview',
  offer:     'Offer',
  rejected:  'Rejected',
  discarded: 'Discarded',
  skip:      'SKIP',
}

interface Props {
  status: string
}

export function StatusBadge({ status }: Props) {
  const id = (status ?? '').trim().toLowerCase()
  const classes = STATUS_COLOR[id] ?? 'bg-ctp-overlay text-ctp-subtext'
  const label = STATUS_LABEL[id] ?? status
  return (
    <span className={`inline-flex items-center px-1 rounded text-label font-semibold ${classes}`}>
      {label}
    </span>
  )
}
