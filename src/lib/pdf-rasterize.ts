import { pdf } from 'pdf-to-img'

export async function rasterizePdfFirstPage(pdfBytes: Uint8Array): Promise<Buffer> {
  const doc = await pdf(pdfBytes, { scale: 2 })
  try {
    return await doc.getPage(1)
  } finally {
    await doc.destroy()
  }
}
