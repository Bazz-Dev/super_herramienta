import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'
import { DOC_TYPE_LABELS, COMPANY_DOC_TYPE_LABELS, mandatoryDocChecklist, type DocTypeId, type CompanyDocTypeId } from './labels'

export type UnifiedDocRow = {
  id: string
  source: 'technician' | 'company' | 'ticket'
  type: string
  typeLabel: string
  label: string | null
  fileUrl: string
  uploadedAt: Date
  expiryDate: Date | null
  ownerId: string // Technician.id, 'company', o Ticket.id para OT
  ownerName: string
}

export type IncompleteTechnician = { id: string; name: string; missing: string[] }

/**
 * Cross-entity view over TechnicianDocument + CompanyDocument for
 * /documentacion — no new data source, just a read-side merge of the two
 * existing models so an admin can search/filter/select across both at once
 * instead of opening técnicos one at a time.
 */
export async function listAllDocuments(actor: TenantActor) {
  const [technicians, companyDocs, ticketsWithOT] = await Promise.all([
    prisma.technician.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true, documents: { orderBy: { uploadedAt: 'desc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.companyDocument.findMany({
      where: { ...tenantScope(actor) },
      orderBy: { uploadedAt: 'desc' },
    }),
    // OT (orden de trabajo) vive en Ticket.otFileUrl, no en ClientDocument —
    // son cosas distintas (comprobante físico firmado en terreno vs. informe
    // técnico generado en el editor). Se lee desde su fuente real, no se
    // copia a otra tabla — evita la duplicación que tendría forzarla dentro
    // de ClientDocument.
    prisma.ticket.findMany({
      where: { ...tenantScope(actor), otFileUrl: { not: null }, deletedAt: null },
      select: { id: true, ticketCode: true, otNumber: true, otFileUrl: true, updatedAt: true, client: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const rows: UnifiedDocRow[] = []
  const incompleteTechnicians: IncompleteTechnician[] = []

  for (const t of technicians) {
    for (const d of t.documents) {
      rows.push({
        id: d.id,
        source: 'technician',
        type: d.type,
        typeLabel: DOC_TYPE_LABELS[d.type as DocTypeId] ?? d.type,
        label: d.label,
        fileUrl: d.fileUrl,
        uploadedAt: d.uploadedAt,
        expiryDate: d.expiryDate,
        ownerId: t.id,
        ownerName: t.name,
      })
    }
    const missing = mandatoryDocChecklist(t.documents)
      .filter((c) => !c.complete)
      .map((c) => (c.detail ? `${c.label} (${c.detail})` : c.label))
    if (missing.length > 0) incompleteTechnicians.push({ id: t.id, name: t.name, missing })
  }

  for (const d of companyDocs) {
    rows.push({
      id: d.id,
      source: 'company',
      type: d.type,
      typeLabel: COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] ?? d.type,
      label: d.label,
      fileUrl: d.fileUrl,
      uploadedAt: d.uploadedAt,
      expiryDate: null,
      ownerId: 'company',
      ownerName: 'Empresa',
    })
  }

  for (const t of ticketsWithOT) {
    rows.push({
      id: t.id,
      source: 'ticket',
      type: 'ot',
      typeLabel: 'Orden de trabajo',
      label: t.otNumber ? `OT ${t.otNumber} — ${t.ticketCode}` : `OT — ${t.ticketCode}`,
      fileUrl: t.otFileUrl!,
      uploadedAt: t.updatedAt,
      expiryDate: null,
      ownerId: t.id,
      ownerName: t.client.name,
    })
  }

  rows.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())

  const owners = [
    ...technicians.map((t) => ({ id: t.id, name: t.name })),
    { id: 'company', name: 'Empresa' },
  ]

  return { rows, incompleteTechnicians, owners }
}
