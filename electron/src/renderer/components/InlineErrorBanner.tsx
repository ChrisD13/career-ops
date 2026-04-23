interface Props {
  message: string
  retryAfter?: string
  onDismiss: () => void
}

export function InlineErrorBanner({ message, retryAfter, onDismiss }: Props) {
  return (
    <div className="inline-error-banner" role="alert" data-testid="inline-error-banner">
      <div className="inline-error-banner__body">
        <span className="inline-error-banner__message">{message}</span>
        {retryAfter && (
          <span className="inline-error-banner__meta">retry after {retryAfter}s</span>
        )}
      </div>
      <button
        type="button"
        className="inline-error-banner__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  )
}
