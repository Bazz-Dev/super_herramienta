import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { CredentialsManager } from '@/components/resources/credentials-manager'

export default async function CredencialesPage() {
  const actor = await requireActor(['super'])

  // Nunca seleccionar `ciphertext` acá — esta página solo lista metadata; el
  // valor descifrado viaja únicamente como respuesta directa de revealSecret().
  const secrets = await prisma.secret.findMany({
    where: { tenantId: actor.tenantId },
    select: {
      id: true, serviceName: true, url: true, username: true, notes: true, createdAt: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { serviceName: 'asc' },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Bóveda de credenciales</h1>
        <p className="mt-1 text-sm text-gray-500">
          Accesos a servicios externos de la empresa — cifrados en reposo, ocultos por defecto. Revelar exige tu
          contraseña y queda auditado.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <CredentialsManager
          secrets={secrets.map((s) => ({
            id: s.id,
            serviceName: s.serviceName,
            url: s.url,
            username: s.username,
            notes: s.notes,
            createdAt: s.createdAt.toISOString(),
            createdByName: s.createdBy.name,
          }))}
        />
      </div>
    </div>
  )
}
