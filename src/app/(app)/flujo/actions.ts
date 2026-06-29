'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { tenantScope } from '@/lib/tenant'
import { branchInput, jobInput, jobCostInput } from '@/lib/cashflow/schemas'
import { fromDateInput } from '@/lib/cashflow/dates'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function jobData(p: ReturnType<typeof jobInput.parse>) {
  return {
    branchId: p.branchId,
    description: p.description,
    type: p.type,
    status: p.status,
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
    collectionStatus: p.collectionStatus,
    paymentDate: fromDateInput(p.paymentDate),
  }
}

export async function createBranch(form: FormData) {
  const u = await requireActor()
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
  const u = await requireActor()
  const p = branchInput.parse({ clientId: form.get('clientId'), name: form.get('name'), active: form.get('active') === 'on' })
  await prisma.branch.updateMany({ where: { id, ...tenantScope(u) }, data: { name: p.name, active: p.active } })
  revalidatePath('/flujo/sucursales')
}

export async function deleteBranch(id: string) {
  const u = await requireActor()
  await prisma.branch.deleteMany({ where: { id, ...tenantScope(u) } })
  revalidatePath('/flujo/sucursales')
}

export async function createJob(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await requireActor()
  const parsed = jobInput.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, ...tenantScope(u) }, select: { id: true } })
  if (!client) return { error: 'Cliente no válido.' }
  const branch = await prisma.branch.findFirst({ where: { id: parsed.data.branchId, clientId: client.id, ...tenantScope(u) }, select: { id: true } })
  if (!branch) return { error: 'Sucursal no válida.' }
  if (parsed.data.technicianId) {
    const tech = await prisma.technician.findFirst({ where: { id: parsed.data.technicianId, ...tenantScope(u) }, select: { id: true } })
    if (!tech) return { error: 'Técnico no válido.' }
  }
  await prisma.job.create({ data: { tenantId: u.tenantId, clientId: parsed.data.clientId, ...jobData(parsed.data) } })
  revalidatePath('/flujo')
  redirect('/flujo/trabajos')
}

export async function updateJob(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const u = await requireActor()
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
  redirect('/flujo/trabajos')
}

export async function deleteJob(id: string) {
  const u = await requireActor()
  await prisma.job.deleteMany({ where: { id, ...tenantScope(u) } })
  revalidatePath('/flujo')
  redirect('/flujo/trabajos')
}

export async function addCost(form: FormData) {
  const u = await requireActor()
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

export async function deleteCost(id: string, jobId: string) {
  const u = await requireActor()
  await prisma.jobCost.deleteMany({
    where: { id, job: { id: jobId, ...tenantScope(u) } },
  })
  revalidatePath(`/flujo/trabajos/${jobId}`)
}
