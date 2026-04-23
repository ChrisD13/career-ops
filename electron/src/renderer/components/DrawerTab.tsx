import type { OpLine, OpRun } from '../hooks/useOperationsLog'
import { OpBadge } from './OpBadge'

interface Props {
  ops: OpRun[]
  latestLine: OpLine | null
  onExpand: () => void
}

export function DrawerTab({ ops, latestLine, onExpand }: Props) {
  const activeCount = ops.filter((o) => o.endedAt === null).length
  const snippet = latestLine
    ? latestLine.line.length > 80
      ? latestLine.line.slice(0, 80) + '…'
      : latestLine.line
    : 'Operations'
  return (
    <button
      type="button"
      className="drawer-tab"
      onClick={onExpand}
      data-testid="drawer-tab"
      aria-label={`Operations (${activeCount} active)`}
    >
      <span className="drawer-tab__label">
        Operations {activeCount > 0 && <strong>({activeCount})</strong>}
      </span>
      <span className="drawer-tab__badges">
        {ops.slice(-3).map((op) => (
          <OpBadge key={op.runId} kind={op.kind} active={op.endedAt === null} code={op.code} />
        ))}
      </span>
      <span className="drawer-tab__snippet">{snippet}</span>
    </button>
  )
}
