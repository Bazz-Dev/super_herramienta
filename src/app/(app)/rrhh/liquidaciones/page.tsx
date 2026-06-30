import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { PayrollView } from '@/components/rrhh/payroll-view'

interface Props {
  searchParams: Promise<{ techId?: string; new?: string }>
}

export default async function LiquidacionesPage({ searchParams }: Props) {
  const { techId, new: isNew } = await searchParams
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const [payrolls, technicians] = await Promise.all([
    prisma.payroll.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(techId ? { technicianId: techId } : {}),
      },
      include: {
        technician: { select: { id: true, name: true, baseSalary: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
    prisma.technician.findMany({
      where: { ...scope, active: true },
      select: { id: true, name: true, baseSalary: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const serialized = payrolls.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Liquidaciones</h1>
        <p className="mt-1 text-sm text-gray-500">Liquidaciones de sueldo mensuales del equipo.</p>
      </div>
      <PayrollView payrolls={serialized} technicians={technicians} defaultNew={isNew === '1'} defaultTechId={techId} />
    </div>
  )
}
