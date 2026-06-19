import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderHtmlToPdf } from '@/lib/pdf/render'
import { renderReportHTML } from './template'
import { reportFilename, type ReportData } from './types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// Photos are normally data: URIs (built client-side), which Chromium renders
// directly. This only handles the legacy case of a local /uploads path.
async function inlineUrl(url: string): Promise<string> {
  if (!url.startsWith('/')) return url
  try {
    const filePath = path.join(process.cwd(), 'public', url)
    const buf = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return url
  }
}

async function inlinePhotos(data: ReportData): Promise<ReportData> {
  const photos = await Promise.all(
    data.photos.map(async (p) => ({ ...p, url: await inlineUrl(p.url) })),
  )
  return { ...data, photos }
}

// Renders the report HTML to an A4 PDF via headless Chromium. Node runtime only.
export async function generateReportPdf(input: ReportData): Promise<Buffer> {
  const data = await inlinePhotos(input)
  const html = renderReportHTML(data)
  return renderHtmlToPdf(html, reportFilename(data))
}
