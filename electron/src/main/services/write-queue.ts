// STUB — Plan 01 will overwrite this with the full implementation.
// This stub provides correct type signatures so Plan 02 TypeScript compiles cleanly.

export const GUI_WRITE_SUPPRESSION_MS = 2000

export async function lockAndWrite(
  filePath: string,
  content: string,
  pendingGuiWrites: Set<string>,
): Promise<void> {
  // Stub — replaced by Plan 01
  void filePath
  void content
  void pendingGuiWrites
  throw new Error('write-queue stub not replaced by Plan 01')
}
