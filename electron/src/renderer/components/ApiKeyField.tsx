import { useState } from 'react'

interface Props {
  onSave: (rawKey: string) => Promise<{ success: boolean; error?: string; warning?: string }>
  hasKey: boolean
}

export function ApiKeyField({ onSave, hasKey }: Props) {
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const valid = /^sk-ant-/.test(value)

  const handleSave = async () => {
    if (!valid) return
    setStatus('saving')
    setMessage(null)
    const result = await onSave(value)
    if (result.success) {
      setStatus('ok')
      setMessage(result.warning ?? 'Saved.')
      setValue('')
    } else {
      setStatus('error')
      setMessage(result.error ?? 'Failed to save.')
    }
  }

  return (
    <div className="settings-field">
      <label className="settings-field__label">Anthropic API Key</label>
      <div className="settings-field__help">
        {hasKey ? 'A key is saved. Enter a new one to replace it.' : 'Starts with sk-ant-'}
      </div>
      <div className="settings-field__row">
        <input
          type={reveal ? 'text' : 'password'}
          className="settings-field__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-..."
          aria-label="Anthropic API Key"
          data-testid="api-key-input"
        />
        <button
          type="button"
          className="settings-field__toggle"
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Hide key' : 'Show key'}
        >
          {reveal ? '🙈' : '👁'}
        </button>
        <button
          type="button"
          className="settings-field__save"
          onClick={handleSave}
          disabled={!valid || status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {message && (
        <div className={`settings-field__message settings-field__message--${status}`}>
          {message}
        </div>
      )}
    </div>
  )
}
