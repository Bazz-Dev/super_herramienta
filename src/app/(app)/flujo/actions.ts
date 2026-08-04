'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { tenantScope } from '@/lib/tenant'
import { branchInput, jobInput, jobCostInput, jobQuickEditInput, jobInstallmentInput } from '@/lib/cashflow/schemas'
import { fromDateInput } from '@/lib/cashflow/dates'
import { deriveJobStatus, deriveCollectionStatus } from '@/lib/cashflow/derive-legacy-status'
import { generateJobCodeWithRetry, clientCodeFrom, JOB_TYPE_CODE } from '@/lib/cashflow/generate-code'
import { logAudit } from '@/lib/audit'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function jobData(p: ReturnType<typeof jobInput.parse>) {
  return {
    branchId: p.branchId,
    description: p.description,
    type: p.type,
    executionDate: fromDateInput(p.executionDate),
    costCenter: p.costCenter ?? null,
    jobNumber: p.jobNumber ?? null,
    quoteRef: p.quoteRef ?? null,
    hasTechReport: p.hasTechReport,
    technicianId: p.technicianId || null,
    notes: p.notes ?? null,
    extraNotes: p.extraNotes ?? null,
    netAmount: p.netAmount ?? null,
    taxAmount: p.taxAmount ?? null,
    purchaseOrder: p.purchaseOrder ?? null,
    purchaseOrderDate: fromDateInput(p.purchaseOrderDate),
    purchaseOrderStatus: p.purchaseOrderStatus ?? null,
    invoiceNumber: p.invoiceNumber ?? null,
    invoiceDate: fromDateInput(p.invoiceDate),
    invoiceStatus: p.invoiceStatus ?? null,
    creditDays: p.creditDays ?? null,
    paymentMethodRaw: p.paymentMethodRaw ?? null,
    paymentDate: fromDateInput(p.paymentDate),
    paymentAmount: p.paymentAmount ?? null,

    // Flujo de Caja v2 — status/collectionStatus (arriba, legacy) se derivan
    // de estos en vez de aceptarse sueltos del form, para que nunca queden
    // desincronizados con el detalle real.
    processFlow: p.processFlow,
    commercialStage: p.commercialStage,
    operationalStage: p.operationalStage,
    documentationStage: p.documentationStage,
    financialStage: p.financialStage,
    status: deriveJobStatus(p.operationalStage, p.nonBillable),
    collectionStatus: deriveCollectionStatus(p.financialStage),
    docOt: p.docOt,
    docPhotos: p.docPhotos,
    docReport: p.docReport,
    docClientSent: p.docClientSent,
    rejectionReason: p.rejectionReason ?? null,
    rejectionDate: fromDateInput(p.rejectionDate),
    nonBillable: p.nonBillable,
    nonBillableReason: p.nonBillableReason ?? null,
    lastContactDate: fromDateInput(p.lastContactDate),
    nextContactDate: fromDateInput(p.nextContactDate),
    contactNote: p.contactNote ?? null,
  }
}

export async function createBranch(form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const p = branchInput.parse({
    clientId: form.get('clientId'),
    name: form.get('name'),
    active: form.get('active') === 'on',
  })
  const client = await prisma.client.findFirst({ where: { id: p.clientId, ...tenantScope(u) }, select: { id: true } })
  if (!client) throw new Error('Cliente no válido.')
  await prisma.branch.create({ data: { tenantId: u.tenantId, clientId: p.clientId, name: p.name, active: p.active } })
  revalidatePath('/flujo/sucursales')
}

export async function updateBranch(id: string, form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const p = branchInput.parse({ clientId: form.get('clientId'), name: form.get('name'), active: form.get('active') === 'on' })
  await prisma.branch.updateMany({ where: { id, ...tenantScope(u) }, data: { name: p.name, active: p.active } })
  revalidatePath('/flujo/sucursales')
}

export async function deleteBranch(id: string): Promise<{ error?: string }> {
  const u = await requireActor(['super', 'supervisor'])
  // Job.branchId es onDelete:Restrict — tiraría un 500 crudo de Prisma (G35).
  const jobs = await prisma.job.count({ where: { branchId: id, ...tenantScope(u) } })
  if (jobs) return { error: `No se puede eliminar: tiene ${jobs} trabajo(s) asociados.` }
  await prisma.branch.deleteMany({ where: { id, ...tenantScope(u) } })
  revalidatePath('/flujo/sucursales')
  return {}
}

export async function createJob(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await requireActor(['super', 'supervisor'])
  const parsed = jobInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, ...tenantScope(u) }, select: { id: true, name: true } })
  if (!client) return { error: 'Cliente no válido.' }
  const branch = await prisma.branch.findFirst({ where: { id: parsed.data.branchId, clientId: client.id, ...tenantScope(u) }, select: { id: true } })
  if (!branch) return { error: 'Sucursal no válida.' }
  if (parsed.data.technicianId) {
    const tech = await prisma.technician.findFirst({ where: { id: parsed.data.technicianId, ...tenantScope(u) }, select: { id: true } })
    if (!tech) return { error: 'Técnico no válido.' }
  }
  // Ticket de origen obligatorio para trabajos NUEVOS (informe #1 del plan de
  // ordenamiento) — updateJob es una función separada, así que esto no
  // afecta editar trabajos históricos que ya existen sin ticket.
  const originTicketId = (form.get('originTicketId') as string | null) || null
  if (!originTicketId) return { error: 'Selecciona un ticket de origen (o crea uno nuevo) antes de guardar.' }
  const tkt = await prisma.ticket.findFirst({ where: { id: originTicketId, tenantId: u.tenantId }, select: { id: true, clientId: true } })
  if (!tkt) return { error: 'Ticket origen no válido.' }
  if (tkt.clientId !== parsed.data.clientId) return { error: 'El ticket elegido pertenece a otro cliente.' }
  const originProposalId = (form.get('originProposalId') as string | null) || null
  if (originProposalId) {
    const doc = await prisma.clientDocument.findFirst({ where: { id: originProposalId, tenantId: u.tenantId, type: 'propuesta' }, select: { id: true } })
    if (!doc) return { error: 'Propuesta origen no válida.' }
  }
  const job = await generateJobCodeWithRetry(
    clientCodeFrom(client.name),
    JOB_TYPE_CODE[parsed.data.type] ?? 'OT',
    parsed.data.executionDate || null,
    (code) =>
      prisma.job.create({
        data: {
          tenantId: u.tenantId,
          clientId: parsed.data.clientId,
          code,
          ...jobData(parsed.data),
          ...(originTicketId ? { originTicketId } : {}),
          ...(originProposalId ? { originProposalId } : {}),
        },
      }),
  )
  revalidatePath('/flujo')
  redirect(`/flujo/trabajos/${job.id}`)
}

export async function updateJob(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const u = await requireActor(['super', 'supervisor'])
  const parsed = jobInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const branch = await prisma.branch.findFirst({ where: { id: parsed.data.branchId, ...tenantScope(u) }, select: { id: true } })
  if (!branch) return { error: 'Sucursal no válida.' }
  if (parsed.data.technicianId) {
    const tech = await prisma.technician.findFirst({ where: { id: parsed.data.technicianId, ...tenantScope(u) }, select: { id: true } })
    if (!tech) return { error: 'Técnico no válido.' }
  }
  const before = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { status: true, docClientSent: true, originTicketId: true, purchaseOrderStatus: true, invoiceStatus: true, paymentAmount: true, netAmount: true } })
  await prisma.job.updateMany({ where: { id, ...tenantScope(u) }, data: jobData(parsed.data) })

  if (before) {
    // Monto pagado (informe #13 agregó "Monto pagado (CLP)" a esta ficha,
    // pero nunca quedó auditado acá — a diferencia de markJobPaid/
    // markJobPending, que sí auditan desde el día uno). Bug real encontrado
    // en la verificación en vivo del release: un pago se podía registrar o
    // revertir por la ficha completa sin dejar ningún rastro en auditoría.
    // beforeAmt/afterAmt tratan null y 0 como "sin pago" — jobInput usa
    // z.coerce.number() sin el preprocesador optionalNonNegInt (mismo hueco
    // ya documentado en G52, no se toca acá), así que un campo nunca tocado
    // llega como 0 en vez de undefined; sin este resguardo cada guardado de
    // un trabajo sin pago dispararía un evento falso.
    const beforeAmt = before.paymentAmount ?? 0
    const afterAmt = parsed.data.paymentAmount ?? 0
    if (beforeAmt !== afterAmt && (beforeAmt > 0 || afterAmt > 0)) {
      const isPaidNow = before.netAmount != null && afterAmt >= before.netAmount
      await logAudit({
        tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
        action: afterAmt === 0 ? 'job.mark_pending' : isPaidNow ? 'job.mark_paid' : 'job.payment_partial',
        entityType: 'Job', entityId: id,
        before: { paymentAmount: before.paymentAmount }, after: { paymentAmount: parsed.data.paymentAmount ?? null, ticketId: before.originTicketId },
        source: 'flujo/actions.ts:updateJob',
      })
    }
    // OC anulada (informe #11) — distinto de "trabajo anulado" (job.void más
    // abajo): la OC puede anularse sin que el trabajo completo se cancele
    // (el cliente reemplaza la OC por otra, el trabajo sigue en pie).
    if (parsed.data.purchaseOrderStatus === 'anulada' && before.purchaseOrderStatus !== 'anulada') {
      await logAudit({
        tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
        action: 'job.po_void', entityType: 'Job', entityId: id,
        before: { purchaseOrderStatus: before.purchaseOrderStatus }, after: { purchaseOrderStatus: 'anulada', ticketId: before.originTicketId },
        source: 'flujo/actions.ts:updateJob',
      })
    }
    // Factura anulada (informe #13) — mismo criterio que job.po_void: la
    // factura puede anularse (nota de crédito, error de emisión) sin anular
    // el trabajo completo.
    if (parsed.data.invoiceStatus === 'anulada' && before.invoiceStatus !== 'anulada') {
      await logAudit({
        tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
        action: 'job.invoice_void', entityType: 'Job', entityId: id,
        before: { invoiceStatus: before.invoiceStatus }, after: { invoiceStatus: 'anulada', ticketId: before.originTicketId },
        source: 'flujo/actions.ts:updateJob',
      })
    }
    // Trabajo completo anulado (informe #32B punto 6/7) — distinto de
    // job.po_void/job.invoice_void arriba, que son solo la OC o la factura.
    if (parsed.data.status === 'anulado' && before.status !== 'anulado') {
      await logAudit({
        tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
        action: 'job.void', entityType: 'Job', entityId: id,
        before: { status: before.status }, after: { status: 'anulado', ticketId: before.originTicketId },
        source: 'flujo/actions.ts:updateJob',
      })
    }
    // "Informe hecho visible/enviado" (informe #32B punto 5): el estado real
    // del sistema es este checkbox tri-estado de documentación, no un
    // "publicado" separado — no existe ese concepto (ver GAP_REGISTER).
    if (parsed.data.docClientSent !== before.docClientSent) {
      await logAudit({
        tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
        action: 'job.doc_client_sent', entityType: 'Job', entityId: id,
        before: { docClientSent: before.docClientSent }, after: { docClientSent: parsed.data.docClientSent, ticketId: before.originTicketId },
        source: 'flujo/actions.ts:updateJob',
      })
    }
  }
  revalidatePath('/flujo')
  redirect('/flujo')
}

export async function deleteJob(id: string) {
  const u = await requireActor(['super', 'supervisor'])
  const job = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { code: true, purchaseOrder: true, invoiceNumber: true, netAmount: true, originTicketId: true } })
  await prisma.job.deleteMany({ where: { id, ...tenantScope(u) } })
  if (job) {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job.delete', entityType: 'Job', entityId: id,
      before: { code: job.code, purchaseOrder: job.purchaseOrder, invoiceNumber: job.invoiceNumber, netAmount: job.netAmount, ticketId: job.originTicketId },
      source: 'flujo/actions.ts:deleteJob',
    })
  }
  revalidatePath('/flujo')
  redirect('/flujo')
}

export async function addCost(form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const p = jobCostInput.parse(Object.fromEntries(form))
  const job = await prisma.job.findFirst({ where: { id: p.jobId, ...tenantScope(u) } })
  if (!job) throw new Error('No autorizado')
  await prisma.jobCost.create({
    data: {
      jobId: p.jobId,
      category: p.category,
      description: p.description ?? null,
      amount: p.amount,
      date: fromDateInput(p.date),
      supplier: p.supplier ?? null,
      documentRef: p.documentRef ?? null,
    },
  })
  revalidatePath(`/flujo/trabajos/${p.jobId}`)
}

// Edición rápida in-line desde el acordeón de /flujo (no navega, no redirige).
// Bloque A (datos principales) + bloque B (cobranza) viajan en el mismo
// submit — mismo patrón "reemplaza todo el bloque visible" que ya usaba
// esta acción para cobranza, extendido en vez de reescrito.
export async function quickUpdateJob(id: string, form: FormData): Promise<FormState> {
  const u = await requireActor(['super', 'supervisor'])
  const parsed = jobQuickEditInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const p = parsed.data

  if (p.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: p.branchId, ...tenantScope(u) }, select: { id: true } })
    if (!branch) return { error: 'Sucursal no válida.', fieldErrors: { branchId: ['Sucursal no válida'] } }
  }
  if (p.technicianId) {
    const tech = await prisma.technician.findFirst({ where: { id: p.technicianId, ...tenantScope(u) }, select: { id: true } })
    if (!tech) return { error: 'Técnico no válido.', fieldErrors: { technicianId: ['Técnico no válido'] } }
  }

  const job = await prisma.job.findFirst({
    where: { id, ...tenantScope(u) },
    select: { originTicketId: true, purchaseOrder: true, invoiceNumber: true, invoiceDate: true, netAmount: true },
  })
  if (!job) return { error: 'Trabajo no encontrado.' }

  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
      ...(p.branchId ? { branchId: p.branchId } : {}),
      ...(p.description !== undefined ? { description: p.description } : {}),
      ...(p.type ? { type: p.type } : {}),
      ...(p.executionDate !== undefined ? { executionDate: fromDateInput(p.executionDate) } : {}),
      ...(p.technicianId !== undefined ? { technicianId: p.technicianId || null } : {}),
      quoteRef: p.quoteRef ?? null,
      code: p.code || null,
      purchaseOrder: p.purchaseOrder ?? null,
      invoiceNumber: p.invoiceNumber ?? null,
      invoiceDate: fromDateInput(p.invoiceDate),
      creditDays: p.creditDays ?? null,
      netAmount: p.netAmount ?? null,
      taxAmount: p.taxAmount ?? null,
    },
  })

  // Solo se audita si el editor rápido realmente tocó OC/factura/monto — el
  // resto de los campos (descripción, técnico, fecha) no son financieros
  // (informe #32B: ROI, no auditar cada campo).
  const ocOrInvoiceChanged =
    (p.purchaseOrder ?? null) !== job.purchaseOrder ||
    (p.invoiceNumber ?? null) !== job.invoiceNumber ||
    (p.netAmount ?? null) !== job.netAmount
  if (ocOrInvoiceChanged) {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job.update_financial', entityType: 'Job', entityId: id,
      before: { purchaseOrder: job.purchaseOrder, invoiceNumber: job.invoiceNumber, netAmount: job.netAmount },
      after: { purchaseOrder: p.purchaseOrder ?? null, invoiceNumber: p.invoiceNumber ?? null, netAmount: p.netAmount ?? null, ticketId: job.originTicketId },
      source: 'flujo/actions.ts:quickUpdateJob',
    })
  }

  // Asignar técnico a un trabajo "por agendar" debe reflejarse en el ticket
  // de origen — si no, el técnico nunca ve el trabajo asignado en Tickets,
  // que es la superficie real donde opera. Ticket.assignedToId es un
  // User.id, no un Technician.id (relación suelta, ver .claude/rules/data.md)
  // — se resuelve vía User.technicianId. Si el técnico no tiene cuenta
  // vinculada, se guarda el trabajo igual y el ticket queda sin tocar.
  if (p.technicianId && job.originTicketId) {
    const technicianUser = await prisma.user.findFirst({ where: { technicianId: p.technicianId }, select: { id: true } })
    if (technicianUser) {
      await prisma.ticket.updateMany({ where: { id: job.originTicketId, tenantId: u.tenantId }, data: { assignedToId: technicianUser.id } })
      revalidatePath(`/tickets/${job.originTicketId}`)
    }
  }

  revalidatePath('/flujo')
  return {}
}

// Botón de estado de pago del acordeón — mark/revert son dos acciones
// separadas (no un toggle de un clic): marcar pagada pide fecha/medio de
// pago, revertir pide solo confirmación. Es dinero real, no un checkbox.
export async function markJobPaid(id: string, form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const job = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { operationalStage: true, nonBillable: true, financialStage: true, paymentDate: true, paymentAmount: true, netAmount: true, originTicketId: true } })
  if (!job) return
  const paymentDate = fromDateInput(form.get('paymentDate') as string) ?? new Date()
  const paymentMethodRaw = (form.get('paymentMethodRaw') as string | null)?.trim() || null
  // Monto opcional (informe #13) — si el form no lo manda (callers viejos,
  // o el propio usuario deja el campo con el total precargado) se completa
  // con netAmount, igual comportamiento que siempre: pago total. Solo un
  // monto EXPLÍCITO menor al total activa el camino de pago parcial.
  const rawAmount = form.get('paymentAmount') as string | null
  const explicitAmount = rawAmount ? parseInt(rawAmount, 10) : null
  const paymentAmount = explicitAmount ?? job.netAmount ?? null
  const isPartial = explicitAmount != null && job.netAmount != null && explicitAmount < job.netAmount
  const financialStage = isPartial ? 'payment_pending' : 'paid'
  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
      financialStage,
      collectionStatus: deriveCollectionStatus(financialStage),
      paymentDate,
      paymentAmount,
      paymentMethodRaw,
      status: deriveJobStatus(job.operationalStage, job.nonBillable),
    },
  })
  await logAudit({
    tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
    action: isPartial ? 'job.payment_partial' : 'job.mark_paid',
    entityType: 'Job', entityId: id,
    before: { financialStage: job.financialStage, paymentDate: job.paymentDate, paymentAmount: job.paymentAmount },
    after: { financialStage, paymentDate, paymentAmount, paymentMethodRaw, ticketId: job.originTicketId },
    source: 'flujo/actions.ts:markJobPaid',
  })
  revalidatePath('/flujo')
}

// Reversa de pago (informe #13, criterio ya usado desde antes de este
// bloque: revertir es una acción propia, no editar el monto a mano) — limpia
// también paymentAmount para que un pago parcial reversado no deje un saldo
// fantasma; volver a marcar pago parte de cero.
export async function markJobPending(id: string) {
  const u = await requireActor(['super', 'supervisor'])
  const job = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { operationalStage: true, nonBillable: true, financialStage: true, paymentDate: true, paymentAmount: true, originTicketId: true } })
  if (!job) return
  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
      financialStage: 'payment_pending',
      collectionStatus: deriveCollectionStatus('payment_pending'),
      paymentDate: null,
      paymentAmount: null,
      status: deriveJobStatus(job.operationalStage, job.nonBillable),
    },
  })
  await logAudit({
    tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
    action: 'job.mark_pending', entityType: 'Job', entityId: id,
    before: { financialStage: job.financialStage, paymentDate: job.paymentDate, paymentAmount: job.paymentAmount },
    after: { financialStage: 'payment_pending', paymentDate: null, paymentAmount: null, ticketId: job.originTicketId },
    reason: 'Revertir pago marcado por error',
    source: 'flujo/actions.ts:markJobPending',
  })
  revalidatePath('/flujo')
}

export async function deleteCost(id: string, jobId: string) {
  const u = await requireActor(['super', 'supervisor'])
  await prisma.jobCost.deleteMany({
    where: { id, job: { id: jobId, ...tenantScope(u) } },
  })
  revalidatePath(`/flujo/trabajos/${jobId}`)
}

// Cuotas (informe #12) — "Activar pago en cuotas" es solo fijar un número
// planificado; no crea filas. `null`/0 desactiva la sección (vuelve a
// mostrarse el OC/factura plano de siempre, sin borrar cuotas ya creadas).
export async function setInstallmentsPlanned(jobId: string, count: number | null) {
  const u = await requireActor(['super', 'supervisor'])
  await prisma.job.updateMany({
    where: { id: jobId, ...tenantScope(u) },
    data: { installmentsPlanned: count && count > 0 ? count : null },
  })
  revalidatePath(`/flujo/trabajos/${jobId}`)
}

export async function addInstallment(form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const p = jobInstallmentInput.parse(Object.fromEntries(form))
  const job = await prisma.job.findFirst({ where: { id: p.jobId, ...tenantScope(u) }, select: { id: true, _count: { select: { installments: true } } } })
  if (!job) throw new Error('No autorizado')
  const created = await prisma.jobInstallment.create({
    data: {
      jobId: p.jobId,
      sequence: job._count.installments + 1,
      netAmount: p.netAmount ?? null,
      purchaseOrder: p.purchaseOrder ?? null,
      purchaseOrderDate: fromDateInput(p.purchaseOrderDate),
      purchaseOrderStatus: p.purchaseOrderStatus ?? null,
      invoiceNumber: p.invoiceNumber ?? null,
      invoiceDate: fromDateInput(p.invoiceDate),
      invoiceStatus: p.invoiceStatus ?? null,
      creditDays: p.creditDays ?? null,
      paymentMethodRaw: p.paymentMethodRaw ?? null,
      paymentDate: fromDateInput(p.paymentDate),
      paymentAmount: p.paymentAmount ?? null,
      notes: p.notes ?? null,
      createdById: u.id,
    },
  })
  await logAudit({
    tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
    action: 'job_installment.create', entityType: 'JobInstallment', entityId: created.id,
    after: { jobId: p.jobId, sequence: created.sequence, netAmount: p.netAmount ?? null, purchaseOrder: p.purchaseOrder ?? null, invoiceNumber: p.invoiceNumber ?? null },
    source: 'flujo/actions.ts:addInstallment',
  })
  revalidatePath(`/flujo/trabajos/${p.jobId}`)
}

// Edición in-line — mismo caso de uso real que motiva el punto 12: la cuota
// se crea con su OC apenas se sabe el monto, y la factura/pago se agregan
// después, cuando llegan (no se re-crea la fila, se completa).
export async function updateInstallment(id: string, form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const p = jobInstallmentInput.parse(Object.fromEntries(form))
  const existing = await prisma.jobInstallment.findFirst({
    where: { id, job: { ...tenantScope(u) } },
    select: { jobId: true, netAmount: true, purchaseOrder: true, purchaseOrderStatus: true, invoiceNumber: true, invoiceStatus: true, paymentAmount: true, paymentDate: true },
  })
  if (!existing) throw new Error('No autorizado')
  await prisma.jobInstallment.update({
    where: { id },
    data: {
      netAmount: p.netAmount ?? null,
      purchaseOrder: p.purchaseOrder ?? null,
      purchaseOrderDate: fromDateInput(p.purchaseOrderDate),
      purchaseOrderStatus: p.purchaseOrderStatus ?? null,
      invoiceNumber: p.invoiceNumber ?? null,
      invoiceDate: fromDateInput(p.invoiceDate),
      invoiceStatus: p.invoiceStatus ?? null,
      creditDays: p.creditDays ?? null,
      paymentMethodRaw: p.paymentMethodRaw ?? null,
      paymentDate: fromDateInput(p.paymentDate),
      paymentAmount: p.paymentAmount ?? null,
      notes: p.notes ?? null,
    },
  })
  // OC de esta cuota anulada (informe #11) — mismo criterio que job.po_void,
  // a nivel de una cuota individual en vez del trabajo completo.
  if (p.purchaseOrderStatus === 'anulada' && existing.purchaseOrderStatus !== 'anulada') {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job_installment.po_void', entityType: 'JobInstallment', entityId: id,
      before: { purchaseOrderStatus: existing.purchaseOrderStatus }, after: { purchaseOrderStatus: 'anulada', jobId: existing.jobId },
      source: 'flujo/actions.ts:updateInstallment',
    })
  }
  // Factura de esta cuota anulada (informe #13) — mismo criterio que
  // job.invoice_void, a nivel de una cuota individual.
  if (p.invoiceStatus === 'anulada' && existing.invoiceStatus !== 'anulada') {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job_installment.invoice_void', entityType: 'JobInstallment', entityId: id,
      before: { invoiceStatus: existing.invoiceStatus }, after: { invoiceStatus: 'anulada', jobId: existing.jobId },
      source: 'flujo/actions.ts:updateInstallment',
    })
  }
  // Pago de esta cuota registrado o reversado (informe #13) — categoría
  // propia, separada del "editar" genérico de abajo: es la decisión
  // financiera real (recibimos plata / la devolvimos por error), no un dato
  // administrativo cualquiera de la cuota.
  const hadPayment = (existing.paymentAmount ?? 0) > 0
  const hasPayment = (p.paymentAmount ?? 0) > 0
  if (!hadPayment && hasPayment) {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job_installment.payment_record', entityType: 'JobInstallment', entityId: id,
      before: { paymentAmount: existing.paymentAmount, paymentDate: existing.paymentDate },
      after: { paymentAmount: p.paymentAmount, paymentDate: fromDateInput(p.paymentDate), jobId: existing.jobId },
      source: 'flujo/actions.ts:updateInstallment',
    })
  } else if (hadPayment && !hasPayment) {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job_installment.payment_reverse', entityType: 'JobInstallment', entityId: id,
      before: { paymentAmount: existing.paymentAmount, paymentDate: existing.paymentDate },
      after: { paymentAmount: null, paymentDate: null, jobId: existing.jobId },
      reason: 'Revertir pago marcado por error',
      source: 'flujo/actions.ts:updateInstallment',
    })
  }
  await logAudit({
    tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
    action: 'job_installment.update', entityType: 'JobInstallment', entityId: id,
    before: { netAmount: existing.netAmount, purchaseOrder: existing.purchaseOrder, invoiceNumber: existing.invoiceNumber, paymentAmount: existing.paymentAmount, paymentDate: existing.paymentDate },
    after: { netAmount: p.netAmount ?? null, purchaseOrder: p.purchaseOrder ?? null, invoiceNumber: p.invoiceNumber ?? null, paymentAmount: p.paymentAmount ?? null, paymentDate: fromDateInput(p.paymentDate) },
    source: 'flujo/actions.ts:updateInstallment',
  })
  revalidatePath(`/flujo/trabajos/${existing.jobId}`)
}

export async function deleteInstallment(id: string, jobId: string) {
  const u = await requireActor(['super', 'supervisor'])
  const existing = await prisma.jobInstallment.findFirst({
    where: { id, job: { id: jobId, ...tenantScope(u) } },
    select: { sequence: true, netAmount: true, purchaseOrder: true },
  })
  await prisma.jobInstallment.deleteMany({ where: { id, job: { id: jobId, ...tenantScope(u) } } })
  if (existing) {
    await logAudit({
      tenantId: u.tenantId, actorId: u.id, actorRole: u.role,
      action: 'job_installment.delete', entityType: 'JobInstallment', entityId: id,
      before: { jobId, sequence: existing.sequence, netAmount: existing.netAmount, purchaseOrder: existing.purchaseOrder },
      source: 'flujo/actions.ts:deleteInstallment',
    })
  }
  revalidatePath(`/flujo/trabajos/${jobId}`)
}

// Detalle completo para el drill-down de /flujo/reportes — click en una
// fila abre esto en un panel en vez de navegar a /flujo/trabajos/[id].
// Job.technicianId no tiene relación Prisma declarada (solo el scalar),
// así que el técnico se resuelve aparte.
export async function getJobSummary(id: string) {
  const u = await requireActor()
  const job = await prisma.job.findFirst({
    where: { id, ...tenantScope(u) },
    include: {
      branch: { select: { name: true } },
      client: { select: { name: true } },
      costs: { select: { id: true, category: true, amount: true, supplier: true } },
      originTicket: { select: { id: true, ticketCode: true, title: true, status: true } },
    },
  })
  if (!job) return null
  const technician = job.technicianId
    ? await prisma.technician.findUnique({ where: { id: job.technicianId }, select: { name: true } })
    : null
  return { ...job, technicianName: technician?.name ?? null }
}
