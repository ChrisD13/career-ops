import { ipcMain } from 'electron'
import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'
import { parseApplications } from './parsers/applications'
import { parsePipeline } from './parsers/pipeline'
import { parseStatuses } from './parsers/statuses'

const ReportPathSchema = z.string().regex(/^reports\/[^/]+\.md$/)

export function registerIpcHandlers(projectRoot: string): void {
  ipcMain.handle('readTracker', async () => {
    return parseApplications(path.join(projectRoot, 'data', 'applications.md'))
  })

  ipcMain.handle('readPipeline', async () => {
    return parsePipeline(path.join(projectRoot, 'data', 'pipeline.md'))
  })

  ipcMain.handle('readReport', async (_event, rawPath: unknown) => {
    const reportPath = ReportPathSchema.parse(rawPath)
    return fs.readFile(path.join(projectRoot, reportPath), 'utf-8')
  })

  ipcMain.handle('readStatuses', async () => {
    return parseStatuses(path.join(projectRoot, 'templates', 'states.yml'))
  })

  ipcMain.handle('listReports', async () => {
    const dir = path.join(projectRoot, 'reports')
    const files = await fs.readdir(dir)
    return files.filter(f => f.endsWith('.md')).sort().reverse()
  })
}
