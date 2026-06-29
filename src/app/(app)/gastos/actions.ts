'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import type { ExpenseStatus } from '@/generated/prisma/enums'

const CreateExpenseSchema = z.object({
  technicianId: z.string().min(1).optional(),
  ticketId: z.string().optional().nullable(),
  category: z.enum(['combustible', 'estacionamiento', 'materiales', 'viatico', 'herramienta', 'otro']),
  amount: z.coerce.number().int().positive(),
  description: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  date: z.string().min(1),
})

export async function createExpense(fd: FormData) {
  const actor = await requireActor()

  const raw = {
    technicianId: fd.get('technicianId') as string | null,
    ticketId: fd.get('ticketId') as string | null,
    category: fd.get('category') as string,
    amount: fd.get('amount') as string,
    description: fd.get('description') as string | null,
    receiptUrl: fd.get('receiptUrl') as string | null,
    date: fd.get('date') as string,
  }

  const parsed = CreateExpenseSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
    return { error: issues[0]?.message ?? 'Datos inválidos' }
  }

  const data = parsed.data

  // Determine technicianId: tecnico role uses their own; staff must supply it
  let technicianId: string
  if (actor.role === 'tecnico') {
    if (!actor.technicianId) return { error: 'Tu usuario no tiene técnico asociado' }
    technicianId = actor.technicianId
  } else {
    if (!data.technicianId) return { error: 'Debes seleccionar un técnico' }
    technicianId = data.technicianId
  }

  await prisma.expense.create({
    data: {
      tenantId: actor.tenantId,
      technicianId,
      ticketId: data.ticketId || null,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      receiptUrl: data.receiptUrl || null,
      date: new Date(data.date),
      status: 'pendiente',
    },
  })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')

  return { success: true }
}

export async function updateExpenseStatus(
  id: string,
  status: 'aprobado' | 'rechazado',
  reason?: string,
) {
  const actor = await requireActor()

  // Only staff (super/supervisor) can approve/reject
  if (actor.role !== 'super' && actor.role !== 'supervisor') {
    return { error: 'Sin permiso' }
  }

  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) return { error: 'Gasto no encontrado' }
  if (expense.tenantId !== actor.tenantId && actor.role !== 'super') {
    return { error: 'Sin permiso' }
  }

  await prisma.expense.update({
    where: { id },
    data: {
      status: status as ExpenseStatus,
      approvedById: actor.id,
      rejectedReason: status === 'rechazado' ? (reason ?? null) : null,
    },
  })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')

  return { success: true }
}

export async function deleteExpense(id: string) {
  const actor = await requireActor()

  const expense = await prisma.expense.findUnique({ where: { id }, include: { technician: true } })
  if (!expense) return { error: 'Gasto no encontrado' }

  // Super can delete any; tecnico can delete their own; supervisor cannot delete
  const isOwner = actor.role === 'tecnico' && actor.technicianId === expense.technicianId
  const canDelete = actor.role === 'super' || isOwner

  if (!canDelete) return { error: 'Sin permiso para eliminar' }
  if (expense.tenantId !== actor.tenantId && actor.role !== 'super') return { error: 'Sin permiso' }

  await prisma.expense.delete({ where: { id } })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')

  return { success: true }
}
