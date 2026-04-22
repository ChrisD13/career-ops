// STUB — Plan 01 will overwrite this with the full implementation.
// This stub provides correct type signatures so Plan 02 TypeScript compiles cleanly.

export interface StatusUpdateResult {
  success: boolean
  error?: 'lock-timeout' | 'not-found' | 'parse-error' | 'fs-error'
  message?: string
}

export async function updateStatus(
  filePath: string,
  reportNumber: number,
  newStatus: string,
  pendingGuiWrites: Set<string>,
): Promise<StatusUpdateResult> {
  // Stub implementation — replaced by Plan 01
  void filePath
  void reportNumber
  void newStatus
  void pendingGuiWrites
  return { success: false, error: 'fs-error', message: 'stub not replaced by Plan 01' }
}

export const GUI_WRITE_SUPPRESSION_MS = 2000
