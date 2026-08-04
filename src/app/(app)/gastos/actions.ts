'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assertOwns, assertRole, assertTechnicianOwns, canApproveExpense } from '@/lib/policies'
import { notify } from '@/lib/push'
import { fromDateInput } from '@/lib/cashflow/dates'
import { logAudit } from '@/lib/audit'
import type { ExpenseStatus } from '@/generated/prisma/enums'

const CreateExpenseSchema = z.object({
  technicianId: z.string().min(1).optional().nullable(),
  ticketId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  category: z.enum(['combustible', 'estacionamiento', 'materiales', 'viatico', 'herramienta', 'otro']),
  amount: z.coerce.number().int().positive(),
  description: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
  date: z.string().min(1),
  isGeneral: z.coerce.boolean().optional(),
})

export async function createExpense(fd: FormData) {
  const actor = await requireActor()

  const raw = {
    technicianId: fd.get('technicianId') as string | null,
    ticketId: fd.get('ticketId') as string | null,
    jobId: fd.get('jobId') as string | null,
    category: fd.get('category') as string,
    amount: fd.get('amount') as string,
    description: fd.get('description') as string | null,
    supplier: fd.get('supplier') as string | null,
    receiptUrl: fd.get('receiptUrl') as string | null,
    date: fd.get('date') as string,
    isGeneral: fd.get('isGeneral') === 'on',
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

  // jobId solo tiene sentido junto a un ticketId real — informe #14, "no
  // inventar relaciones": vincular directo a un trabajo sin pasar por su
  // ticket de origen sería una asociación fuera del criterio ya establecido
  // (directo = tiene ticket). Si viene jobId sin ticketId, se descarta el
  // jobId en silencio de la sección "avanzada" en vez de fallar el submit —
  // no es un dato crítico como para bloquear el registro del gasto.
  const ticketId = data.ticketId || null
  const jobId = ticketId ? (data.jobId || null) : null

  const created = await prisma.expense.create({
    data: {
      tenantId: actor.tenantId,
      technicianId,
      ticketId,
      jobId,
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      supplier: data.supplier || null,
      receiptUrl,
      date: fromDateInput(data.date) ?? new Date(),
      status: 'pendiente',
      isGeneral: ticketId ? null : (data.isGeneral || null),
    },
  })

  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'expense.create', entityType: 'Expense', entityId: created.id,
    after: { technicianId, ticketId, jobId, category: data.category, amount: data.amount },
    source: 'gastos/actions.ts:createExpense',
  })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')
  if (ticketId) revalidatePath(`/tickets/${ticketId}`)
  if (jobId) revalidatePath(`/flujo/trabajos/${jobId}`)

  return { success: true }
}

const UpdateExpenseSchema = z.object({
  category: z.enum(['combustible', 'estacionamiento', 'materiales', 'viatico', 'herramienta', 'otro']),
  amount: z.coerce.number().int().positive(),
  description: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  date: z.string().min(1),
  ticketId: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  isGeneral: z.coerce.boolean().optional(),
})

// Edición completa (informe #14) — antes de este bloque no existía NINGUNA
// acción para editar un gasto ya creado (solo crear/cambiar estado/
// eliminar). Un técnico solo puede editar su propio gasto mientras sigue
// "pendiente" (una vez que staff lo tocó — aprobado/rechazado/pagado — ya
// no es una corrección de captura, es una decisión financiera tomada); staff
// puede editar cualquier gasto de su tenant en cualquier estado, siempre
// auditado con antes/después para que la corrección quede trazable.
export async function updateExpense(id: string, fd: FormData) {
  const actor = await requireActor()

  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) return { error: 'Gasto no encontrado' }
  assertOwns(actor, existing.tenantId)
  if (actor.role === 'tecnico') {
    assertTechnicianOwns(actor, existing.technicianId)
    if (existing.status !== 'pendiente') return { error: 'Ya fue revisado por un supervisor — no se puede editar.' }
  }

  const raw = {
    category: fd.get('category') as string,
    amount: fd.get('amount') as string,
    description: fd.get('description') as string | null,
    supplier: fd.get('supplier') as string | null,
    date: fd.get('date') as string,
    ticketId: fd.get('ticketId') as string | null,
    jobId: fd.get('jobId') as string | null,
    isGeneral: fd.get('isGeneral') === 'on',
  }
  const parsed = UpdateExpenseSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const data = parsed.data

  const ticketId = data.ticketId || null
  const jobId = ticketId ? (data.jobId || null) : null
  const isGeneral = ticketId ? null : (data.isGeneral || null)

  await prisma.expense.update({
    where: { id },
    data: {
      category: data.category,
      amount: data.amount,
      description: data.description || null,
      supplier: data.supplier || null,
      date: fromDateInput(data.date) ?? existing.date,
      ticketId,
      jobId,
      isGeneral,
    },
  })

  const fieldsChanged = data.category !== existing.category || data.amount !== existing.amount
    || (data.description || null) !== existing.description || (data.supplier || null) !== existing.supplier
  if (fieldsChanged) {
    await logAudit({
      tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
      action: 'expense.update', entityType: 'Expense', entityId: id,
      before: { category: existing.category, amount: existing.amount, description: existing.description, supplier: existing.supplier },
      after: { category: data.category, amount: data.amount, description: data.description || null, supplier: data.supplier || null },
      source: 'gastos/actions.ts:updateExpense',
    })
  }

  // Clasificación/asociación (informe #14) — categoría propia de auditoría,
  // separada de "editar campos": es una decisión de a qué expediente
  // pertenece el gasto, no un dato de captura como monto/proveedor.
  const associationChanged = ticketId !== existing.ticketId || jobId !== existing.jobId || isGeneral !== existing.isGeneral
  if (associationChanged) {
    await logAudit({
      tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
      action: 'expense.reclassify', entityType: 'Expense', entityId: id,
      before: { ticketId: existing.ticketId, jobId: existing.jobId, isGeneral: existing.isGeneral },
      after: { ticketId, jobId, isGeneral },
      source: 'gastos/actions.ts:updateExpense',
    })
  }

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')
  revalidatePath('/mi-panel/gastos')
  if (existing.ticketId) revalidatePath(`/tickets/${existing.ticketId}`)
  if (ticketId && ticketId !== existing.ticketId) revalidatePath(`/tickets/${ticketId}`)
  if (existing.jobId) revalidatePath(`/flujo/trabajos/${existing.jobId}`)
  if (jobId && jobId !== existing.jobId) revalidatePath(`/flujo/trabajos/${jobId}`)

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

  // "Rechazado" es la anulación real de este flujo (informe #14): sin
  // estado "anulado" propio, un gasto ya aprobado/pagado que resulta
  // incorrecto se rechaza igual — la transición queda auditada con el
  // estado anterior real, sea cual sea.
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: status === 'aprobado' ? 'expense.approve' : status === 'rechazado' ? 'expense.reject' : 'expense.mark_paid',
    entityType: 'Expense', entityId: id,
    before: { status: expense.status },
    after: { status, reason: reason ?? null, ticketId: expense.ticketId, jobId: expense.jobId },
    source: 'gastos/actions.ts:updateExpenseStatus',
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
  if (expense.ticketId) revalidatePath(`/tickets/${expense.ticketId}`)
  if (expense.jobId) revalidatePath(`/flujo/trabajos/${expense.jobId}`)

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

  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'expense.delete', entityType: 'Expense', entityId: id,
    before: { technicianId: expense.technicianId, category: expense.category, amount: expense.amount, status: expense.status, ticketId: expense.ticketId, jobId: expense.jobId },
    source: 'gastos/actions.ts:deleteExpense',
  })

  revalidatePath('/gastos')
  revalidatePath('/mi-panel')
  if (expense.ticketId) revalidatePath(`/tickets/${expense.ticketId}`)
  if (expense.jobId) revalidatePath(`/flujo/trabajos/${expense.jobId}`)

  return { success: true }
}

// Vincular/desvincular un gasto directo a un trabajo puntual (informe #14)
// — acción parcial y liviana a propósito, separada de updateExpense (que
// reemplaza el registro completo): se usa desde la ficha del ticket, donde
// solo se conoce el jobId a tocar, no el resto de los campos del gasto.
// Staff únicamente — vincular a un trabajo específico afecta el margen real
// del trabajo, es una decisión de "a qué expediente pertenece este costo",
// no una corrección de captura que el técnico pueda hacer solo.
export async function setExpenseJob(id: string, jobId: string | null) {
  const actor = await requireActor(['super', 'supervisor'])

  const expense = await prisma.expense.findUnique({ where: { id }, select: { tenantId: true, ticketId: true, jobId: true } })
  if (!expense) return { error: 'Gasto no encontrado' }
  assertOwns(actor, expense.tenantId)
  if (!expense.ticketId) return { error: 'Solo se puede vincular a un trabajo un gasto que ya tiene ticket.' }

  if (jobId) {
    // El trabajo debe pertenecer al mismo ticket — nunca se acepta un jobId
    // arbitrario del cliente (evita vincular a un trabajo de otro expediente).
    const job = await prisma.job.findFirst({ where: { id: jobId, originTicketId: expense.ticketId, tenantId: actor.tenantId }, select: { id: true } })
    if (!job) return { error: 'Ese trabajo no pertenece a este ticket.' }
  }

  await prisma.expense.update({ where: { id }, data: { jobId } })

  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'expense.reclassify', entityType: 'Expense', entityId: id,
    before: { jobId: expense.jobId }, after: { jobId, ticketId: expense.ticketId },
    source: 'gastos/actions.ts:setExpenseJob',
  })

  revalidatePath(`/tickets/${expense.ticketId}`)
  if (expense.jobId) revalidatePath(`/flujo/trabajos/${expense.jobId}`)
  if (jobId) revalidatePath(`/flujo/trabajos/${jobId}`)
  revalidatePath('/gastos')

  return { success: true }
}
