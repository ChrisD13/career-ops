// STUB — Plan 01 will overwrite this with the full implementation.
// This stub provides correct type signatures so Plan 02 TypeScript compiles cleanly.

import { promises as fs } from 'fs'

export class MtimeCache {
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    void this.projectRoot
  }

  async init(): Promise<void> {
    // Stub — replaced by Plan 01
  }

  async read(filePath: string): Promise<string> {
    // Stub — falls back to direct fs.readFile
    return fs.readFile(filePath, 'utf-8')
  }

  async persist(): Promise<void> {
    // Stub — replaced by Plan 01
  }
}
