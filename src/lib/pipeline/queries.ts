import { prisma } from '@/lib/prisma'
import type { ProposalStatus } from '@/generated/prisma/enums'

export type PipelineDoc = {
  id: string
  title: string
  proposalStatus: ProposalStatus
  proposalAmount: number | null
  sentAt: Date | null
  viewedAt: Date | null
  responseAt: Date | null
  followUpAt: Date | null
  proposalNote: string | null
  createdAt: Date
  updatedAt: Date
  client: { id: string; name: string }
  createdBy: { name: string } | null
  // Jobs en Flujo de Caja creados desde esta propuesta (G37) — permite
  // detectar duplicados antes de crear otro trabajo desde la misma propuesta.
  jobCount: number
}

export async function getPipelineDocs(tenantId: string): Promise<PipelineDoc[]> {
  const docs = await prisma.clientDocument.findMany({
    where: {
      tenantId,
      type: 'propuesta',
      proposalStatus: { not: null },
    },
    select: {
      id: true,
      title: true,
      proposalStatus: true,
      proposalAmount: true,
      sentAt: true,
      viewedAt: true,
      responseAt: true,
      followUpAt: true,
      proposalNote: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { originJobs: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return docs.map(({ _count, ...doc }) => ({ ...doc, jobCount: _count.originJobs })) as PipelineDoc[]
}

export type PipelineKPIs = {
  total: number
  enJuego: number       // monto sum de enviada + vista
  tasaCierre: number    // % aceptadas / (aceptadas + rechazadas + perdidas)
  porVencer: number     // enviada/vista sin respuesta > 7 días
}

export function computeKPIs(docs: PipelineDoc[]): PipelineKPIs {
  const now = Date.now()
  const active = docs.filter(d => d.proposalStatus === 'enviada' || d.proposalStatus === 'vista')
  const closed = docs.filter(d => ['aceptada', 'rechazada', 'perdida'].includes(d.proposalStatus!))
  const accepted = docs.filter(d => d.proposalStatus === 'aceptada')

  const enJuego = active.reduce((s, d) => s + (d.proposalAmount ?? 0), 0)
  const tasaCierre = closed.length > 0 ? Math.round((accepted.length / closed.length) * 100) : 0
  const porVencer = active.filter(d => {
    const ref = d.viewedAt ?? d.sentAt ?? d.updatedAt
    return (now - ref.getTime()) / 86_400_000 > 7
  }).length

  return { total: docs.length, enJuego, tasaCierre, porVencer }
}
