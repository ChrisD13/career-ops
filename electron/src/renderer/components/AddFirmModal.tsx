import { useEffect, useRef, useState } from 'react'

interface Props {
  onClose: () => void
  onSuccess: () => void | Promise<void>
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'probe-failed'; error: string; probeStatus?: number }
  | { kind: 'save-error'; error: string }

export function AddFirmModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [keywordsText, setKeywordsText] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const canSubmit = name.trim().length > 0 && url.trim().length > 0 && submit.kind !== 'submitting'

  const parseKeywords = (s: string): string[] =>
    s.split(',').map(k => k.trim()).filter(Boolean).slice(0, 50)

  const doSubmit = async (bypassProbe: boolean) => {
    setSubmit({ kind: 'submitting' })
    const result = await window.api.addVcFirm({
      name: name.trim(),
      portfolio_url: url.trim(),
      keywords: parseKeywords(keywordsText),
      bypassProbe,
    })
    if (result.success) { await onSuccess(); return }
    if (typeof result.probeStatus !== 'undefined' || (result.error ?? '').toLowerCase().includes('probe') || (result.error ?? '').toLowerCase().includes('url')) {
      setSubmit({ kind: 'probe-failed', error: result.error ?? 'URL verification failed', probeStatus: result.probeStatus })
    } else {
      setSubmit({ kind: 'save-error', error: result.error ?? 'Failed to save' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void doSubmit(false)
  }

  const handleSaveAnyway = () => { void doSubmit(true) }

  return (
    <div
      className="fixed inset-0 bg-ctp-crust/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Add VC Firm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="add-firm-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-ctp-surface border border-ctp-overlay rounded p-4"
        style={{ width: 480 }}
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-heading text-ctp-text">Add VC Firm</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ctp-subtext hover:text-ctp-text">×</button>
        </header>

        <label className="block mb-2">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">Name <span className="text-ctp-red">*</span></span>
          <input
            ref={firstFieldRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full mt-1 px-2 py-1 bg-ctp-base border border-ctp-overlay rounded text-body text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
            data-testid="add-firm-name"
            required
          />
        </label>

        <label className="block mb-2">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">Portfolio URL <span className="text-ctp-red">*</span></span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full mt-1 px-2 py-1 bg-ctp-base border border-ctp-overlay rounded text-body text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
            data-testid="add-firm-url"
            required
          />
        </label>

        <label className="block mb-3">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">Keywords (comma-separated, optional)</span>
          <input
            type="text"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="ai, automation, devtools"
            className="w-full mt-1 px-2 py-1 bg-ctp-base border border-ctp-overlay rounded text-body text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
            data-testid="add-firm-keywords"
          />
        </label>

        {submit.kind === 'probe-failed' && (
          <div className="mb-3 p-2 rounded bg-ctp-yellow/15 text-ctp-yellow text-body" data-testid="add-firm-probe-error">
            URL verification failed: {submit.error}
            {typeof submit.probeStatus === 'number' ? ` (status ${submit.probeStatus})` : ''}
          </div>
        )}
        {submit.kind === 'save-error' && (
          <div className="mb-3 p-2 rounded bg-ctp-red/15 text-ctp-red text-body" data-testid="add-firm-save-error">
            {submit.error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 text-label text-ctp-subtext hover:text-ctp-text">Cancel</button>
          {submit.kind === 'probe-failed' ? (
            <button
              type="button"
              onClick={handleSaveAnyway}
              className="px-3 py-1 rounded border border-ctp-yellow text-label text-ctp-yellow hover:bg-ctp-yellow/15"
              data-testid="add-firm-save-anyway"
            >
              Save anyway
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-3 py-1 rounded bg-ctp-mauve text-ctp-base text-label disabled:opacity-50 hover:bg-ctp-mauve/90"
              data-testid="add-firm-save"
            >
              {submit.kind === 'submitting' ? 'Saving…' : 'Save Firm'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
