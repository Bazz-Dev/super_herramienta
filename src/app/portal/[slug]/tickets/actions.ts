'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notifyTenantStaff } from '@/lib/push'

function buildTicketCode(urgency: string, branchName: string, clientPrefix: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const urgMap: Record<string, string> = { emergencia: 'EM', urgencia: 'UR', no_urgente: 'RQ', preventivo: 'PR' }
  const code = urgMap[urgency] ?? 'RQ'
  const suc    = branchName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const prefix = clientPrefix.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `${yy}${mm}${dd}-${prefix}-${code}1-${suc}`
}

export async function createPortalTicket(fd: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client') return { success: false }

  const clientId    = String(fd.get('clientId') ?? '')
  const createdById = String(fd.get('createdById') ?? session.user.id)
  const branchId    = String(fd.get('branchId') ?? '') || undefined
  const urgency     = String(fd.get('urgency') ?? 'no_urgente')
  const category    = String(fd.get('category') ?? '') || undefined
  const title       = String(fd.get('title') ?? '').trim()
  const description = String(fd.get('description') ?? '') || undefined

  if (!title || !clientId) return { success: false }

  // Verify clientId matches session
  if (session.user.clientId !== clientId) return { success: false }

  const [branch, client] = await Promise.all([
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : Promise.resolve(null),
    prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true, portalSlug: true, name: true } }),
  ])
  if (!client) return { success: false }

  const clientPrefix = client.portalSlug ?? client.name.split(' ')[0]
  const ticketCode = buildTicketCode(urgency, branch?.name ?? 'SUCURSAL', clientPrefix)

  // Ensure unique code
  const existing = await prisma.ticket.findUnique({ where: { ticketCode }, select: { id: true } })
  const finalCode = existing ? `${ticketCode}-${Date.now().toString(36).slice(-4)}` : ticketCode

  const ticket = await prisma.ticket.create({
    data: {
      ticketCode: finalCode,
      title,
      description,
      urgency: urgency as never,
      category,
      status: 'nuevo',
      clientId,
      branchId,
      tenantId: client.tenantId,
      createdById,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: createdById,
      toStatus: 'nuevo',
      note: 'Solicitud creada por cliente',
      isInternal: false,
    },
  })

  // Notify all INGEGAR staff about the new portal ticket
  const urgencyLabel: Record<string, string> = { emergencia: '🚨 EMERGENCIA', urgencia: '⚠️ Urgente', no_urgente: 'Normal', preventivo: 'Preventivo' }
  await notifyTenantStaff(client.tenantId, {
    type: 'ticket_new',
    title: `Nuevo ticket — ${client.name}`,
    body: `${urgencyLabel[urgency] ?? urgency}: ${title}${branch ? ` · ${branch.name}` : ''}`,
    href: `/tickets/${ticket.id}`,
  }).catch(() => {}) // Non-blocking — don't fail the ticket creation if push fails

  return { success: true, id: ticket.id }
}

export async function addPortalComment(ticketId: string, note: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client') return { success: false }
  const trimmed = note.trim()
  if (!trimmed) return { success: false }

  // Verify this user's client owns the ticket
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: session.user.clientId ?? '' },
    select: { id: true },
  })
  if (!ticket) return { success: false }

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.user.id,
      note: trimmed,
      isInternal: false,
    },
  })

  return { success: true }
}
