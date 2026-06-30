'use server'

import { prisma } from '@/lib/prisma'
import { tenantScope, requireActor } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'

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
      type: data.type as never,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
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
    data: { status: status as never, approvedById: actor.id },
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
    data: { status: status as never, ...(status === 'pagado' ? { paidAt: new Date() } : {}) },
  })
  revalidatePath('/rrhh/liquidaciones')
}

export async function deletePayroll(id: string) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)
  await prisma.payroll.deleteMany({ where: { id, tenantId: scope.tenantId } })
  revalidatePath('/rrhh/liquidaciones')
}

// ─── Technician profile fields ──────────────────────────────────

export async function updateTechnicianHRFields(techId: string, data: {
  hireDate?: string | null
  baseSalary?: number | null
  address?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  await prisma.technician.updateMany({
    where: { id: techId, ...scope },
    data: {
      ...(data.hireDate !== undefined ? { hireDate: data.hireDate ? new Date(data.hireDate) : null } : {}),
      ...(data.baseSalary !== undefined ? { baseSalary: data.baseSalary } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
      ...(data.emergencyPhone !== undefined ? { emergencyPhone: data.emergencyPhone } : {}),
    },
  })
  revalidatePath(`/rrhh/${techId}`)
  revalidatePath('/rrhh')
}
