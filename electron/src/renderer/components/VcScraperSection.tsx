import { useEffect, useState } from 'react'

const PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Monthly (1st @ 09:00)', value: '0 9 1 * *' },
  { label: 'Weekly (Monday @ 09:00)', value: '0 9 * * 1' },
  { label: 'Daily (09:00)', value: '0 9 * * *' },
]

export function VcScraperSection() {
  const [interval, setInterval_] = useState<string>('0 9 1 * *')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      const { interval: current } = await window.api.getVcScrapeInterval()
      setInterval_(current)
    })()
  }, [])

  const save = async (value: string) => {
    setSaving(true)
    setError(null)
    try {
      await window.api.setVcScrapeInterval(value)
      setInterval_(value)
      setSavedAt(Date.now())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleRunNow = async () => {
    const result = await window.api.runVcScrape()
    if (result.error) setError(result.error)
  }

  const isPreset = PRESETS.some((p) => p.value === interval)

  return (
    <section className="mt-4 pt-4 border-t border-ctp-overlay" data-testid="vc-scraper-section">
      <h3 className="text-label text-ctp-subtext uppercase tracking-wider mb-2">VC Scraper</h3>
      <label className="block mb-2">
        <span className="text-body">Schedule</span>
        <select
          value={isPreset ? interval : '__custom__'}
          onChange={(e) => {
            const v = e.target.value
            if (v !== '__custom__') void save(v)
          }}
          className="block w-full mt-1 px-2 py-1 bg-ctp-base border border-ctp-overlay rounded text-body"
          data-testid="vc-scraper-schedule"
        >
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          <option value="__custom__">Custom (cron expression)</option>
        </select>
      </label>
      {!isPreset && (
        <label className="block mb-2">
          <span className="text-label text-ctp-subtext uppercase tracking-wider">Cron expression</span>
          <input
            type="text"
            defaultValue={interval}
            onBlur={(e) => void save(e.currentTarget.value)}
            className="w-full mt-1 px-2 py-1 bg-ctp-base border border-ctp-overlay rounded text-body font-mono"
            placeholder="0 9 1 * *"
            data-testid="vc-scraper-cron"
          />
        </label>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => void handleRunNow()}
          className="px-3 py-1 rounded border border-ctp-overlay text-label text-ctp-text hover:bg-ctp-overlay"
          data-testid="vc-scraper-run-now"
        >
          Run scan now
        </button>
        {saving && <span className="text-ctp-subtext text-label">Saving…</span>}
        {savedAt && !saving && <span className="text-ctp-green text-label">Saved</span>}
        {error && <span className="text-ctp-red text-label" data-testid="vc-scraper-error">{error}</span>}
      </div>
    </section>
  )
}
