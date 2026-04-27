import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { PdfToast } from './PdfToast'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { CvUploadModal } from './CvUploadModal'
import { CvConfirmModal } from './CvConfirmModal'
import { InlineErrorBanner } from './InlineErrorBanner'

type ToastState =
  | { variant: 'pending'; message: string; at: number; runId: string }
  | { variant: 'success'; message: string; at: number; runId?: string }
  | { variant: 'error'; message: string; at: number; runId?: string }
  | null

interface Props {
  onGenerateLatex: () => Promise<void>
  latexActive: boolean
}

export function CvPanel({ onGenerateLatex, latexActive }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  // Phase 8 — upload flow state machine (PATTERNS.md §"State additions")
  type UploadStage =
    | { kind: 'idle' }
    | { kind: 'opening' }
    | { kind: 'review'; content: string }
    | { kind: 'confirm'; content: string; mtimeIso: string | null; saving: boolean; errorMessage: string | null }
    | { kind: 'error'; message: string }

  const [upload, setUpload] = useState<UploadStage>({ kind: 'idle' })

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

  const handleUpdateCv = async () => {
    setUpload({ kind: 'opening' })
    const picked = await window.api.openCvFilePicker()
    if (picked.cancelled) {
      setUpload({ kind: 'idle' })
      return
    }
    if (picked.error) {
      setUpload({ kind: 'error', message: picked.error })
      return
    }
    if (picked.type === 'md') {
      // .md flow: skip review, fetch mtime AT confirm-open (Pitfall §8), go to confirm
      const { mtimeIso } = await window.api.getCvMtime()
      setUpload({
        kind: 'confirm',
        content: picked.content ?? '',
        mtimeIso,
        saving: false,
        errorMessage: null,
      })
    } else if (picked.type === 'pdf') {
      setUpload({ kind: 'review', content: picked.content ?? '' })
    } else {
      setUpload({ kind: 'error', message: 'Unsupported file type. Choose a .md or .pdf file.' })
    }
  }

  const handleReviewContinue = async (editedContent: string) => {
    // Pitfall §8 — fetch mtime AT confirm-modal-open
    const { mtimeIso } = await window.api.getCvMtime()
    setUpload({
      kind: 'confirm',
      content: editedContent,
      mtimeIso,
      saving: false,
      errorMessage: null,
    })
  }

  const handleConfirmReplace = async () => {
    if (upload.kind !== 'confirm') return
    const contentToWrite = upload.content
    setUpload({ ...upload, saving: true, errorMessage: null })
    const result = await window.api.updateCv(contentToWrite)
    if (result.success) {
      setUpload({ kind: 'idle' })
      await load()
    } else {
      setUpload({
        kind: 'confirm',
        content: contentToWrite,
        mtimeIso: upload.mtimeIso,
        saving: false,
        errorMessage: result.error ?? 'Failed to save CV. Check permissions and try again.',
      })
    }
  }

  if (error) return <ErrorState heading="Could not load CV" body={error} onRetry={load} />
  if (markdown === null) return <EmptyState heading="Loading CV..." />

  return (
    <section className="cv-panel" data-testid="cv-panel">
      <header className="cv-panel__header">
        <h2 className="cv-panel__title">CV</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUpdateCv}
            disabled={upload.kind !== 'idle' && upload.kind !== 'error'}
            className="bg-ctp-overlay text-ctp-text border border-ctp-overlay rounded px-3 py-1 text-label hover:bg-ctp-overlay/70 disabled:opacity-50"
            data-testid="cv-update-btn"
          >
            {upload.kind === 'opening' ? 'Opening…' : 'Update CV'}
          </button>
          <button
            type="button"
            className="cv-panel__regenerate"
            onClick={handleRegenerate}
            disabled={toast?.variant === 'pending'}
          >
            {toast?.variant === 'pending' ? 'Regenerating…' : 'Regenerate PDF'}
          </button>
          <button
            type="button"
            className="cv-panel__regenerate"
            onClick={onGenerateLatex}
            disabled={latexActive}
            title="Export CV as LaTeX (.tex) for Overleaf"
          >
            {latexActive ? 'Exporting…' : 'Export LaTeX'}
          </button>
        </div>
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
      {upload.kind === 'review' && (
        <CvUploadModal
          initialContent={upload.content}
          onCancel={() => setUpload({ kind: 'idle' })}
          onContinue={handleReviewContinue}
        />
      )}
      {upload.kind === 'confirm' && (
        <CvConfirmModal
          mtimeIso={upload.mtimeIso}
          saving={upload.saving}
          errorMessage={upload.errorMessage}
          onCancel={() => setUpload({ kind: 'idle' })}
          onReplace={handleConfirmReplace}
        />
      )}
      {upload.kind === 'error' && (
        <InlineErrorBanner
          message={upload.message}
          onDismiss={() => setUpload({ kind: 'idle' })}
        />
      )}
    </section>
  )
}
