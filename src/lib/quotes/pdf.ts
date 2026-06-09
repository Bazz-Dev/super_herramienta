import { chromium } from 'playwright'
import { renderQuoteHTML } from './template'
import type { QuoteData } from './types'

// Renders the quote HTML to PDF via headless Chromium at 390px width, matching
// DESIGN-SYSTEM.MD: width 390px, print_background: true, margins 0.
//
// Requires Chromium (installed via `npx playwright install chromium`). This runs
// on a VPS / Node host — NOT on plain cPanel shared hosting. See CLAUDE.md.
export async function generateQuotePdf(data: QuoteData): Promise<Buffer> {
  const html = renderQuoteHTML(data)

  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } })
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Ensure web fonts (Inter) are applied before snapshotting.
    await page.evaluate(() => document.fonts.ready)

    const pdf = await page.pdf({
      width: '390px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
