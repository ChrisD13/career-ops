import { useState } from 'react'

interface Props {
  onVerify: () => Promise<{ ok: boolean; error?: string }>
}

export function VerifyButton({ onVerify }: Props) {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const handleClick = async () => {
    setStatus('verifying')
    setMessage(null)
    const result = await onVerify()
    if (result.ok) {
      setStatus('ok')
      setMessage('Verified — key works with Anthropic API.')
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Verification failed.')
    }
  }

  return (
    <div className="settings-verify">
      <button
        type="button"
        className="settings-verify__button"
        onClick={handleClick}
        disabled={status === 'verifying'}
        data-testid="verify-button"
      >
        {status === 'verifying' ? 'Verifying…' : 'Verify Key'}
      </button>
      {message && (
        <div className={`settings-verify__message settings-verify__message--${status}`}>
          {status === 'ok' ? '✓ ' : status === 'error' ? '✗ ' : ''}
          {message}
        </div>
      )}
    </div>
  )
}
