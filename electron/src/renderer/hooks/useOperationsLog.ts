import { useCallback, useEffect, useState } from 'react'
import type { OpOutputPayload, OpDonePayload } from '../../preload/types'

export interface OpLine extends OpOutputPayload {}
export interface OpRun {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | 'scrape'
  startedAt: number
  endedAt: number | null
  code: number | null
  signal: string | null
  lineCount: number
}

const MAX_LINES = 500
const MAX_OPS = 10

export function useOperationsLog() {
  const [ops, setOps] = useState<OpRun[]>([])
  const [lines, setLines] = useState<OpLine[]>([])
  const [lastCleanExitAt, setLastCleanExitAt] = useState<number | null>(null)

  useEffect(() => {
    const unsubOutput = window.api.onOperationOutput((payload: OpOutputPayload) => {
      setLines((prev) => {
        const next = prev.length >= MAX_LINES
          ? [...prev.slice(prev.length - MAX_LINES + 1), payload]
          : [...prev, payload]
        return next
      })
      setOps((prev) => {
        // Ensure an OpRun exists for this runId
        const idx = prev.findIndex((o) => o.runId === payload.runId)
        if (idx === -1) {
          const newOp: OpRun = {
            runId: payload.runId,
            kind: payload.kind,
            startedAt: payload.ts,
            endedAt: null,
            code: null,
            signal: null,
            lineCount: 1,
          }
          const next = [...prev, newOp]
          return next.length > MAX_OPS ? next.slice(next.length - MAX_OPS) : next
        }
        const updated = { ...prev[idx], lineCount: prev[idx].lineCount + 1 }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
    })

    const unsubDone = window.api.onOperationDone((payload: OpDonePayload) => {
      setOps((prev) => {
        const idx = prev.findIndex((o) => o.runId === payload.runId)
        if (idx === -1) return prev
        const updated: OpRun = {
          ...prev[idx],
          endedAt: Date.now(),
          code: payload.code,
          signal: payload.signal,
        }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
      if (payload.code === 0) {
        setLastCleanExitAt(Date.now())
      }
    })

    return () => {
      unsubOutput()
      unsubDone()
    }
  }, [])

  const hasActive = ops.some((o) => o.endedAt === null)

  const clear = useCallback(() => {
    setOps([])
    setLines([])
    setLastCleanExitAt(null)
  }, [])

  return { ops, lines, hasActive, lastCleanExitAt, clear }
}
