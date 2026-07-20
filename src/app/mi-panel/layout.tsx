import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { MiPanelSidebar } from '@/components/ui/mi-panel-sidebar'
import { LogoutButton } from '@/components/ui/logout-button'
import { NotificationBell } from '@/components/ui/notification-bell'

export default async function MiPanelLayout({ children }: { children: React.ReactNode }) {
  // requireActor() redirects to /login when unauthenticated. Uses the same
  // real-or-impersonated role gate as the rest of the técnico panel (G30) —
  // a raw session.user.role check here would bypass "ver como" entirely.
  const actor = await requireActor(['tecnico'])

  // Trabajos agendados (programados/en curso) — badge en "Mi agenda" en vez de
  // un KPI mudo en Inicio. Corre en TODAS las páginas de mi-panel (es el
  // layout), no solo en Inicio.
  const agendaCount = actor.technicianId
    ? await prisma.assignmentAssignee.count({
        where: { technicianId: actor.technicianId, assignment: { status: { in: ['scheduled', 'in_progress'] } } },
      })
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <MiPanelSidebar
        userName={actor.viewingAsName ?? actor.name}
        logout={<LogoutButton />}
        isViewingAs={!!actor.viewingAsName}
        agendaCount={agendaCount}
      />
      <main className="md:pl-60">
        {/* Topbar with notification bell — desktop only, matches internal app layout */}
        <div className="sticky top-0 z-30 hidden items-center justify-end border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
      </main>
    </div>
  )
}
