import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SignaturePendingList } from './signature-pending-list'

export default async function MiPanelPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'tecnico') redirect('/dashboard')

  // Find the technician linked to this user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { technicianId: true, name: true },
  })
  if (!user?.technicianId) redirect('/dashboard')

  const [pending, signed, assignments] = await Promise.all([
    prisma.signatureRequest.findMany({
      where: { technicianId: user.technicianId, status: 'pendiente' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.signatureRequest.findMany({
      where: { technicianId: user.technicianId, status: { not: 'pendiente' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.assignment.findMany({
      where: {
        assignees: { some: { technicianId: user.technicianId } },
        start: { gte: new Date(Date.now() - 7 * 86400_000) },
        status: { not: 'cancelled' },
      },
      include: {
        client: { select: { name: true } },
        ticket: { select: { ticketCode: true, title: true } },
      },
      orderBy: { start: 'asc' },
      take: 10,
    }),
  ])

  const pendingSerialized = pending.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const signedSerialized = signed.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const assignmentsSerialized = assignments.map(a => ({ ...a, start: a.start.toISOString(), end: a.end.toISOString(), createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() }))

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mi Panel</h1>
        <p className="mt-1 text-sm text-gray-500">Bienvenido, {user.name}. Aquí puedes firmar documentos y ver tus asignaciones.</p>
      </div>

      {/* Pending signatures */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-ink">
            {pendingSerialized.length}
          </span>
          Documentos pendientes de firma
        </h2>
        <SignaturePendingList pending={pendingSerialized} signed={signedSerialized} />
      </section>

      {/* Upcoming assignments */}
      {assignmentsSerialized.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Próximas asignaciones (7 días)</h2>
          <div className="flex flex-col gap-2">
            {assignmentsSerialized.map(a => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{a.title}</p>
                    {a.client && <p className="text-xs text-gray-500 mt-0.5">{a.client.name}</p>}
                    {a.ticket && <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.ticket.ticketCode}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {new Date(a.start).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.start).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} – {new Date(a.end).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {a.meetingUrl && (
                  <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                    Unirse a reunión →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
