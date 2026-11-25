// PDF → text with unpdf (its serverless pdf.js build: no DOM, no canvas, no
// real Worker), so it runs inside the MV3 service worker. Text only: nothing
// is rendered and the bytes never leave this function.
import { extractText, getDocumentProxy } from 'unpdf'
import { PAGE_BREAK } from '@/lib/blackboard/wire'

export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  // This pdf.js no longer uses eval / new Function (forbidden in MV3);
  // extraction was checked with string code generation switched off.
  const pdf = await getDocumentProxy(bytes, {
    disableFontFace: true,
    useWorkerFetch: false,
  })
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    return { text: text.join(PAGE_BREAK), pageCount: totalPages }
  } finally {
    await pdf.loadingTask.destroy()
  }
}
