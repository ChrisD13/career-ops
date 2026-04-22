import { useEffect, useState } from 'react'

interface Props {
  message: string
  /** Timestamp (ms) used as key to retrigger animation; null when hidden. */
  at: number | null
  durationMs?: number
  onDismiss: () => void
}

export function StatusUpdateToast({ message, at, durationMs = 2500, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (at === null) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [at, durationMs, onDismiss])

  if (!visible) return null

  return (
    <div
      className="status-toast fixed bottom-6 right-6 px-4 py-2 bg-ctp-green text-ctp-base rounded shadow-lg text-body font-semibold cursor-pointer z-50"
      role="status"
      data-testid="status-toast"
      onClick={() => {
        setVisible(false)
        onDismiss()
      }}
    >
      {message}
    </div>
  )
}
