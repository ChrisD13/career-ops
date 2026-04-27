import { useEffect } from 'react'

interface Props {
  mtimeIso: string | null
  saving: boolean
  errorMessage: string | null
  onCancel: () => void
  onReplace: () => void
}

function formatMtime(iso: string | null): string {
  if (!iso) return 'never (file does not exist)'
  return iso.slice(0, 16).replace('T', ' ')
}

export function CvConfirmModal({ mtimeIso, saving, errorMessage, onCancel, onReplace }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel, saving])

  return (
    <div
      className="fixed inset-0 bg-ctp-crust/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Replace cv.md?"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel() }}
      data-testid="cv-confirm-modal"
    >
      <div
        className="bg-ctp-surface border border-ctp-overlay rounded p-4"
        style={{ width: 400 }}
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-heading text-ctp-text">Replace cv.md?</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="text-ctp-subtext hover:text-ctp-text disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <p className="text-body text-ctp-text mb-1">
          This will overwrite your current CV.
        </p>
        <p className="text-body text-ctp-subtext mb-4" data-testid="cv-confirm-mtime">
          Last modified: {formatMtime(mtimeIso)}
        </p>

        {errorMessage && (
          <div className="mb-3 p-2 rounded bg-ctp-red/15 text-ctp-red text-body" data-testid="cv-confirm-error">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1 text-label text-ctp-subtext hover:text-ctp-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReplace}
            disabled={saving}
            className="px-3 py-1 rounded bg-ctp-mauve text-ctp-base text-label disabled:opacity-50 hover:bg-ctp-mauve/90"
            data-testid="cv-confirm-replace"
          >
            {saving ? 'Saving…' : 'Replace'}
          </button>
        </div>
      </div>
    </div>
  )
}
