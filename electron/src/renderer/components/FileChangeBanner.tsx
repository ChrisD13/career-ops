import { RefreshCw } from 'lucide-react'

interface Props {
  visible: boolean
  onRefresh: () => void
}

export function FileChangeBanner({ visible, onRefresh }: Props) {
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onRefresh}
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 h-10 w-full bg-ctp-yellow/15 text-ctp-yellow text-body cursor-pointer hover:bg-ctp-yellow/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset"
    >
      <RefreshCw size={14} aria-hidden="true" />
      <span>Files changed — click to refresh</span>
    </button>
  )
}
