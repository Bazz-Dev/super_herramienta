'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Admin/supervisor creates a signature request for a technician
export async function createSignatureRequest(data: {
  technicianId: string
  documentType: string
  documentTitle: string
  documentData: string // JSON or plain text content of the document
}) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return { success: false, error: 'Sin permisos' }
  }

  const documentHash = createHash('sha256').update(data.documentData).digest('hex')

  const req = await prisma.signatureRequest.create({
    data: {
      tenantId: session.user.tenantId ?? '',
      technicianId: data.technicianId,
      documentType: data.documentType,
      documentTitle: data.documentTitle,
      documentHash,
      documentData: data.documentData,
      status: 'pendiente',
      createdById: session.user.id,
    },
  })

  return { success: true, id: req.id }
}

// Technician signs a document from /mi-panel
export async function signDocument(requestId: string, rutConfirmed: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'tecnico') {
    return { success: false, error: 'Solo técnicos pueden firmar' }
  }

  const req = await prisma.signatureRequest.findFirst({
    where: { id: requestId, status: 'pendiente' },
    include: { technician: { select: { rut: true, name: true, user: { select: { id: true } } } } },
  })
  if (!req) return { success: false, error: 'Solicitud no encontrada o ya firmada' }

  // Verify the technician owns this request via their linked user account
  if (req.technician.user?.id !== session.user.id) {
    return { success: false, error: 'No autorizado' }
  }

  // Verify RUT matches (normalize: remove dots and spaces, lowercase)
  const normalize = (r: string) => r.replace(/[.\s]/g, '').toLowerCase()
  const storedRut = req.technician.rut ?? ''
  if (storedRut && normalize(rutConfirmed) !== normalize(storedRut)) {
    return { success: false, error: 'RUT incorrecto' }
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? 'unknown'

  await prisma.signatureRequest.update({
    where: { id: requestId },
    data: {
      status: 'firmado',
      rutConfirmed,
      signedAt: new Date(),
      signedIp: ip,
    },
  })

  return { success: true }
}

// Technician rejects a document
export async function rejectDocument(requestId: string, note?: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'tecnico') {
    return { success: false, error: 'No autorizado' }
  }

  const req = await prisma.signatureRequest.findFirst({
    where: { id: requestId, status: 'pendiente' },
    include: { technician: { select: { user: { select: { id: true } } } } },
  })
  if (!req) return { success: false, error: 'Solicitud no encontrada' }
  if (req.technician.user?.id !== session.user.id) return { success: false, error: 'No autorizado' }

  await prisma.signatureRequest.update({
    where: { id: requestId },
    data: { status: 'rechazado', rejectedAt: new Date(), rejectedNote: note ?? '' },
  })

  return { success: true }
}
