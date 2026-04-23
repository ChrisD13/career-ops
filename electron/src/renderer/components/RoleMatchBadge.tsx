interface Props { matches: string }

export function RoleMatchBadge({ matches }: Props) {
  if (!matches) return <span className="text-ctp-subtext text-label">—</span>
  const list = matches.split(',').map((s) => s.trim()).filter(Boolean)
  const count = list.length
  return (
    <span
      className="inline-flex items-center px-1 rounded text-label font-semibold bg-ctp-sky/20 text-ctp-sky"
      title={list.join(', ')}
      data-testid="role-match-badge"
    >
      {count} match{count === 1 ? '' : 'es'}
    </span>
  )
}
