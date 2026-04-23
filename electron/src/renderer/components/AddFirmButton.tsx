import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AddFirmModal } from './AddFirmModal'

interface Props { onAdded?: () => void | Promise<void> }

export function AddFirmButton({ onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const handleSuccess = async () => {
    setOpen(false)
    if (onAdded) await onAdded()
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1 rounded border border-ctp-overlay text-label text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-mauve"
        data-testid="add-firm-btn"
      >
        <Plus size={12} aria-hidden="true" />
        <span>Add Firm</span>
      </button>
      {open && (
        <AddFirmModal
          onClose={() => setOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
