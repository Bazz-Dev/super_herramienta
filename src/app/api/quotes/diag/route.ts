import { NextResponse } from 'next/server'
import { auth } from '@/auth'

// Diagnostic endpoint: open in the browser (logged in) to see exactly which step
// of the serverless Chromium pipeline fails. Returns JSON. Remove once PDF works.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const steps: Record<string, unknown> = {
    vercel: !!process.env.VERCEL,
    node: process.version,
  }

  try {
    const { default: sparticuz } = await import('@sparticuz/chromium')
    steps.sparticuzLoaded = true

    const execPath = await sparticuz.executablePath()
    steps.executablePath = execPath
    const fs = await import('node:fs')
    steps.execExists = typeof execPath === 'string' && execPath.length > 0 && fs.existsSync(execPath)
    steps.args = Array.isArray(sparticuz.args) ? sparticuz.args.length : 'n/a'

    const { chromium } = await import('playwright-core')
    steps.playwrightCoreLoaded = true

    const browser = await chromium.launch({
      args: sparticuz.args,
      executablePath: execPath,
      headless: true,
    })
    steps.launched = true

    const page = await browser.newPage()
    await page.setContent('<!doctype html><h1>ok</h1>')
    const pdf = await page.pdf({ format: 'A4' })
    steps.pdfBytes = pdf.length
    await browser.close()

    steps.ok = true
    return NextResponse.json(steps)
  } catch (err) {
    steps.ok = false
    steps.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    steps.stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined
    return NextResponse.json(steps, { status: 500 })
  }
}
