import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

// Cada página del portal repite este mismo lookup en cada navegación (tema,
// logo, nombre) — datos que casi nunca cambian. Cacheado 60s por slug: un
// round-trip menos contra Turso en la mayoría de las navegaciones, sin
// notarse si el staff edita el logo/tema (máximo 60s de desfase).
export function getPortalClientBySlug(slug: string) {
  return unstable_cache(
    async () =>
      prisma.client.findUnique({
        where: { portalSlug: slug },
        select: { id: true, name: true, portalTheme: true, logoUrl: true },
      }),
    ['portal-client', slug],
    { revalidate: 60 },
  )()
}
