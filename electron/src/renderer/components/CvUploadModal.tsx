import { useEffect, useRef, useState } from 'react'

interface Props {
  initialContent: string
  onCancel: () => void
  onContinue: (editedContent: string) => void
}

export function CvUploadModal({ initialContent, onCancel, onContinue }: Props) {
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onContinue(content)
  }

  return (
    <div
      className="fixed inset-0 bg-ctp-crust/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Review Extracted CV"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      data-testid="cv-upload-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-ctp-surface border border-ctp-overlay rounded p-4"
        style={{ width: 600 }}
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-heading text-ctp-text">Review Extracted CV</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-ctp-subtext hover:text-ctp-text">×</button>
        </header>

        <label className="block mb-3">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">
            Extracted Markdown — edit before saving
          </span>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full mt-1 px-2 py-2 bg-ctp-base border border-ctp-overlay rounded text-body text-ctp-text font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay"
            style={{ minHeight: 320 }}
            data-testid="cv-upload-textarea"
            spellCheck={false}
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-label text-ctp-subtext hover:text-ctp-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded bg-ctp-overlay text-ctp-text text-label hover:bg-ctp-overlay/70"
            data-testid="cv-upload-continue"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
