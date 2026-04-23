import { useCallback, useEffect, useState } from 'react'
import type { ApiKeyState } from '../../preload/types'

export function useApiKeyState() {
  const [state, setState] = useState<ApiKeyState>({ hasKey: false })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const result = await window.api.checkApiKey()
    setState(result)
  }, [])

  useEffect(() => {
    void (async () => {
      await refresh()
      setLoading(false)
    })()
  }, [refresh])

  const save = useCallback(
    async (rawKey: string) => {
      const result = await window.api.saveApiKey(rawKey)
      if (result.success) await refresh()
      return result
    },
    [refresh],
  )

  const verify = useCallback(async (rawKey: string) => {
    return window.api.verifyApiKey(rawKey)
  }, [])

  return {
    hasKey: state.hasKey,
    backendWarning: state.backendWarning ?? null,
    loading,
    refresh,
    save,
    verify,
  }
}
