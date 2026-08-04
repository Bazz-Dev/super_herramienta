import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics, computeClientBreakdown, computeMonthlyTrend, jobMargin, jobDirectCostAndMargin, type JobLike } from '../../src/lib/cashflow/metrics.ts'
import { hasInvoiceInfo, isPaidJob, isOverdueV2 } from '../../src/lib/cashflow/job-presets.ts'

const base: JobLike = {
  netAmount: 100000, taxAmount: 19000, collectionStatus: 'sin_oc',
  executionDate: null, invoiceDate: null, paymentDate: null, creditDays: null,
  type: 'requerimiento', branchId: 'b1', technicianId: null, clientId: 'c1', costs: [],
  // Campos v2 (informe #25) — computeMetrics() ya no lee collectionStatus
  // para clasificar, así que estos son los que realmente deciden el bucket.
  financialStage: 'no_po', commercialStage: 'intake', operationalStage: 'pending',
  nonBillable: false, purchaseOrder: null, invoiceNumber: null,
}
const NOW = new Date('2026-06-19T00:00:00.000Z')

test('sin_oc feeds the backlog, not facturado', () => {
  const m = computeMetrics([{ ...base }], NOW)
  assert.equal(m.sinOcBacklog, 100000)
  assert.equal(m.sinOcCount, 1)
  assert.equal(m.facturado, 0)
})

test('pendiente_pago counts as por cobrar; overdue when past due date', () => {
  const j: JobLike = {
    ...base, financialStage: 'invoiced',
    invoiceNumber: 'F-001', invoiceDate: new Date('2026-04-01T00:00:00.000Z'), creditDays: 30,
  }
  assert.equal(isOverdueV2(j, NOW), true)
  const m = computeMetrics([j], NOW)
  assert.equal(m.porCobrar, 100000)
  assert.equal(m.vencido, 100000)
  assert.equal(m.aging.find((a) => a.bucket === '60+')!.amount, 100000)
})

test('pagado counts as cobrado and feeds avg collection days', () => {
  const j: JobLike = {
    ...base, financialStage: 'paid',
    invoiceNumber: 'F-002', invoiceDate: new Date('2026-04-01T00:00:00.000Z'),
    paymentDate: new Date('2026-05-01T00:00:00.000Z'),
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.cobrado, 100000)
  assert.equal(m.avgCollectionDays, 30)
})

// --- Informe #25: consistencia transversal — computeMetrics() ya no lee
// collectionStatus directo (podía quedar desincronizado vía quickUpdateJob,
// que edita OC/factura/monto sin re-derivarlo — ver GAP_REGISTER G51/G52),
// sino los mismos predicados canónicos que /flujo, conciliación y el ticket.

test('REGRESIÓN #25: collectionStatus desincronizado (sin_oc) no engaña a computeMetrics si la factura/pago reales ya existen', () => {
  // Escenario real: edición rápida del acordeón (quickUpdateJob) cargó OC +
  // factura + monto sin volver a derivar financialStage/collectionStatus —
  // antes de este bloque, computeMetrics() habría seguido leyendo
  // collectionStatus='sin_oc' y este trabajo habría desaparecido de
  // "facturado"/"cobrado" en dashboard/reportes mientras /flujo y el ticket
  // (que sí leen los campos reales) ya lo mostraban pagado.
  const j: JobLike = {
    ...base, collectionStatus: 'sin_oc', // deliberadamente stale
    financialStage: 'no_po', // tampoco avanzado — el bug real no lo toca
    purchaseOrder: 'OC-99', invoiceNumber: 'F-099',
    invoiceDate: new Date('2026-04-01T00:00:00.000Z'), paymentAmount: 100000,
  }
  assert.equal(isPaidJob(j), true) // el predicado canónico ya lo ve pagado
  const m = computeMetrics([j], NOW)
  assert.equal(m.sinOcBacklog, 0)
  assert.equal(m.facturado, 100000)
  assert.equal(m.cobrado, 100000)
})

test('OC/factura anulada (informe #11/#13) no cuenta como vigente aunque el número siga guardado', () => {
  const j: JobLike = {
    ...base, purchaseOrder: 'OC-1', purchaseOrderStatus: 'anulada',
    invoiceNumber: 'F-1', invoiceStatus: 'anulada', invoiceDate: new Date('2026-04-01T00:00:00.000Z'),
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.sinOcBacklog, 100000) // factura anulada = como si no existiera
  assert.equal(m.facturado, 0)
})

test('pago parcial (informe #13) cuenta como por cobrar, no como cobrado', () => {
  const j: JobLike = {
    ...base, financialStage: 'payment_pending',
    invoiceNumber: 'F-3', invoiceDate: new Date('2026-06-01T00:00:00.000Z'), paymentAmount: 40000,
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.porCobrar, 100000) // se cuenta el neto completo, no el saldo
  assert.equal(m.cobrado, 0)
})

test('trabajo nonBillable no cuenta como vencido (isOverdueV2 lo excluye, jobIsOverdue clásico no lo hacía)', () => {
  const j: JobLike = {
    ...base, financialStage: 'invoiced', nonBillable: true,
    invoiceNumber: 'F-4', invoiceDate: new Date('2026-01-01T00:00:00.000Z'), creditDays: 30,
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.vencido, 0)
})

test('vencido sin creditDays: aplica el mismo fallback de 30 días que isOverdueV2 (jobIsOverdue clásico no tenía fallback y nunca marcaba vencido)', () => {
  const j: JobLike = {
    ...base, financialStage: 'invoiced',
    invoiceNumber: 'F-5', invoiceDate: new Date('2026-04-01T00:00:00.000Z'), creditDays: null,
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.vencido, 100000)
})

test('histórico sin campos v2 (financialStage/purchaseOrder nunca poblados) sigue leyendo el fallback clásico', () => {
  // 207 trabajos importados (ver ARQUITECTURA.md "Job — dos sistemas de
  // estado en paralelo") — sin este fallback ya probado en job-presets.ts,
  // aparecerían todos como "sin OC" pese a tener collectionStatus='pagado'.
  const j: JobLike = { ...base, collectionStatus: 'pagado', paymentDate: new Date('2026-05-01T00:00:00.000Z') }
  const m = computeMetrics([j], NOW)
  assert.equal(m.cobrado, 100000)
})

test('transversal: computeMetrics() nunca contradice a hasInvoiceInfo()/isPaidJob() para el mismo set de trabajos', () => {
  const jobs: JobLike[] = [
    { ...base },
    { ...base, financialStage: 'invoiced', invoiceNumber: 'F-10', invoiceDate: new Date('2026-05-01T00:00:00.000Z') },
    { ...base, financialStage: 'paid', invoiceNumber: 'F-11', invoiceDate: new Date('2026-04-01T00:00:00.000Z'), paymentAmount: 100000 },
    { ...base, purchaseOrder: 'OC-2', purchaseOrderStatus: 'anulada', invoiceNumber: 'F-12', invoiceStatus: 'anulada' },
  ]
  // facturado = pagado O facturado (isPaidJob gana primero, mismo orden que
  // financialState() ya usa) — no basta con hasInvoiceInfo solo.
  const expectedFacturado = jobs.filter((j) => isPaidJob(j) || hasInvoiceInfo(j)).reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const expectedCobrado = jobs.filter(isPaidJob).reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const m = computeMetrics(jobs, NOW)
  assert.equal(m.facturado, expectedFacturado)
  assert.equal(m.cobrado, expectedCobrado)
})

test('computeClientBreakdown usa el mismo criterio canónico que computeMetrics (informe #25)', () => {
  const jobs = [
    { ...base, clientId: 'c1', client: { name: 'Cliente A' } },
    { ...base, clientId: 'c1', client: { name: 'Cliente A' }, financialStage: 'paid', invoiceNumber: 'F-20', paymentAmount: 100000 },
  ]
  const [c1] = computeClientBreakdown(jobs)
  assert.equal(c1.sinOc, 100000)
  assert.equal(c1.cobrado, 100000)
})

test('computeMonthlyTrend usa el mismo criterio canónico que computeMetrics (informe #25)', () => {
  const jobs = [
    { ...base, executionDate: new Date('2026-03-15T00:00:00.000Z') },
    { ...base, executionDate: new Date('2026-03-20T00:00:00.000Z'), financialStage: 'paid', invoiceNumber: 'F-21', paymentAmount: 100000 },
  ]
  const trend = computeMonthlyTrend(jobs)
  assert.equal(trend.length, 1)
  assert.equal(trend[0].sinOc, 100000)
  assert.equal(trend[0].cobrado, 100000)
})

test('margin only when costs exist', () => {
  assert.deepEqual(jobMargin({ ...base }), { margin: null, marginPct: null })
  const withCost = jobMargin({ ...base, costs: [{ amount: 40000 }] })
  assert.equal(withCost.margin, 60000)
  assert.equal(Math.round(withCost.marginPct! * 100), 60)
})

// --- jobDirectCostAndMargin (informe #14) — costo directo real = JobCost +
// gastos de técnico vinculados por jobId, solo aprobados/pagados. jobMargin()
// de arriba NO cambia (dashboard/reportes siguen usándolo tal cual, fuera de
// alcance de #14) — esta es una variante nueva, no un reemplazo.

test('jobDirectCostAndMargin: sin costos ni gastos -> margin null (igual criterio que jobMargin)', () => {
  const r = jobDirectCostAndMargin({ netAmount: 100000, costs: [] }, [])
  assert.equal(r.margin, null)
  assert.equal(r.directCost, 0)
})

test('jobDirectCostAndMargin: solo JobCost (sin gastos de técnico) -> igual que jobMargin', () => {
  const r = jobDirectCostAndMargin({ netAmount: 100000, costs: [{ amount: 30000 }] }, [])
  assert.equal(r.jobCostTotal, 30000)
  assert.equal(r.expenseTotal, 0)
  assert.equal(r.directCost, 30000)
  assert.equal(r.margin, 70000)
})

test('jobDirectCostAndMargin: solo gastos de técnico (sin JobCost) -> cuentan igual', () => {
  const r = jobDirectCostAndMargin({ netAmount: 100000, costs: [] }, [{ amount: 20000, status: 'aprobado' }])
  assert.equal(r.jobCostTotal, 0)
  assert.equal(r.expenseTotal, 20000)
  assert.equal(r.directCost, 20000)
  assert.equal(r.margin, 80000)
})

test('jobDirectCostAndMargin: gastos pendientes o rechazados NO cuentan como costo confirmado', () => {
  const r = jobDirectCostAndMargin(
    { netAmount: 100000, costs: [] },
    [{ amount: 20000, status: 'pendiente' }, { amount: 15000, status: 'rechazado' }],
  )
  // expenseTotal excluye lo no confirmado, pero SÍ hay filas de gasto (a
  // diferencia de "sin datos") — se calcula margen sobre el costo confirmado
  // real (0 acá), no se devuelve null solo porque hay solicitudes pendientes.
  assert.equal(r.expenseTotal, 0)
  assert.equal(r.directCost, 0)
  assert.equal(r.margin, 100000)
})

test('REGRESIÓN doble conteo: JobCost + gasto de técnico DISTINTOS suman una sola vez cada uno, nunca se combinan en un tercer número', () => {
  // Escenario real: un técnico compró materiales (Expense, aprobado, vinculado
  // por jobId) Y por separado staff cargó mano de obra como JobCost — son dos
  // costos DISTINTOS del mismo trabajo, deben sumar exactamente su propio
  // monto una vez cada uno, nunca el doble de ninguno de los dos.
  const r = jobDirectCostAndMargin(
    { netAmount: 200000, costs: [{ amount: 50000 }] }, // mano de obra
    [{ amount: 30000, status: 'aprobado' }], // materiales del técnico
  )
  assert.equal(r.jobCostTotal, 50000)
  assert.equal(r.expenseTotal, 30000)
  assert.equal(r.directCost, 80000) // 50000 + 30000, ni más ni menos
  assert.equal(r.margin, 120000) // 200000 - 80000
})

test('jobDirectCostAndMargin: marginPct se calcula igual que jobMargin (0-1, no 0-100)', () => {
  const r = jobDirectCostAndMargin({ netAmount: 100000, costs: [{ amount: 40000 }] }, [])
  assert.equal(Math.round(r.marginPct! * 100), 60)
})

test('mix aggregates by type', () => {
  const m = computeMetrics(
    [{ ...base, type: 'emergencia' }, { ...base, type: 'emergencia' }, { ...base, type: 'preventivo' }],
    NOW,
  )
  assert.equal(m.mix.find((x) => x.type === 'emergencia')!.count, 2)
})
