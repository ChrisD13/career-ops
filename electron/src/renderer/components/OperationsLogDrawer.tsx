import { useEffect, useRef, useState } from 'react'
import { DrawerTab } from './DrawerTab'
import { OpBadge } from './OpBadge'
import type { OpLine, OpRun } from '../hooks/useOperationsLog'

interface Props {
  ops: OpRun[]
  lines: OpLine[]
  hasActive: boolean
  lastCleanExitAt: number | null
  onClear: () => void
}

const DEFAULT_HEIGHT = 240
const MIN_HEIGHT = 120
const MAX_HEIGHT = 480
const AUTO_COLLAPSE_MS = 5000

export function OperationsLogDrawer({
  ops, lines, hasActive, lastCleanExitAt, onClear,
}: Props) {
  const [state, setState] = useState<'collapsed' | 'expanded'>('collapsed')
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [dragging, setDragging] = useState(false)
  const bodyRef = useRef<HTMLPreElement>(null)
  const autoCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-expand when the first op starts (D-10)
  useEffect(() => {
    if (hasActive && state === 'collapsed') {
      setState('expanded')
    }
  }, [hasActive, state])

  // Auto-collapse 5s after a clean exit with no remaining active ops (D-10)
  useEffect(() => {
    if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current)
    if (lastCleanExitAt && !hasActive && state === 'expanded') {
      autoCollapseTimer.current = setTimeout(() => {
        setState('collapsed')
      }, AUTO_COLLAPSE_MS)
    }
    return () => {
      if (autoCollapseTimer.current) clearTimeout(autoCollapseTimer.current)
    }
  }, [lastCleanExitAt, hasActive, state])

  // Auto-scroll on new lines if near bottom
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (state !== 'expanded') return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [lines, state])

  // Drag-to-resize
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const h = window.innerHeight - e.clientY
      setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h)))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  if (state === 'collapsed') {
    return (
      <DrawerTab
        ops={ops}
        latestLine={lines[lines.length - 1] ?? null}
        onExpand={() => setState('expanded')}
      />
    )
  }

  return (
    <div
      className="ops-drawer"
      style={{ height: `${height}px` }}
      data-testid="ops-drawer"
    >
      <div
        className="ops-drawer__handle"
        onMouseDown={() => setDragging(true)}
        aria-label="Resize operations drawer"
      />
      <header className="ops-drawer__header">
        <div className="ops-drawer__badges">
          {ops.map((op) => (
            <OpBadge key={op.runId} kind={op.kind} active={op.endedAt === null} code={op.code} />
          ))}
        </div>
        <div className="ops-drawer__actions">
          <button type="button" className="ops-drawer__clear" onClick={onClear}>Clear</button>
          <button
            type="button"
            className="ops-drawer__close"
            onClick={() => setState('collapsed')}
            aria-label="Collapse operations drawer"
          >×</button>
        </div>
      </header>
      <pre className="ops-drawer__body" ref={bodyRef} data-testid="ops-drawer-body">
        {lines.map((l, i) => (
          <div
            key={`${l.runId}-${l.ts}-${i}`}
            className={`ops-drawer__line ops-drawer__line--${l.stream}`}
          >
            <span className="ops-drawer__ts">
              {new Date(l.ts).toLocaleTimeString()}
            </span>
            <span className="ops-drawer__kind">[{l.kind}]</span>
            <span className="ops-drawer__text">{l.line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
