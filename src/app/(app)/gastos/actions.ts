'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assertOwns, assertRole, assertTechnicianOwns, canApproveExpense } from '@/lib/policies'
import { notify } from '@/lib/push'
import { fromDateInput } from '@/lib/cashflow/dates'
import type { ExpenseStatus } from '@/generated/prisma/enums'

const CreateExpenseSchema = z.object({
  technicianId: z.string().min(1).optional().nullable(),
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

  // Guard: data URIs are stored in Turso; cap at 2 MB to prevent DB bloat.
  // When Vercel Blob is set up, replace this with a proper upload URL.
  const receiptUrl = data.receiptUrl ?? null
  if (receiptUrl && receiptUrl.length > 2_800_000) {
    return { error: 'El comprobante supera el límite de 2 MB' }
  }

  await prisma.expense.create({
    data: {
      tenantId: actor.tenantId,
      technicianId,
      ticketId: data.ticketId || null,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      receiptUrl,
      date: fromDateInput(data.date) ?? new Date(),
      status: 'pendiente',
    },
  })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')

  return { success: true }
}

export async function updateExpenseStatus(
  id: string,
  status: 'aprobado' | 'rechazado' | 'pagado',
  reason?: string,
) {
  const actor = await requireActor()

  if (!canApproveExpense(actor)) return { error: 'Sin permiso' }

  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) return { error: 'Gasto no encontrado' }
  assertOwns(actor, expense.tenantId)
  if (status === 'pagado' && expense.status !== 'aprobado') {
    return { error: 'Solo se puede marcar como pagado un gasto ya aprobado.' }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      status: status as ExpenseStatus,
      ...(status === 'aprobado' || status === 'rechazado' ? { approvedById: actor.id } : {}),
      rejectedReason: status === 'rechazado' ? (reason ?? null) : expense.rejectedReason,
      paidAt: status === 'pagado' ? new Date() : expense.paidAt,
    },
    include: { technician: { include: { user: { select: { id: true, tenantId: true } } } } },
  })

  // Notify technician
  const techUser = updated.technician?.user
  if (techUser) {
    const CATEGORY_ES: Record<string, string> = { combustible: 'Combustible', estacionamiento: 'Estacionamiento', materiales: 'Materiales', viatico: 'Viático', herramienta: 'Herramienta', otro: 'Gasto' }
    const cat = CATEGORY_ES[updated.category] ?? 'Gasto'
    const NOTIFY_COPY: Record<'aprobado' | 'rechazado' | 'pagado', { type: string; title: string; body: string }> = {
      aprobado: { type: 'expense_approved', title: `${cat} aprobado ✅`, body: `Tu gasto de $${updated.amount.toLocaleString('es-CL')} fue aprobado` },
      rechazado: { type: 'expense_rejected', title: `${cat} rechazado`, body: `Tu gasto de $${updated.amount.toLocaleString('es-CL')} fue rechazado${reason ? ': ' + reason : ''}` },
      pagado: { type: 'expense_paid', title: `${cat} pagado 💰`, body: `Se te depositó $${updated.amount.toLocaleString('es-CL')}` },
    }
    notify(techUser.id, techUser.tenantId, { ...NOTIFY_COPY[status], href: '/mi-panel/gastos' }).catch(() => {})
  }

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')
  revalidatePath('/mi-panel/gastos')

  return { success: true }
}

export async function deleteExpense(id: string) {
  const actor = await requireActor()

  const expense = await prisma.expense.findUnique({ where: { id }, include: { technician: true } })
  if (!expense) return { error: 'Gasto no encontrado' }

  assertOwns(actor, expense.tenantId)
  if (actor.role === 'tecnico') assertTechnicianOwns(actor, expense.technicianId)
  else assertRole(actor, ['super'])

  await prisma.expense.delete({ where: { id } })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')

  return { success: true }
}
