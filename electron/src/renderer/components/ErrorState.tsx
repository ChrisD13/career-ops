import { AlertCircle } from 'lucide-react'

interface Props {
  heading: string
  body?: string
  onRetry?: () => void
}

export function ErrorState({ heading, body, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertCircle size={24} aria-hidden="true" className="text-ctp-red mb-3" />
      <h2 className="text-heading text-ctp-text mb-2">{heading}</h2>
      {body && <p className="text-body text-ctp-red mb-4 max-w-md">{body}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 rounded text-body text-ctp-blue border border-ctp-overlay hover:bg-ctp-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
        >
          Try again
        </button>
      )}
    </div>
  )
}
