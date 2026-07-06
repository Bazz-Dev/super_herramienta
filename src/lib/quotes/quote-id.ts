// quoteId format: ING-[TIPO]-[YYMMDD]-[CLIENTE]-[SEQ]

function slug(input: string, max = 8): string {
  return (
    input
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // strip accents
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, max) || 'XXX'
  )
}

function yymmdd(date: string): string {
  // Use explicit year/month/day constructor to avoid UTC-midnight shift
  // ('YYYY-MM-DD' parsed by new Date() is UTC, which is the previous day in UTC-4 Chile).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const base = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date()
  const y = String(base.getFullYear()).slice(-2)
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const day = String(base.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function buildQuoteId(opts: {
  type?: string
  date: string
  client: string
  seq?: number
}): string {
  const type = slug(opts.type ?? 'COT', 6)
  const client = slug(opts.client, 8)
  const seq = String(opts.seq ?? 1).padStart(3, '0')
  return `ING-${type}-${yymmdd(opts.date)}-${client}-${seq}`
}
