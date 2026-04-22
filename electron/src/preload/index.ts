import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from './types'

const api: ElectronAPI = {
  readTracker: () => ipcRenderer.invoke('readTracker'),
  readPipeline: () => ipcRenderer.invoke('readPipeline'),
  readReport: (reportPath: string) => ipcRenderer.invoke('readReport', reportPath),
  readStatuses: () => ipcRenderer.invoke('readStatuses'),
  listReports: () => ipcRenderer.invoke('listReports'),
  onFilesChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('files-changed', listener)
    return () => {
      ipcRenderer.removeListener('files-changed', listener)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
