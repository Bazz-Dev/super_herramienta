import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { DocumentsView } from './documents-view'

export default async function DocumentosPage() {
  const actor = await requireActor()

  const docs = await prisma.clientDocument.findMany({
    where: { ...tenantScope(actor) },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    omit: { dataJson: true },  // don't send large JSON to client — fetched on demand
  })

  const serialized = docs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    createdAt: d.createdAt.toISOString(),
    createdBy: d.createdBy,
    client: d.client,
  }))

  // Group by client
  const byClient = new Map<string, { id: string; name: string; docs: typeof serialized }>()
  for (const doc of serialized) {
    const key = doc.client.id
    if (!byClient.has(key)) byClient.set(key, { id: key, name: doc.client.name, docs: [] })
    byClient.get(key)!.docs.push(doc)
  }
  const clientFolders = [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carpetas de clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Propuestas comerciales e informes técnicos — editables online, descarga PDF cuando necesites.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3.5h5l1.5 1.5H13a.5.5 0 01.5.5v6.5a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z"/>
          </svg>
          {docs.length} documentos en {clientFolders.length} carpetas
        </div>
      </div>

      <DocumentsView clientFolders={clientFolders} />
    </div>
  )
}
