'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { tenantScope } from '@/lib/tenant'
import { branchInput, jobInput, jobCostInput, jobQuickEditInput } from '@/lib/cashflow/schemas'
import { fromDateInput } from '@/lib/cashflow/dates'
import { deriveJobStatus, deriveCollectionStatus } from '@/lib/cashflow/derive-legacy-status'
import { generateJobCode, clientCodeFrom, JOB_TYPE_CODE } from '@/lib/cashflow/generate-code'

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
    invoiceNumber: p.invoiceNumber ?? null,
    invoiceDate: fromDateInput(p.invoiceDate),
    creditDays: p.creditDays ?? null,
    paymentMethodRaw: p.paymentMethodRaw ?? null,
    paymentDate: fromDateInput(p.paymentDate),

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
  const originTicketId = (form.get('originTicketId') as string | null) || null
  if (originTicketId) {
    const tkt = await prisma.ticket.findFirst({ where: { id: originTicketId, tenantId: u.tenantId }, select: { id: true } })
    if (!tkt) return { error: 'Ticket origen no válido.' }
  }
  const originProposalId = (form.get('originProposalId') as string | null) || null
  if (originProposalId) {
    const doc = await prisma.clientDocument.findFirst({ where: { id: originProposalId, tenantId: u.tenantId, type: 'propuesta' }, select: { id: true } })
    if (!doc) return { error: 'Propuesta origen no válida.' }
  }
  const code = await generateJobCode(clientCodeFrom(client.name), JOB_TYPE_CODE[parsed.data.type] ?? 'OT', parsed.data.executionDate || null)
  const job = await prisma.job.create({
    data: {
      tenantId: u.tenantId,
      clientId: parsed.data.clientId,
      code,
      ...jobData(parsed.data),
      ...(originTicketId ? { originTicketId } : {}),
      ...(originProposalId ? { originProposalId } : {}),
    },
  })
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
  await prisma.job.updateMany({ where: { id, ...tenantScope(u) }, data: jobData(parsed.data) })
  revalidatePath('/flujo')
  redirect('/flujo')
}

export async function deleteJob(id: string) {
  const u = await requireActor(['super', 'supervisor'])
  await prisma.job.deleteMany({ where: { id, ...tenantScope(u) } })
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
export async function quickUpdateJob(id: string, form: FormData): Promise<{ error?: string }> {
  const u = await requireActor(['super', 'supervisor'])
  const parsed = jobQuickEditInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revisa los campos.' }
  const p = parsed.data
  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
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
  revalidatePath('/flujo')
  return {}
}

// Botón de estado de pago del acordeón — mark/revert son dos acciones
// separadas (no un toggle de un clic): marcar pagada pide fecha/medio de
// pago, revertir pide solo confirmación. Es dinero real, no un checkbox.
export async function markJobPaid(id: string, form: FormData) {
  const u = await requireActor(['super', 'supervisor'])
  const job = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { operationalStage: true, nonBillable: true } })
  if (!job) return
  const paymentDate = fromDateInput(form.get('paymentDate') as string) ?? new Date()
  const paymentMethodRaw = (form.get('paymentMethodRaw') as string | null)?.trim() || null
  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
      financialStage: 'paid',
      collectionStatus: deriveCollectionStatus('paid'),
      paymentDate,
      paymentMethodRaw,
      status: deriveJobStatus(job.operationalStage, job.nonBillable),
    },
  })
  revalidatePath('/flujo')
}

export async function markJobPending(id: string) {
  const u = await requireActor(['super', 'supervisor'])
  const job = await prisma.job.findFirst({ where: { id, ...tenantScope(u) }, select: { operationalStage: true, nonBillable: true } })
  if (!job) return
  await prisma.job.updateMany({
    where: { id, ...tenantScope(u) },
    data: {
      financialStage: 'payment_pending',
      collectionStatus: deriveCollectionStatus('payment_pending'),
      paymentDate: null,
      status: deriveJobStatus(job.operationalStage, job.nonBillable),
    },
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
