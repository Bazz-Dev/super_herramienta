import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getPipelineDocs, computeKPIs } from '@/lib/pipeline/queries'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'

export const metadata = { title: 'Pipeline comercial — INGEGAR' }

export default async function PipelinePage() {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role ?? '')) {
    redirect('/dashboard')
  }

  const tenantId = session.user.tenantId ?? ''
  const docs = await getPipelineDocs(tenantId)
  const kpis = computeKPIs(docs)

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111', margin: 0 }}>Pipeline comercial</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
          Seguimiento de propuestas enviadas a clientes.{' '}
          <a href="/documentos" style={{ color: '#1d4ed8', textDecoration: 'none' }}>Ir a carpetas →</a>
        </p>
      </div>

      <PipelineBoard docs={docs} kpis={kpis} />
    </div>
  )
}
