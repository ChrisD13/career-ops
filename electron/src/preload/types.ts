export interface TrackerRow {
  num: number
  date: string
  company: string
  role: string
  scoreRaw: string
  score: number | null
  status: string
  hasPDF: boolean
  reportLink: string
  reportPath: string
  notes: string
}

export interface PipelineEntry {
  url: string
  company: string
  role: string
  done: boolean
}

export interface StatusEntry {
  id: string
  label: string
}

export interface ElectronAPI {
  readTracker: () => Promise<TrackerRow[]>
  readPipeline: () => Promise<PipelineEntry[]>
  readReport: (reportPath: string) => Promise<string>
  readStatuses: () => Promise<StatusEntry[]>
  listReports: () => Promise<string[]>
  onFilesChanged: (callback: () => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
