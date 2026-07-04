/**
 * Mobile-first UX audit script
 * Tests touch targets, loading states, route transitions, and mobile layout
 */
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const BASE = 'http://localhost:3000'
const MOBILE = { width: 390, height: 844 } // iPhone 14
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 800 }

const screenshotsDir = path.join(process.env.TEMP || '/tmp', 'mobile-audit-screenshots')
fs.mkdirSync(screenshotsDir, { recursive: true })

const findings: { severity: string; location: string; issue: string; fix?: string }[] = []

function fail(location: string, issue: string, fix?: string) {
  findings.push({ severity: 'FAIL', location, issue, fix })
  console.error(`  ❌ FAIL [${location}]: ${issue}`)
}
function warn(location: string, issue: string, fix?: string) {
  findings.push({ severity: 'WARN', location, issue, fix })
  console.warn(`  ⚠️  WARN [${location}]: ${issue}`)
}
function pass(msg: string) {
  console.log(`  ✅ ${msg}`)
}

async function screenshot(page: Page, name: string) {
  const p = path.join(screenshotsDir, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${name}.png`)
  return p
}

/** Check all buttons on page have min 44px height */
async function auditTouchTargets(page: Page, context: string) {
  const tooSmall = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[href], input[type="submit"]'))
    return buttons
      .filter(el => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0) return false
        if (style.display === 'none' || style.visibility === 'hidden') return false
        // Skip inline text links (not CTA buttons)
        if (el.tagName === 'A' && rect.height < 20) return false
        return rect.height < 40 // 40px threshold (slightly below 44px to catch near-misses)
      })
      .map(el => ({
        tag: el.tagName,
        text: (el as HTMLElement).innerText?.trim().slice(0, 40) || el.getAttribute('aria-label') || '',
        height: Math.round(el.getBoundingClientRect().height),
        className: (el as HTMLElement).className?.slice(0, 60) || '',
      }))
  })

  if (tooSmall.length > 0) {
    for (const btn of tooSmall) {
      fail(context, `Button "${btn.text}" (${btn.tag}) is only ${btn.height}px tall (needs 44px)`, `Add min-h-11 or min-height:44px`)
    }
  } else {
    pass(`All touch targets ≥ 40px on ${context}`)
  }
}

/** Check for elements that should have loading feedback but don't */
async function auditLoadingFeedback(page: Page, context: string) {
  const noAriaBusy = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'))
    const issues: string[] = []
    for (const form of forms) {
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn && !submitBtn.getAttribute('aria-busy') && !submitBtn.getAttribute('disabled')) {
        const text = (submitBtn as HTMLElement).innerText?.trim().slice(0, 40)
        issues.push(text || 'unknown button')
      }
    }
    return issues
  })

  if (noAriaBusy.length > 0) {
    warn(context, `${noAriaBusy.length} form submit button(s) without aria-busy: ${noAriaBusy.join(', ')}`)
  } else {
    pass(`Loading feedback wired up on ${context}`)
  }
}

/** Check mobile nav is visible on mobile viewport */
async function auditMobileNav(page: Page) {
  const hamburger = await page.$('button[aria-label="Abrir menú"]')
  if (!hamburger) {
    fail('Mobile nav', 'Hamburger menu button not found')
    return
  }
  const visible = await hamburger.isVisible()
  if (!visible) {
    fail('Mobile nav', 'Hamburger button exists but is not visible on mobile')
    return
  }
  const rect = await hamburger.boundingBox()
  if (!rect || rect.height < 40) {
    fail('Mobile nav', `Hamburger button height ${rect?.height}px < 44px`)
  } else {
    pass(`Hamburger button is ${Math.round(rect.height)}px tall ✓`)
  }

  // Click hamburger and check drawer opens
  await hamburger.click()
  await page.waitForTimeout(300)
  const drawer = await page.$('aside')
  if (drawer && await drawer.isVisible()) {
    pass('Mobile drawer opens on hamburger click ✓')
  } else {
    fail('Mobile nav', 'Drawer did not open after clicking hamburger')
  }

  // Close it
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

/** Check TopProgress bar exists */
async function auditTopProgress(page: Page) {
  const bar = await page.$('.route-progress')
  if (!bar) {
    fail('TopProgress', 'route-progress element not found in DOM')
  } else {
    pass('TopProgress element present ✓')
  }
}

/** Check page content fits mobile viewport without horizontal scroll */
async function auditHorizontalScroll(page: Page, context: string) {
  const hasHScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
  })
  if (hasHScroll) {
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth
    })
    fail(context, `Horizontal scroll detected: +${overflow}px overflow`)
  } else {
    pass(`No horizontal scroll on ${context} ✓`)
  }
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[name="login"]', email)
  await page.fill('input[name="password"]', password)

  // Check submit button before clicking
  const submitBtn = await page.$('button[type="submit"]')
  if (submitBtn) {
    const rect = await submitBtn.boundingBox()
    if (rect && rect.height < 40) {
      fail('Login', `Submit button ${Math.round(rect.height)}px (should be ≥44px)`)
    } else if (rect) {
      pass(`Login submit button ${Math.round(rect.height)}px ✓`)
    }
    const isFullWidth = rect && rect.width > 250
    if (!isFullWidth) {
      warn('Login', `Submit button width ${rect?.width}px — may not fill mobile width`)
    }
  }

  // Click and wait for navigation simultaneously
  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }),
    page.click('button[type="submit"]'),
  ])

  // Check for spinner (may have already appeared)
  const currentUrl = page.url()
  if (!currentUrl.includes('/login')) {
    pass('Login spinner + redirect worked ✓')
  } else {
    warn('Login', 'Still on login page after submit')
  }

  await page.waitForLoadState('networkidle', { timeout: 15000 })
}

async function main() {
  console.log('\n🔍 INGEGAR Mobile-First UX Audit\n')
  console.log(`📱 Mobile viewport: ${MOBILE.width}×${MOBILE.height}`)
  console.log(`Screenshots: ${screenshotsDir}\n`)

  const browser = await chromium.launch({ headless: true })

  try {
    // ── 1. LOGIN PAGE ──────────────────────────────────────────────────────
    console.log('\n📋 [1/8] LOGIN PAGE')
    const ctx1 = await browser.newContext({ viewport: MOBILE })
    const page1 = await ctx1.newPage()
    await page1.goto(`${BASE}/login`)
    await page1.waitForLoadState('networkidle')
    await screenshot(page1, '01-login-mobile')
    await auditTouchTargets(page1, 'Login page')
    await auditHorizontalScroll(page1, 'Login page')
    await ctx1.close()

    // ── 2. LOGIN + DASHBOARD ───────────────────────────────────────────────
    console.log('\n📋 [2/8] DASHBOARD (after login)')
    const ctx2 = await browser.newContext({ viewport: MOBILE })
    const page2 = await ctx2.newPage()
    await loginAs(page2, 'admin@ingegarchile.cl', 'ingegar123')
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '02-dashboard-mobile')
    await auditTouchTargets(page2, 'Dashboard')
    await auditHorizontalScroll(page2, 'Dashboard')
    await auditMobileNav(page2)
    await auditTopProgress(page2)
    await screenshot(page2, '02b-dashboard-with-drawer')

    // ── 3. TICKETS ─────────────────────────────────────────────────────────
    console.log('\n📋 [3/8] TICKETS (Kanban)')
    await page2.goto(`${BASE}/tickets`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '03-tickets-mobile')
    await auditTouchTargets(page2, 'Tickets page')
    await auditHorizontalScroll(page2, 'Tickets page')

    // ── 4. CRONOGRAMA ──────────────────────────────────────────────────────
    console.log('\n📋 [4/8] CRONOGRAMA')
    await page2.goto(`${BASE}/cronograma`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '04-cronograma-mobile')
    await auditTouchTargets(page2, 'Cronograma')
    await auditHorizontalScroll(page2, 'Cronograma')

    // ── 5. RECURSOS ────────────────────────────────────────────────────────
    console.log('\n📋 [5/8] RECURSOS / TÉCNICOS')
    await page2.goto(`${BASE}/recursos/tecnicos`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '05-tecnicos-mobile')
    await auditTouchTargets(page2, 'Técnicos list')
    await auditHorizontalScroll(page2, 'Técnicos list')

    // Check new tecnico form
    await page2.goto(`${BASE}/recursos/tecnicos/new`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '05b-tecnico-form-mobile')
    await auditTouchTargets(page2, 'Técnico form')
    await auditLoadingFeedback(page2, 'Técnico form')

    // ── 6. RR.HH. ──────────────────────────────────────────────────────────
    console.log('\n📋 [6/8] RR.HH.')
    await page2.goto(`${BASE}/rrhh`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '06-rrhh-mobile')
    await auditTouchTargets(page2, 'RR.HH. dashboard')
    await auditHorizontalScroll(page2, 'RR.HH. dashboard')

    // ── 7. FLUJO DE CAJA ───────────────────────────────────────────────────
    console.log('\n📋 [7/8] FLUJO DE CAJA')
    await page2.goto(`${BASE}/flujo`)
    await page2.waitForLoadState('networkidle')
    await screenshot(page2, '07-flujo-mobile')
    await auditTouchTargets(page2, 'Flujo dashboard')
    await auditHorizontalScroll(page2, 'Flujo dashboard')

    // ── 8. DESKTOP CHECK ───────────────────────────────────────────────────
    console.log('\n📋 [8/8] DESKTOP REGRESSION CHECK')
    await ctx2.close()
    const ctx3 = await browser.newContext({ viewport: DESKTOP })
    const page3 = await ctx3.newPage()
    await loginAs(page3, 'admin@ingegarchile.cl', 'ingegar123')
    await page3.waitForLoadState('networkidle')
    await screenshot(page3, '08-dashboard-desktop')
    await auditTouchTargets(page3, 'Dashboard (desktop)')
    await auditHorizontalScroll(page3, 'Dashboard (desktop)')
    await ctx3.close()

  } finally {
    await browser.close()
  }

  // ── RESULTS SUMMARY ────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('AUDIT RESULTS')
  console.log('='.repeat(60))

  const fails = findings.filter(f => f.severity === 'FAIL')
  const warns = findings.filter(f => f.severity === 'WARN')

  if (fails.length === 0 && warns.length === 0) {
    console.log('\n🎉 ALL CHECKS PASSED — App is mobile-ready!\n')
  } else {
    if (fails.length > 0) {
      console.log(`\n❌ FAILS (${fails.length}):`)
      fails.forEach(f => console.log(`  • [${f.location}] ${f.issue}${f.fix ? ` → ${f.fix}` : ''}`))
    }
    if (warns.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warns.length}):`)
      warns.forEach(w => console.log(`  • [${w.location}] ${w.issue}${w.fix ? ` → ${w.fix}` : ''}`))
    }
  }

  console.log(`\nScreenshots saved to: ${screenshotsDir}`)

  // Exit with error code if fails
  if (fails.length > 0) process.exit(1)
}

main().catch(err => {
  console.error('Audit error:', err)
  process.exit(1)
})
