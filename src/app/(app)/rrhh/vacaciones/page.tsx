import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { LeaveManagementView } from '@/components/rrhh/leave-management-view'

interface Props {
  searchParams: Promise<{ techId?: string; new?: string }>
}

export default async function VacacionesPage({ searchParams }: Props) {
  const { techId, new: isNew } = await searchParams
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const [leaves, technicians] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        tenantId: scope.tenantId,
        ...(techId ? { technicianId: techId } : {}),
      },
      include: {
        technician: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.technician.findMany({
      where: { ...scope, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const serialized = leaves.map(l => ({
    ...l,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permisos y ausencias</h1>
          <p className="mt-1 text-sm text-gray-500">Gestiona vacaciones, licencias y permisos del equipo.</p>
        </div>
      </div>
      <LeaveManagementView leaves={serialized} technicians={technicians} defaultNew={isNew === '1'} defaultTechId={techId} />
    </div>
  )
}
