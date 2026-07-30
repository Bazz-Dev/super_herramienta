import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderHtmlToPdf } from '@/lib/pdf/render'
import { getObjectBuffer, isR2Key } from '@/lib/r2'
import { renderReportHTML } from './template'
import { reportFilename, type ReportData } from './types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function mimeFromKey(key: string): string {
  return MIME[path.extname(key).toLowerCase()] ?? 'image/png'
}

// Photos/OT llegan como (a) data: URI ya armado (legado, informes guardados
// antes de esta sesión — Chromium los renderiza directo, no hay nada que
// hacer), (b) key de R2 (formato actual — se baja server-side y se inlinea
// acá, nunca viajó como binario en el body del request), o (c) legado /uploads
// local. El body HTTP que llega a este endpoint solo contiene keys/paths
// cortos — la resolución a bytes ocurre acá, server-a-R2, sin el límite de
// ~4.5MB de Vercel para el body de un request entrante.
async function inlineUrl(url: string): Promise<string> {
  if (url.startsWith('data:') || !url) return url
  if (isR2Key(url)) {
    try {
      const buf = await getObjectBuffer(url)
      return `data:${mimeFromKey(url)};base64,${buf.toString('base64')}`
    } catch {
      return url
    }
  }
  if (url.startsWith('/')) {
    try {
      const filePath = path.join(process.cwd(), 'public', url)
      const buf = await readFile(filePath)
      return `data:${mimeFromKey(filePath)};base64,${buf.toString('base64')}`
    } catch {
      return url
    }
  }
  return url
}

async function inlineImages(data: ReportData): Promise<ReportData> {
  const [otImageUrl, photos] = await Promise.all([
    inlineUrl(data.otImageUrl),
    Promise.all(data.photos.map(async (p) => ({ ...p, url: await inlineUrl(p.url) }))),
  ])
  return { ...data, otImageUrl, photos }
}

// Renders the report HTML to an A4 PDF via headless Chromium. Node runtime only.
export async function generateReportPdf(input: ReportData): Promise<Buffer> {
  const data = await inlineImages(input)
  const html = renderReportHTML(data)
  return renderHtmlToPdf(html, reportFilename(data))
}
