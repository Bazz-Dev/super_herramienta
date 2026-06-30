import { ReportEditor } from '@/components/reports/report-editor'
import { sampleReport } from '@/lib/reports/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import type { ReportData } from '@/lib/reports/types'

interface Props {
  searchParams: Promise<{ docId?: string }>
}

export default async function InformePage({ searchParams }: Props) {
  const actor = await requireActor()
  const { docId } = await searchParams

  const [clients, savedDoc] = await Promise.all([
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
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

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creador de Informe Técnico</h1>
          <p className="mt-1 text-sm text-gray-500">
            {savedDoc ? `Editando: ${savedDoc.title}` : 'Edita las secciones y el registro fotográfico. La vista previa se actualiza en vivo y el PDF se descarga ordenado en formato A4.'}
          </p>
        </div>
        {savedDoc && (
          <a href="/informe" className="text-xs text-gray-400 hover:text-gray-600 mt-1">+ Nuevo informe</a>
        )}
      </div>
      <ReportEditor initial={initialData} clients={clients} docId={docId} />
    </div>
  )
}
