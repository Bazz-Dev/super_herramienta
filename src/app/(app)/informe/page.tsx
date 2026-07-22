import { ReportEditor } from '@/components/reports/report-editor'
import { sampleReport } from '@/lib/reports/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import type { ReportData } from '@/lib/reports/types'

interface Props {
  searchParams: Promise<{ docId?: string; ticketId?: string }>
}

export default async function InformePage({ searchParams }: Props) {
  const actor = await requireActor()
  const { docId, ticketId } = await searchParams

  const [clients, tickets, savedDoc] = await Promise.all([
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { ...tenantScope(actor), deletedAt: null, status: { notIn: ['cancelado', 'fusionado'] } },
      select: {
        id: true, ticketCode: true, title: true, otNumber: true, otFileUrl: true,
        client: { select: { id: true, name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
    docId ? prisma.clientDocument.findFirst({
      where: { id: docId, ...tenantScope(actor), type: 'informe' },
      select: { dataJson: true, title: true },
    }) : null,
  ])

  let initialData: ReportData = sampleReport
  if (savedDoc?.dataJson) {
    try { initialData = JSON.parse(savedDoc.dataJson) } catch { /* keep sampleReport */ }
  }

  const ticketOptions = tickets.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    otNumber: t.otNumber,
    otFileUrl: t.otFileUrl,
    clientId: t.client.id,
    clientName: t.client.name,
    branchName: t.branch?.name ?? '',
  }))

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creador de Informe Técnico</h1>
          <p className="mt-1 text-sm text-gray-500">
            {savedDoc ? `Editando: ${savedDoc.title}` : 'Vincula un ticket para autocompletar datos, luego edita secciones y registro fotográfico. PDF en A4.'}
          </p>
        </div>
        {savedDoc && (
          <a href="/informe" className="text-xs text-gray-400 hover:text-gray-600 mt-1">+ Nuevo informe</a>
        )}
      </div>
      <ReportEditor initial={initialData} clients={clients} tickets={ticketOptions} docId={docId} ticketId={ticketId} />
    </div>
  )
}
