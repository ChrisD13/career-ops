import { useEffect, useState } from 'react'

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (default, deeper reasoning)' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 (faster, cheaper)' },
] as const

export function ModelSelect() {
  const [model, setModel] = useState<string>('claude-sonnet-4-6')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { model: saved } = await window.api.getModel()
      setModel(saved)
      setLoading(false)
    })()
  }, [])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    setModel(next)
    await window.api.setModel(next)
  }

  return (
    <div className="settings-field">
      <label htmlFor="model-select" className="settings-field__label">
        Model
      </label>
      <div className="settings-field__help">Sonnet 4.6 is recommended for evaluations.</div>
      <select
        id="model-select"
        className="settings-field__select"
        value={model}
        onChange={handleChange}
        disabled={loading}
        data-testid="model-select"
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}
