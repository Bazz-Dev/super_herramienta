import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ProfileForm } from './profile-form'

const ROLE_LABELS: Record<string, string> = {
  super: 'Super Admin',
  supervisor: 'Administrador',
  tecnico: 'Técnico',
  client: 'Cliente',
}

export default async function PerfilPage() {
  const actor = await requireActor()
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, name: true, email: true, username: true, role: true, createdAt: true },
  })
  if (!user) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Mi perfil</h1>
        <p className="mt-1 text-sm text-gray-500">Gestiona tus datos de acceso</p>
      </div>

      {/* Identity card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-bold text-ink">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-ink">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-ink">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </div>

      <ProfileForm
        name={user.name}
        username={user.username ?? ''}
        email={user.email}
      />
    </div>
  )
}
