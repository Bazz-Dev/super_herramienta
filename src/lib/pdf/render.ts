import type { Browser } from 'playwright-core'

// Shared headless-Chromium PDF rendering, used by both the proposal generator
// (src/lib/quotes/pdf.ts) and the technical report generator
// (src/lib/reports/pdf.ts). See DEPLOY_REPORT.md for the serverless setup.
//
// Node runtime only.

// Launches Chromium for the current environment:
//   - Serverless (Vercel/Lambda): @sparticuz/chromium binary + playwright-core
//   - Local dev/tests:            full `playwright` (bundled Chromium)
// Both are dynamically imported so the heavy serverless dep isn't loaded locally
// and the bundled browser isn't required on serverless.
export async function launchBrowser(): Promise<Browser> {
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

function footerTemplate(left: string): string {
  const safe = left.replace(/</g, '&lt;')
  return `<div style="font-size:8px;width:100%;padding:0 14mm;color:#666;font-family:Arial,sans-serif;display:flex;justify-content:space-between;">
    <span>${safe}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`
}

// Renders a full HTML document to an A4 PDF with a repeating footer (left label
// + page numbers). Waits for fonts but caps the wait so a blocked remote font
// can't hang the serverless function.
export async function renderHtmlToPdf(html: string, footerLeft: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(footerLeft),
      margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
