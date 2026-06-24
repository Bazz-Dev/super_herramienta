export type JobLike = {
  netAmount: number | null
  taxAmount: number | null
  collectionStatus: 'sin_oc' | 'pendiente_pago' | 'pagado'
  executionDate: Date | null
  invoiceDate: Date | null
  paymentDate: Date | null
  creditDays: number | null
  type: string
  branchId: string
  technicianId: string | null
  clientId: string
  costs: { amount: number }[]
}

const DAY = 24 * 60 * 60 * 1000
const net = (j: JobLike) => j.netAmount ?? 0
const tax = (j: JobLike) => j.taxAmount ?? Math.round((j.netAmount ?? 0) * 0.19)

export function jobTotal(j: JobLike): number {
  return net(j) + tax(j)
}

export function jobDueDate(j: JobLike): Date | null {
  if (!j.invoiceDate || j.creditDays == null) return null
  return new Date(j.invoiceDate.getTime() + j.creditDays * DAY)
}

export function jobIsOverdue(j: JobLike, now: Date): boolean {
  if (j.collectionStatus !== 'pendiente_pago') return false
  const due = jobDueDate(j)
  return !!due && now.getTime() > due.getTime()
}

export function jobMargin(j: JobLike): { margin: number | null; marginPct: number | null } {
  if (j.netAmount == null) return { margin: null, marginPct: null }
  const cost = j.costs.reduce((s, c) => s + c.amount, 0)
  if (j.costs.length === 0) return { margin: null, marginPct: null }
  const margin = j.netAmount - cost
  return { margin, marginPct: j.netAmount === 0 ? null : margin / j.netAmount }
}

function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

export type CashflowMetrics = {
  facturado: number
  porCobrar: number
  cobrado: number
  vencido: number
  sinOcBacklog: number
  sinOcCount: number
  avgCollectionDays: number | null
  avgBillingLagDays: number | null
  aging: { bucket: '0-30' | '31-60' | '60+'; amount: number }[]
  marginTotal: number | null
  mix: { type: string; count: number; amount: number }[]
}

export function computeMetrics(jobs: JobLike[], now: Date): CashflowMetrics {
  let facturado = 0,
    porCobrar = 0,
    cobrado = 0,
    vencido = 0,
    sinOcBacklog = 0,
    sinOcCount = 0
  const aging = { '0-30': 0, '31-60': 0, '60+': 0 }
  const collectionDays: number[] = []
  const billingLags: number[] = []
  const mixMap = new Map<string, { count: number; amount: number }>()
  let marginSum = 0
  let marginSeen = false

  for (const j of jobs) {
    const amount = net(j)
    if (j.collectionStatus === 'sin_oc') {
      sinOcBacklog += amount
      sinOcCount++
    } else {
      facturado += amount
      if (j.collectionStatus === 'pendiente_pago') {
        porCobrar += amount
        if (jobIsOverdue(j, now)) vencido += amount
        const ref = j.invoiceDate ?? null
        const age = daysBetween(ref, now)
        if (age != null) {
          if (age <= 30) aging['0-30'] += amount
          else if (age <= 60) aging['31-60'] += amount
          else aging['60+'] += amount
        }
      }
      if (j.collectionStatus === 'pagado') {
        cobrado += amount
        const d = daysBetween(j.invoiceDate, j.paymentDate)
        if (d != null) collectionDays.push(d)
      }
    }
    const lag = daysBetween(j.executionDate, j.invoiceDate)
    if (lag != null && lag >= 0) billingLags.push(lag)

    const m = mixMap.get(j.type) ?? { count: 0, amount: 0 }
    m.count++
    m.amount += amount
    mixMap.set(j.type, m)

    const mg = jobMargin(j)
    if (mg.margin != null) {
      marginSum += mg.margin
      marginSeen = true
    }
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null)

  return {
    facturado,
    porCobrar,
    cobrado,
    vencido,
    sinOcBacklog,
    sinOcCount,
    avgCollectionDays: avg(collectionDays),
    avgBillingLagDays: avg(billingLags),
    aging: [
      { bucket: '0-30', amount: aging['0-30'] },
      { bucket: '31-60', amount: aging['31-60'] },
      { bucket: '60+', amount: aging['60+'] },
    ],
    marginTotal: marginSeen ? marginSum : null,
    mix: [...mixMap.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.amount - a.amount),
  }
}

// --- Per-client breakdown ---

export type ClientBreakdown = {
  clientId: string
  clientName: string
  facturado: number
  cobrado: number
  porCobrar: number
  sinOc: number
  jobCount: number
  cobradoPct: number | null
  avgTicket: number | null
}

export function computeClientBreakdown(
  jobs: (JobLike & { clientId: string; client: { name: string } })[],
): ClientBreakdown[] {
  const map = new Map<string, ClientBreakdown>()

  for (const j of jobs) {
    if (!map.has(j.clientId)) {
      map.set(j.clientId, {
        clientId: j.clientId,
        clientName: j.client.name,
        facturado: 0,
        cobrado: 0,
        porCobrar: 0,
        sinOc: 0,
        jobCount: 0,
        cobradoPct: null,
        avgTicket: null,
      })
    }
    const c = map.get(j.clientId)!
    const amount = net(j)
    c.jobCount++
    if (j.collectionStatus === 'sin_oc') {
      c.sinOc += amount
    } else {
      c.facturado += amount
      if (j.collectionStatus === 'pendiente_pago') c.porCobrar += amount
      if (j.collectionStatus === 'pagado') c.cobrado += amount
    }
  }

  for (const c of map.values()) {
    c.cobradoPct = c.facturado > 0 ? Math.round((c.cobrado / c.facturado) * 100) : null
    c.avgTicket = c.jobCount > 0 ? Math.round((c.facturado + c.sinOc) / c.jobCount) : null
  }

  return [...map.values()].sort((a, b) => b.facturado - a.facturado)
}

// --- Monthly trend ---

export type MonthlyBucket = {
  month: string
  label: string
  facturado: number
  cobrado: number
  sinOc: number
  jobCount: number
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function computeMonthlyTrend(
  jobs: { executionDate: Date | null; netAmount: number | null; collectionStatus: string }[],
): MonthlyBucket[] {
  const map = new Map<string, MonthlyBucket>()

  for (const j of jobs) {
    if (!j.executionDate) continue
    const d = j.executionDate
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(month)) {
      map.set(month, {
        month,
        label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`,
        facturado: 0,
        cobrado: 0,
        sinOc: 0,
        jobCount: 0,
      })
    }
    const b = map.get(month)!
    const amount = j.netAmount ?? 0
    b.jobCount++
    if (j.collectionStatus === 'sin_oc') b.sinOc += amount
    else b.facturado += amount
    if (j.collectionStatus === 'pagado') b.cobrado += amount
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}
