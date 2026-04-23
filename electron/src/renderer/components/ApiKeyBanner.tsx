interface Props {
  variant: 'missing' | 'backend-warning'
  message?: string
  onOpenSettings?: () => void
}

const COPY = {
  missing: 'No API key configured. Add one in Settings to evaluate job URLs.',
  'backend-warning': 'OS keyring unavailable — your API key is stored with weak protection.',
}

export function ApiKeyBanner({ variant, message, onOpenSettings }: Props) {
  return (
    <div
      className={`api-key-banner api-key-banner--${variant}`}
      role="status"
      data-testid="api-key-banner"
      data-variant={variant}
    >
      <span className="api-key-banner__icon" aria-hidden="true">
        {variant === 'missing' ? '🔑' : '⚠'}
      </span>
      <span className="api-key-banner__text">{message ?? COPY[variant]}</span>
      {onOpenSettings && (
        <button
          type="button"
          className="api-key-banner__action"
          onClick={onOpenSettings}
        >
          Open Settings
        </button>
      )}
    </div>
  )
}
