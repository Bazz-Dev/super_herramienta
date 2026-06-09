// Formatting helpers + HTML escaping for safe value injection into the template.

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const UF = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatMoney(amount: number, currency: 'CLP' | 'UF' | 'USD'): string {
  if (currency === 'CLP') return CLP.format(amount)
  if (currency === 'USD') return USD.format(amount)
  return `UF ${UF.format(amount)}`
}

export function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
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
