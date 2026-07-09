'use server'

import { prisma } from '@/lib/prisma'
import { tenantScope, requireActor } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'
import { fromDateInput } from '@/lib/cashflow/dates'
import type { LeaveType, LeaveStatus, PayrollStatus } from '@/generated/prisma/enums'
import { headers } from 'next/headers'

// ─── Leave Requests ────────────────────────────────────────────

export async function createLeaveRequest(data: {
  technicianId: string
  type: string
  startDate: string
  endDate: string
  days: number
  note?: string
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const tech = await prisma.technician.findFirst({
    where: { id: data.technicianId, ...scope },
    select: { id: true },
  })
  if (!tech) throw new Error('Técnico no encontrado')

  await prisma.leaveRequest.create({
    data: {
      tenantId: scope.tenantId ?? actor.tenantId,
      technicianId: data.technicianId,
      type: data.type as LeaveType,
      startDate: fromDateInput(data.startDate)!,
      endDate: fromDateInput(data.endDate)!,
      days: data.days,
      note: data.note,
    },
  })
  revalidatePath('/rrhh')
  revalidatePath('/rrhh/vacaciones')
}

export async function updateLeaveStatus(id: string, status: 'aprobado' | 'rechazado') {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const leave = await prisma.leaveRequest.findFirst({
    where: { id, tenantId: scope.tenantId },
    select: { id: true },
  })
  if (!leave) throw new Error('Solicitud no encontrada')

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: status as LeaveStatus, approvedById: actor.id },
  })
  revalidatePath('/rrhh')
  revalidatePath('/rrhh/vacaciones')
}

export async function deleteLeaveRequest(id: string) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  await prisma.leaveRequest.deleteMany({ where: { id, tenantId: scope.tenantId } })
  revalidatePath('/rrhh/vacaciones')
}

// ─── Payroll ────────────────────────────────────────────────────

export async function upsertPayroll(data: {
  technicianId: string
  month: number
  year: number
  baseSalary: number
  extras: number
  deductions: number
  note?: string
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const tech = await prisma.technician.findFirst({
    where: { id: data.technicianId, ...scope },
    select: { id: true },
  })
  if (!tech) throw new Error('Técnico no encontrado')

  await prisma.payroll.upsert({
    where: { technicianId_month_year: { technicianId: data.technicianId, month: data.month, year: data.year } },
    create: { tenantId: scope.tenantId ?? actor.tenantId, ...data, status: 'borrador' },
    update: { baseSalary: data.baseSalary, extras: data.extras, deductions: data.deductions, note: data.note },
  })
  revalidatePath('/rrhh/liquidaciones')
}

export async function updatePayrollStatus(id: string, status: 'emitido' | 'pagado') {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  await prisma.payroll.updateMany({
    where: { id, tenantId: scope.tenantId },
    data: { status: status as PayrollStatus, ...(status === 'pagado' ? { paidAt: new Date() } : {}) },
  })
  revalidatePath('/rrhh/liquidaciones')
}

export async function deletePayroll(id: string) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)
  await prisma.payroll.deleteMany({ where: { id, tenantId: scope.tenantId } })
  revalidatePath('/rrhh/liquidaciones')
}

// ─── Tecnico self-service leave request ─────────────────────────

export async function requestLeaveAsTecnico(data: {
  type: string
  startDate: string
  endDate: string
  days: number
  note?: string
}) {
  const actor = await requireActor()
  if (!actor.technicianId) throw new Error('Tu usuario no tiene técnico asociado')

  const tech = await prisma.technician.findFirst({
    where: { id: actor.technicianId, tenantId: actor.tenantId },
    select: { id: true },
  })
  if (!tech) throw new Error('Técnico no encontrado')

  await prisma.leaveRequest.create({
    data: {
      tenantId: actor.tenantId,
      technicianId: actor.technicianId,
      type: data.type as LeaveType,
      startDate: fromDateInput(data.startDate)!,
      endDate: fromDateInput(data.endDate)!,
      days: data.days,
      note: data.note,
    },
  })
  revalidatePath('/mi-panel')
  revalidatePath('/rrhh/vacaciones')
}

// ─── Technician profile fields ──────────────────────────────────

export async function updateTechnicianHRFields(techId: string, data: {
  hireDate?: string | null
  baseSalary?: number | null
  address?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  phone2?: string | null
  mutualidad?: string | null
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  await prisma.technician.updateMany({
    where: { id: techId, ...scope },
    data: {
      ...(data.hireDate !== undefined ? { hireDate: fromDateInput(data.hireDate) } : {}),
      ...(data.baseSalary !== undefined ? { baseSalary: data.baseSalary } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
      ...(data.emergencyPhone !== undefined ? { emergencyPhone: data.emergencyPhone } : {}),
      ...(data.phone2 !== undefined ? { phone2: data.phone2 } : {}),
      ...(data.mutualidad !== undefined ? { mutualidad: data.mutualidad } : {}),
    },
  })
  revalidatePath(`/rrhh/${techId}`)
  revalidatePath('/rrhh')
}

// ─── FES — Firma Electrónica Simple ────────────────────────────

export async function signDocument(signatureId: string, rutConfirmed: string) {
  const actor = await requireActor()
  if (!actor.technicianId) throw new Error('Sin técnico asociado')

  const sig = await prisma.signatureRequest.findFirst({
    where: { id: signatureId, technicianId: actor.technicianId, tenantId: actor.tenantId },
    select: { id: true, status: true },
  })
  if (!sig) throw new Error('Documento no encontrado')
  if (sig.status !== 'pendiente') throw new Error('Este documento ya fue procesado')

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? 'unknown'

  await prisma.signatureRequest.update({
    where: { id: signatureId },
    data: { status: 'firmado', rutConfirmed, signedAt: new Date(), signedIp: ip },
  })
  revalidatePath('/mi-panel')
  revalidatePath(`/mi-panel/firma/${signatureId}`)
  revalidatePath(`/rrhh/${actor.technicianId}`)
}

export async function rejectDocument(signatureId: string, note: string) {
  const actor = await requireActor()
  if (!actor.technicianId) throw new Error('Sin técnico asociado')

  const sig = await prisma.signatureRequest.findFirst({
    where: { id: signatureId, technicianId: actor.technicianId, tenantId: actor.tenantId },
    select: { id: true, status: true },
  })
  if (!sig) throw new Error('Documento no encontrado')
  if (sig.status !== 'pendiente') throw new Error('Este documento ya fue procesado')

  await prisma.signatureRequest.update({
    where: { id: signatureId },
    data: { status: 'rechazado', rejectedAt: new Date(), rejectedNote: note || 'Sin observaciones' },
  })
  revalidatePath('/mi-panel')
  revalidatePath(`/mi-panel/firma/${signatureId}`)
}
