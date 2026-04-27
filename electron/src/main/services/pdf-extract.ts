import { promises as fs } from 'fs'
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB — RESEARCH §A3

export type PdfExtractResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export async function extractPdfText(filePath: string): Promise<PdfExtractResult> {
  const stat = await fs.stat(filePath)
  if (stat.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB; max 10 MB)`,
    }
  }

  const buffer = await fs.readFile(filePath)
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return { ok: true, text }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Could not extract text from PDF' }
  }
}
