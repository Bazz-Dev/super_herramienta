import { jobTotal, type JobLike } from './metrics'

export type GroupPeriod = 'day' | 'week' | 'month' | 'year'

type BaseJob = JobLike & { id: string; client: { id: string; name: string }; branch: { name: string } | null; description: string }

type PeriodBucket<J> = { key: string; label: string; jobs: J[] }
type ClientGroup<J> = { clientId: string; clientName: string; jobs: J[]; pending: number; overdueCount: number; periods: PeriodBucket<J>[] }

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function recordDate(j: BaseJob): Date | null {
  return j.executionDate
}

function periodKeyAndLabel(d: Date, period: GroupPeriod): { key: string; label: string } {
  if (period === 'year') {
    const y = d.getUTCFullYear()
    return { key: String(y), label: String(y) }
  }
  if (period === 'month') {
    const y = d.getUTCFullYear(), m = d.getUTCMonth()
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m]} ${y}` }
  }
  if (period === 'week') {
    // Semana ISO: lunes como inicio.
    const day = (d.getUTCDay() + 6) % 7
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - day)
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
    const fmt = (x: Date) => `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`
    return { key: mon.toISOString().slice(0, 10), label: `${fmt(mon)} – ${fmt(sun)}` }
  }
  const key = d.toISOString().slice(0, 10)
  return { key, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
}

// Agrupa trabajos por cliente y luego por período (día/semana/mes/año),
// para la vista acordeón principal de /flujo y para reportes agrupados.
export function groupByClientPeriod<J extends BaseJob>(jobs: J[], period: GroupPeriod): ClientGroup<J>[] {
  const byClient = new Map<string, ClientGroup<J>>()

  for (const j of jobs) {
    let g = byClient.get(j.client.id)
    if (!g) {
      g = { clientId: j.client.id, clientName: j.client.name, jobs: [], pending: 0, overdueCount: 0, periods: [] }
      byClient.set(j.client.id, g)
    }
    g.jobs.push(j)
    if (j.collectionStatus !== 'pagado') g.pending += jobTotal(j)
  }

  const now = new Date()
  for (const g of byClient.values()) {
    const buckets = new Map<string, PeriodBucket<J>>()
    for (const j of g.jobs) {
      const d = recordDate(j)
      if (!d) continue
      const { key, label } = periodKeyAndLabel(d, period)
      let b = buckets.get(key)
      if (!b) { b = { key, label, jobs: [] }; buckets.set(key, b) }
      b.jobs.push(j)
      if (j.collectionStatus !== 'pagado' && j.creditDays != null && j.invoiceDate) {
        const due = new Date(j.invoiceDate); due.setDate(due.getDate() + j.creditDays)
        if (due < now) g.overdueCount++
      }
    }
    g.periods = [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key))
  }

  return [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, 'es'))
}
