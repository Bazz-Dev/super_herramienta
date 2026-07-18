'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { vehicleInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { fromDateInput } from '@/lib/cashflow/dates'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return vehicleInputSchema.safeParse({
    plate: formData.get('plate'),
    brand: formData.get('brand'),
    model: formData.get('model'),
    year: formData.get('year'),
    status: formData.get('status'),
    technicianId: formData.get('technicianId'),
    notes: formData.get('notes'),
    revTecnicaExpiry: formData.get('revTecnicaExpiry'),
    soapExpiry: formData.get('soapExpiry'),
    permisoCirculacionExpiry: formData.get('permisoCirculacionExpiry'),
    lastServiceDate: formData.get('lastServiceDate'),
    nextServiceDate: formData.get('nextServiceDate'),
  })
}

function vehicleData(p: ReturnType<typeof vehicleInputSchema.parse>) {
  const { revTecnicaExpiry, soapExpiry, permisoCirculacionExpiry, lastServiceDate, nextServiceDate, ...rest } = p
  return {
    ...rest,
    revTecnicaExpiry: fromDateInput(revTecnicaExpiry),
    soapExpiry: fromDateInput(soapExpiry),
    permisoCirculacionExpiry: fromDateInput(permisoCirculacionExpiry),
    lastServiceDate: fromDateInput(lastServiceDate),
    nextServiceDate: fromDateInput(nextServiceDate),
  }
}

// A technician can only hold one truck (technicianId is @unique). Free them
// from any other vehicle before assigning here.
async function freeTechnician(technicianId: string, exceptVehicleId?: string) {
  await prisma.vehicle.updateMany({
    where: { technicianId, ...(exceptVehicleId ? { NOT: { id: exceptVehicleId } } : {}) },
    data: { technicianId: null },
  })
}

async function plateTaken(tenantId: string, plate: string, excludeId?: string): Promise<boolean> {
  const dup = await prisma.vehicle.findFirst({
    where: { tenantId, plate, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  })
  return !!dup
}

export async function createVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  if (await plateTaken(actor.tenantId, parsed.data.plate)) {
    return { error: 'Ya existe un vehículo con esa patente.', fieldErrors: { plate: ['Patente duplicada'] } }
  }
  const { technicianId, ...rest } = vehicleData(parsed.data)
  if (technicianId) await freeTechnician(technicianId)
  await prisma.vehicle.create({ data: { ...rest, technicianId: technicianId ?? null, tenantId: actor.tenantId } })
  revalidatePath('/recursos/vehiculos')
  redirect('/recursos/vehiculos')
}

export async function updateVehicle(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.vehicle.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  if (await plateTaken(actor.tenantId, parsed.data.plate, id)) {
    return { error: 'Ya existe otro vehículo con esa patente.', fieldErrors: { plate: ['Patente duplicada'] } }
  }
  const { technicianId, ...rest } = vehicleData(parsed.data)
  if (technicianId) await freeTechnician(technicianId, id)
  await prisma.vehicle.update({ where: { id }, data: { ...rest, technicianId: technicianId ?? null } })
  revalidatePath('/recursos/vehiculos')
  redirect('/recursos/vehiculos')
}

export async function deleteVehicle(id: string): Promise<void> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.vehicle.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.vehicle.delete({ where: { id } })
  revalidatePath('/recursos/vehiculos')
}
