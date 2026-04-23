import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { PdfToast } from './PdfToast'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

type ToastState =
  | { variant: 'pending'; message: string; at: number; runId: string }
  | { variant: 'success'; message: string; at: number; runId?: string }
  | { variant: 'error'; message: string; at: number; runId?: string }
  | null

export function CvPanel() {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const load = async () => {
    try {
      const text = await window.api.readCv()
      setMarkdown(text)
      setError(null)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to read cv.md')
    }
  }

  useEffect(() => {
    void load()
    const unsubFiles = window.api.onFilesChanged(() => { void load() })
    return () => unsubFiles()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsub = window.api.onOperationDone((payload) => {
      setToast((current) => {
        if (!current || current.variant !== 'pending') return current
        if (current.runId !== payload.runId) return current
        if (payload.kind !== 'pdf') return current
        if (payload.code === 0) {
          return { variant: 'success', message: 'PDF regenerated', at: Date.now() }
        }
        return {
          variant: 'error',
          message: `PDF generation failed (exit ${payload.code ?? 'unknown'})`,
          at: Date.now(),
        }
      })
    })
    return () => unsub()
  }, [])

  const handleRegenerate = async () => {
    setToast({
      variant: 'pending',
      message: 'Regenerating PDF...',
      at: Date.now(),
      runId: '', // filled in below
    })
    const { runId } = await window.api.regeneratePDF()
    setToast((t) => (t && t.variant === 'pending') ? { ...t, runId } : t)
  }

  if (error) return <ErrorState heading="Could not load CV" body={error} onRetry={load} />
  if (markdown === null) return <EmptyState heading="Loading CV..." />

  return (
    <section className="cv-panel" data-testid="cv-panel">
      <header className="cv-panel__header">
        <h2 className="cv-panel__title">CV</h2>
        <button
          type="button"
          className="cv-panel__regenerate"
          onClick={handleRegenerate}
          disabled={toast?.variant === 'pending'}
        >
          {toast?.variant === 'pending' ? 'Regenerating…' : 'Regenerate PDF'}
        </button>
      </header>
      <div className="cv-panel__body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {markdown}
        </ReactMarkdown>
      </div>
      {toast && (
        <PdfToast
          variant={toast.variant}
          message={toast.message}
          at={toast.at}
          onDismiss={() => setToast(null)}
        />
      )}
    </section>
  )
}
