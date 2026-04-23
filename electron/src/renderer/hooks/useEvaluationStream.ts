import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EvaluationUsage,
  EvaluationDonePayload,
  EvaluationErrorPayload,
} from '../../preload/types'

export interface EvaluationState {
  status: 'idle' | 'streaming' | 'done' | 'cancelled' | 'error'
  markdown: string
  usage: EvaluationUsage | null
  costUsd: number | null
  model: string | null
  stopReason: string | null
  error: EvaluationErrorPayload | null
}

const INITIAL: EvaluationState = {
  status: 'idle',
  markdown: '',
  usage: null,
  costUsd: null,
  model: null,
  stopReason: null,
  error: null,
}

export function useEvaluationStream() {
  const [state, setState] = useState<EvaluationState>(INITIAL)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const unsubToken = window.api.onEvaluationToken((delta: string) => {
      setState((prev) => ({ ...prev, markdown: prev.markdown + delta }))
    })
    const unsubDone = window.api.onEvaluationDone((payload: EvaluationDonePayload) => {
      setState((prev) => ({
        ...prev,
        status: 'done',
        usage: payload.usage,
        costUsd: payload.costUsd,
        model: payload.model,
        stopReason: payload.stopReason,
      }))
    })
    const unsubError = window.api.onEvaluationError((payload: EvaluationErrorPayload) => {
      setState((prev) => ({ ...prev, status: 'error', error: payload }))
    })
    const unsubCancelled = window.api.onEvaluationCancelled(() => {
      setState((prev) => ({ ...prev, status: 'cancelled' }))
    })
    return () => {
      unsubToken()
      unsubDone()
      unsubError()
      unsubCancelled()
    }
  }, [])

  const start = useCallback(async (url: string) => {
    setState({ ...INITIAL, status: 'streaming' })
    const result = await window.api.evaluateUrl(url)
    if ('error' in result && result.error) {
      setState({
        ...INITIAL,
        status: 'error',
        error: {
          message:
            result.error === 'no-api-key'
              ? 'No API key configured. Open Settings (gear icon) to add one.'
              : result.error,
        },
      })
    }
  }, [])

  const stop = useCallback(async () => {
    await window.api.cancelEvaluation()
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL)
  }, [])

  return { state, start, stop, reset }
}
