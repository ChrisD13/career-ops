import { useEffect, useRef, useState } from 'react'
import { useApiKeyState } from '../hooks/useApiKeyState'
import { ApiKeyField } from './ApiKeyField'
import { VerifyButton } from './VerifyButton'
import { ModelSelect } from './ModelSelect'
import { ApiKeyBanner } from './ApiKeyBanner'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsSlideOver({ open, onClose }: Props) {
  const { hasKey, backendWarning, save, verify } = useApiKeyState()
  const [lastSavedKey, setLastSavedKey] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSave = async (rawKey: string) => {
    const result = await save(rawKey)
    if (result.success) setLastSavedKey(rawKey)
    return result
  }

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      data-testid="settings-overlay"
    >
      <div className="settings-panel" ref={panelRef}>
        <header className="settings-panel__header">
          <h2 className="settings-panel__title">Settings</h2>
          <button
            type="button"
            className="settings-panel__close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>
        <div className="settings-panel__body">
          {backendWarning && (
            <ApiKeyBanner variant="backend-warning" message={backendWarning} />
          )}
          <ApiKeyField onSave={handleSave} hasKey={hasKey} />
          {(hasKey || lastSavedKey) && (
            <VerifyButton onVerify={() => verify(lastSavedKey ?? '')} />
          )}
          <ModelSelect />
        </div>
      </div>
    </div>
  )
}
