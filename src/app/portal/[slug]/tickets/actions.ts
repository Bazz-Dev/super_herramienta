'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

function buildTicketCode(urgency: string, branchName: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const urgMap: Record<string, string> = { emergencia: 'EM', urgencia: 'UR', no_urgente: 'RQ', preventivo: 'PR' }
  const code = urgMap[urgency] ?? 'RQ'
  const suc  = branchName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return `${yy}${mm}${dd}-JB-${code}1-${suc}`
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

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null
  const ticketCode = buildTicketCode(urgency, branch?.name ?? 'SUCURSAL')

  // Ensure unique code
  const existing = await prisma.ticket.findUnique({ where: { ticketCode }, select: { id: true } })
  const finalCode = existing ? `${ticketCode}-${Date.now().toString(36).slice(-4)}` : ticketCode

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true } })
  if (!client) return { success: false }

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

  return { success: true, id: ticket.id }
}
