import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Browser } from 'playwright-core'
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

function footerTemplate(company: string): string {
  const safe = company.replace(/</g, '&lt;')
  return `<div style="font-size:8px;width:100%;padding:0 14mm;color:#666;font-family:Arial,sans-serif;display:flex;justify-content:space-between;">
    <span>INGEGAR. · ${safe}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`
}

// Launches Chromium for the current environment:
//   - Serverless (Vercel/Lambda): @sparticuz/chromium binary + playwright-core
//   - Local dev/tests:            full `playwright` (bundled Chromium)
// Both are dynamically imported so the heavy serverless dep isn't loaded locally
// and the bundled browser isn't required on serverless.
async function launchBrowser(): Promise<Browser> {
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  if (isServerless) {
    const { default: sparticuz } = await import('@sparticuz/chromium')
    const { chromium } = await import('playwright-core')
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    })
  }
  const { chromium } = await import('playwright')
  return chromium.launch({ args: ['--no-sandbox'] })
}

// Renders the quote HTML to an A4 PDF via headless Chromium, paginated with a
// repeating footer. See DEPLOY_REPORT.md for the serverless Chromium setup.
export async function generateQuotePdf(input: QuoteData): Promise<Buffer> {
  const data = await inlineImages(input)
  const html = renderQuoteHTML(data)

  const browser = await launchBrowser()
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
