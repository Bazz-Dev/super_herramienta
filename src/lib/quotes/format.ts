// Formatting helpers + HTML escaping for safe value injection into the template.

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

// UF standard in Chile: 4 decimal places (e.g. UF 32.7842)
const UF = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatMoney(amount: number, currency: 'CLP' | 'UF' | 'USD'): string {
  if (currency === 'CLP') return CLP.format(amount)
  if (currency === 'USD') return USD.format(amount)
  return `UF ${UF.format(amount)}`
}

const MONTHS_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

export function formatDate(value: string): string {
  // Parse 'YYYY-MM-DD' as local date — new Date('YYYY-MM-DD') is UTC midnight,
  // which shifts to the previous day in UTC-4 (Chile). We use explicit constructor.
  // Manual format avoids toLocaleDateString ICU variance across Node/Vercel/Playwright.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const d = ymd
    ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3])
    : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

/** Escape a value before injecting it into the HTML template (prevents injection). */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
