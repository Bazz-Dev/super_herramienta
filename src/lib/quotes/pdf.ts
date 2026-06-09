import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { renderQuoteHTML } from './template'
import type { QuoteData } from './types'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

// Inline a locally-uploaded cover image (/uploads/..) as a data URI so Chromium
// can render it without resolving relative URLs (setContent has no base URL).
async function inlineCoverImage(data: QuoteData): Promise<QuoteData> {
  const url = data.coverImageUrl
  if (!url || !url.startsWith('/')) return data
  try {
    const filePath = path.join(process.cwd(), 'public', url)
    const buf = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] ?? 'image/png'
    return { ...data, coverImageUrl: `data:${mime};base64,${buf.toString('base64')}` }
  } catch {
    return data // fall back to whatever URL was given
  }
}

function footerTemplate(company: string): string {
  const safe = company.replace(/</g, '&lt;')
  return `<div style="font-size:8px;width:100%;padding:0 14mm;color:#666;font-family:Arial,sans-serif;display:flex;justify-content:space-between;">
    <span>INGEGAR. · ${safe}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`
}

// Renders the quote HTML to an A4 PDF via headless Chromium, paginated with a
// repeating footer. Requires Chromium (VPS / Node host). See CLAUDE.md.
export async function generateQuotePdf(input: QuoteData): Promise<Buffer> {
  const data = await inlineCoverImage(input)
  const html = renderQuoteHTML(data)

  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(data.contact.company),
      margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
