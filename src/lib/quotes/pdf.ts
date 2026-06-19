import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderHtmlToPdf } from '@/lib/pdf/render'
import { renderQuoteHTML } from './template'
import type { QuoteData } from './types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// Inline a locally-uploaded image (/uploads/..) as a data URI so Chromium can
// render it without resolving relative URLs (setContent has no base URL).
async function inlineUrl(url: string | undefined): Promise<string | undefined> {
  if (!url || !url.startsWith('/')) return url
  try {
    const filePath = path.join(process.cwd(), 'public', url)
    const buf = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return url // fall back to whatever URL was given
  }
}

// Inline every locally-uploaded image (cover banner + photo annex).
async function inlineImages(data: QuoteData): Promise<QuoteData> {
  const [coverImageUrl, images] = await Promise.all([
    inlineUrl(data.coverImageUrl),
    Promise.all(data.images.map(async (img) => ({ ...img, url: (await inlineUrl(img.url)) ?? img.url }))),
  ])
  return { ...data, coverImageUrl, images }
}

// Renders the quote HTML to an A4 PDF via headless Chromium, paginated with a
// repeating footer. See DEPLOY_REPORT.md for the serverless Chromium setup.
export async function generateQuotePdf(input: QuoteData): Promise<Buffer> {
  const data = await inlineImages(input)
  const html = renderQuoteHTML(data)
  return renderHtmlToPdf(html, `INGEGAR. · ${data.contact.company}`)
}
