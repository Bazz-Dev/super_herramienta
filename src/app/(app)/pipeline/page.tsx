import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { getPipelineDocs, computeKPIs } from '@/lib/pipeline/queries'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export const metadata = { title: 'Pipeline comercial — INGEGAR' }

export default async function PipelinePage() {
  const actor = await requireActor(['super', 'supervisor'])

  const docs = await getPipelineDocs(actor.tenantId)
  const kpis = computeKPIs(docs)

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-ink">Pipeline comercial</h1>
          <p className="mt-1 text-sm text-gray-500">
            Seguimiento de propuestas enviadas a clientes. <Link href="/documentos" className="text-brand-600 hover:underline">Ir a carpetas →</Link>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <PipelineBoard docs={docs} kpis={kpis} />
      </div>
    </div>
  )
}
