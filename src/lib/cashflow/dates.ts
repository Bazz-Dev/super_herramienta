// Helpers for <input type="date"> (value = "YYYY-MM-DD"), UTC-safe.
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function fromDateInput(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
