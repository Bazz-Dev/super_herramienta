import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import type { TenantActor } from '@/lib/tenant'

export async function getHRDashboard(actor: TenantActor) {
  const scope = tenantScope(actor)
  const [technicians, leaveRequests, payrolls] = await Promise.all([
    prisma.technician.findMany({
      where: { ...scope },
      select: {
        id: true, name: true, rut: true, specialty: true, active: true,
        contractType: true, hireDate: true, baseSalary: true,
        vehicle: { select: { plate: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.leaveRequest.findMany({
      where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
      include: { technician: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.payroll.findMany({
      where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) },
      include: { technician: { select: { id: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 50,
    }),
  ])
  return { technicians, leaveRequests, payrolls }
}

export async function getTechnicianProfile(actor: TenantActor, techId: string) {
  const scope = tenantScope(actor)
  const tech = await prisma.technician.findFirst({
    where: { id: techId, ...scope },
    include: {
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      assignees: {
        include: {
          assignment: {
            select: {
              id: true, title: true, status: true, start: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { assignment: { start: 'desc' } },
        take: 20,
      },
      leaveRequests: {
        orderBy: { startDate: 'desc' },
        take: 20,
      },
      payrolls: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 24,
      },
      signatures: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
  return tech
}
