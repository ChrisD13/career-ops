import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface Props {
  left: ReactNode
  right: ReactNode
  rightTitle: string
  onClose: () => void
}

export function SplitPaneLayout({ left, right, rightTitle, onClose }: Props) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left pane — 45% */}
      <div className="w-[45%] min-w-0 flex flex-col overflow-hidden border-r border-ctp-overlay">
        {left}
      </div>
      {/* Right pane — 55% */}
      <div className="w-[55%] min-w-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 h-9 bg-ctp-surface border-b border-ctp-overlay shrink-0">
          <span className="text-label text-ctp-subtext uppercase tracking-wider truncate" title={rightTitle}>
            {rightTitle}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report pane"
            className="text-ctp-blue hover:text-ctp-text p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {right}
        </div>
      </div>
    </div>
  )
}
