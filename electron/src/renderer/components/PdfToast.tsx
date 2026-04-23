import { useEffect, useState } from 'react'

type Variant = 'pending' | 'success' | 'error'

interface Props {
  variant: Variant
  message: string
  at: number | null
  autoDismissMs?: number
  onDismiss: () => void
}

export function PdfToast({ variant, message, at, autoDismissMs, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (at === null) { setVisible(false); return }
    setVisible(true)
    if (variant === 'pending') return // only auto-dismiss finite states
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, autoDismissMs ?? 3000)
    return () => clearTimeout(timer)
  }, [at, variant, autoDismissMs, onDismiss])

  if (!visible) return null

  const icon = variant === 'pending' ? '⏳' : variant === 'success' ? '✓' : '✗'

  return (
    <div
      className={`pdf-toast pdf-toast--${variant}`}
      role="status"
      data-testid="pdf-toast"
      data-variant={variant}
      onClick={() => { setVisible(false); onDismiss() }}
    >
      <span className="pdf-toast__icon" aria-hidden="true">{icon}</span>
      <span className="pdf-toast__message">{message}</span>
    </div>
  )
}
