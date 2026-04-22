import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronAPI, EvaluationDonePayload, EvaluationErrorPayload,
  OpOutputPayload, OpDonePayload,
} from './types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}

const api: ElectronAPI = {
  // Phase 1
  readTracker: () => ipcRenderer.invoke('readTracker'),
  readPipeline: () => ipcRenderer.invoke('readPipeline'),
  readReport: (reportPath: string) => ipcRenderer.invoke('readReport', reportPath),
  readStatuses: () => ipcRenderer.invoke('readStatuses'),
  listReports: () => ipcRenderer.invoke('listReports'),
  onFilesChanged: (callback) => subscribe<void>('files-changed', () => callback()),

  // Phase 2 — write safety
  updateStatus: (num, newStatus) => ipcRenderer.invoke('updateStatus', { num, newStatus }),

  // Phase 2 — evaluation
  evaluateUrl: (url) => ipcRenderer.invoke('evaluateUrl', url),
  cancelEvaluation: () => ipcRenderer.invoke('cancelEvaluation'),
  onEvaluationToken: (cb) => subscribe<string>('evaluation:token', cb),
  onEvaluationDone: (cb) => subscribe<EvaluationDonePayload>('evaluation:done', cb),
  onEvaluationError: (cb) => subscribe<EvaluationErrorPayload>('evaluation:error', cb),
  onEvaluationCancelled: (cb) => subscribe<void>('evaluation:cancelled', () => cb()),

  // Phase 2 — API key + prefs
  checkApiKey: () => ipcRenderer.invoke('checkApiKey'),
  saveApiKey: (rawKey) => ipcRenderer.invoke('saveApiKey', rawKey),
  verifyApiKey: (rawKey) => ipcRenderer.invoke('verifyApiKey', rawKey),
  getModel: () => ipcRenderer.invoke('getModel'),
  setModel: (model) => ipcRenderer.invoke('setModel', model),

  // Phase 2 — CV + operations
  readCv: () => ipcRenderer.invoke('readCv'),
  regeneratePDF: () => ipcRenderer.invoke('regeneratePDF'),
  runScan: () => ipcRenderer.invoke('runScan'),
  runBatch: () => ipcRenderer.invoke('runBatch'),
  onOperationOutput: (cb) => subscribe<OpOutputPayload>('op:output', cb),
  onOperationDone: (cb) => subscribe<OpDonePayload>('op:done', cb),
}

contextBridge.exposeInMainWorld('api', api)
