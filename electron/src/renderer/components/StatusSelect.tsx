import type { StatusEntry } from '../../preload/types'

interface Props {
  statuses: StatusEntry[]
  currentStatus: string          // canonical id like 'applied' — matched against StatusEntry.id
}

export function StatusSelect({ statuses, currentStatus }: Props) {
  const normalized = (currentStatus ?? '').trim().toLowerCase()
  const selected = statuses.find(s => s.id === normalized)?.id ?? statuses[0]?.id ?? ''
  return (
    <select
      disabled
      defaultValue={selected}
      title="Status editing available in Phase 2"
      aria-label="Status (Phase 2: editing enabled)"
      className="h-7 px-2 bg-ctp-overlay/30 border border-ctp-overlay text-ctp-subtext text-body rounded cursor-not-allowed opacity-60 focus-visible:outline-none"
    >
      {statuses.map(s => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  )
}
