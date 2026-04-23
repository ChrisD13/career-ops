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

// Phase 2 — Evaluation payload types
export interface EvaluationUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export interface EvaluationDonePayload {
  usage: EvaluationUsage
  stopReason: string
  costUsd: number
  model: string
}

export interface EvaluationErrorPayload {
  status?: number
  type?: string
  message: string
  retryAfter?: string
}

export interface OpOutputPayload {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | 'scrape' | 'merge-tracker' | 'check-liveness' | 'patterns' | 'followup' | 'latex'
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface OpDonePayload {
  runId: string
  kind: 'scan' | 'batch' | 'pdf' | 'scrape' | 'merge-tracker' | 'check-liveness' | 'patterns' | 'followup' | 'latex'
  code: number | null
  signal: string | null
}

export interface ApiKeyState {
  hasKey: boolean
  backendWarning?: string
}

export interface StatusUpdateResult {
  success: boolean
  error?: string
  message?: string
}

export interface EvaluateUrlResult {
  evaluationId?: string
  error?: string
}

export interface SaveApiKeyResult {
  success: boolean
  warning?: string
  error?: string
}

export interface VerifyApiKeyResult {
  ok: boolean
  error?: string
}

// Phase 3 — VC Portfolio Discovery types
export interface VcCompany {
  firm: string
  company: string
  careers_url: string
  funding_signal: string
  funding_date: string
  role_matches: string
  discovered_at: string
  promoted: boolean
}

export interface VcFirmHealth {
  name: string
  last_run: string
  company_count: number
  baseline_count: number
  status: 'OK' | 'Stale' | 'Error'
  reason?: string
}

export interface VcFirmConfig {
  name: string
  portfolio_url: string
  keywords: string[]
  enabled?: boolean
}

export interface PromoteResult { success: boolean; error?: string }

export interface AddFirmResult {
  success: boolean
  kind?: 'probe' | 'save'
  probeStatus?: number
  error?: string
  warning?: string
}

export interface AddFirmPayload {
  name: string
  portfolio_url: string
  keywords?: string[]
  bypassProbe?: boolean   // set true when user clicks "Save anyway" after failed probe
}

export interface ElectronAPI {
  // Phase 1 — unchanged
  readTracker: () => Promise<TrackerRow[]>
  readPipeline: () => Promise<PipelineEntry[]>
  readReport: (reportPath: string) => Promise<string>
  readStatuses: () => Promise<StatusEntry[]>
  listReports: () => Promise<string[]>
  onFilesChanged: (callback: () => void) => () => void

  // Phase 2 — write safety
  updateStatus: (num: number, newStatus: string) => Promise<StatusUpdateResult>

  // Phase 2 — evaluation
  evaluateUrl: (url: string) => Promise<EvaluateUrlResult>
  cancelEvaluation: () => Promise<void>
  onEvaluationToken: (cb: (delta: string) => void) => () => void
  onEvaluationDone: (cb: (payload: EvaluationDonePayload) => void) => () => void
  onEvaluationError: (cb: (payload: EvaluationErrorPayload) => void) => () => void
  onEvaluationCancelled: (cb: () => void) => () => void

  // Phase 2 — API key + prefs
  checkApiKey: () => Promise<ApiKeyState>
  saveApiKey: (rawKey: string) => Promise<SaveApiKeyResult>
  verifyApiKey: (rawKey: string) => Promise<VerifyApiKeyResult>
  getModel: () => Promise<{ model: string }>
  setModel: (model: string) => Promise<void>

  // Phase 2 — CV + operations
  readCv: () => Promise<string>
  regeneratePDF: () => Promise<{ runId: string }>
  runScan: () => Promise<{ runId: string }>
  runBatch: () => Promise<{ runId: string; error?: string }>
  onOperationOutput: (cb: (payload: OpOutputPayload) => void) => () => void
  onOperationDone: (cb: (payload: OpDonePayload) => void) => () => void

  // Pipeline tools
  runMergeTracker: () => Promise<{ runId: string }>
  runCheckLiveness: () => Promise<{ runId: string }>
  runAnalyzePatterns: () => Promise<{ runId: string }>
  runFollowupCadence: () => Promise<{ runId: string }>
  runGenerateLatex: () => Promise<{ runId: string }>

  // Phase 3 — VC Portfolio Discovery
  runVcScrape: () => Promise<{ runId: string; error?: string }>
  readVcCompanies: () => Promise<VcCompany[]>
  readVcHealth: () => Promise<{ firms: VcFirmHealth[] }>
  promoteToPipeline: (payload: { firm: string; company: string; careersUrl: string }) => Promise<PromoteResult>
  listVcFirms: () => Promise<VcFirmConfig[]>
  addVcFirm: (payload: AddFirmPayload) => Promise<AddFirmResult>
  getVcScrapeInterval: () => Promise<{ interval: string }>
  setVcScrapeInterval: (interval: string) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
