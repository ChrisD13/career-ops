import { promises as fs } from 'fs'
import yaml from 'js-yaml'
import { StatusEntry } from '../../preload/types'

const FALLBACK_STATES: StatusEntry[] = [
  { id: 'evaluated', label: 'Evaluated' },
  { id: 'applied', label: 'Applied' },
  { id: 'responded', label: 'Responded' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'discarded', label: 'Discarded' },
  { id: 'skip', label: 'SKIP' },
]

export async function parseStatuses(statesYmlPath: string): Promise<StatusEntry[]> {
  try {
    const content = await fs.readFile(statesYmlPath, 'utf-8')
    const data = yaml.load(content) as { states?: Array<{ id: string; label?: string }> }
    if (!Array.isArray(data?.states) || data.states.length === 0) return FALLBACK_STATES
    const states: StatusEntry[] = data.states
      .map(s => ({
        id: String(s.id ?? '').trim().toLowerCase(),
        label: String(s.label ?? s.id ?? '').trim(),
      }))
      .filter(s => s.id && s.label)
    return states.length > 0 ? states : FALLBACK_STATES
  } catch {
    return FALLBACK_STATES
  }
}
