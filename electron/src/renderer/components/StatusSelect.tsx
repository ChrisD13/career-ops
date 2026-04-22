import { useEffect, useRef, useState } from 'react'

export interface StatusOption {
  label: string
  value: string
  category: 'Active' | 'Completed' | 'Outcome'
  color?: string
}

export interface StatusSelectProps {
  currentStatus: string
  options: StatusOption[]
  onSave: (newStatus: string) => Promise<void>
  onCancel: () => void
  autoFocus?: boolean
}

function groupByCategory(options: StatusOption[]): Record<string, StatusOption[]> {
  const groups: Record<string, StatusOption[]> = { Active: [], Completed: [], Outcome: [] }
  for (const opt of options) {
    const cat = opt.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(opt)
  }
  return groups
}

export function StatusSelect({
  currentStatus,
  options,
  onSave,
  onCancel,
  autoFocus = true,
}: StatusSelectProps) {
  const ref = useRef<HTMLSelectElement>(null)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(currentStatus)

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel, saving])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    setValue(next)
    if (next === currentStatus) {
      onCancel()
      return
    }
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  const handleBlur = () => {
    if (saving) return
    // Defer: clicking within the same React update (e.g., own option) shouldn't cancel.
    // Microtask delay lets onChange take precedence.
    queueMicrotask(() => {
      if (!saving) onCancel()
    })
  }

  const groups = groupByCategory(options)

  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid="status-select"
      data-saving={saving}
    >
      <select
        ref={ref}
        className="h-7 px-1.5 bg-ctp-base border border-ctp-blue text-ctp-text text-body rounded focus:outline-none focus:ring-2 focus:ring-ctp-blue disabled:opacity-60 disabled:cursor-wait"
        style={{ minWidth: '7.5rem', fontSize: '13px' }}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={saving}
        aria-label="Change status"
      >
        {(Object.keys(groups) as Array<'Active' | 'Completed' | 'Outcome'>).map((cat) =>
          groups[cat].length > 0 ? (
            <optgroup key={cat} label={cat}>
              {groups[cat].map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
      {saving && (
        <span className="text-ctp-subtext text-body" aria-hidden="true">⏳</span>
      )}
    </span>
  )
}
