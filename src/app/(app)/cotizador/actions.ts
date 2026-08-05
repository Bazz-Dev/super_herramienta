'use server'

import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'

// N° de cotización configurable (pedido explícito del dueño): "automática"
// antes SIEMPRE generaba -001 (buildQuoteId nunca recibía un seq real, ver
// quote-id.ts) — dos propuestas del mismo cliente el mismo día colisionaban
// en el mismo número. Ahora calcula el correlativo real a partir de lo que
// YA existe: toma el sufijo numérico más alto entre todos los quoteId de
// propuestas del tenant (columna real desde la migración add_client_document_quote_id,
// antes solo vivía dentro de dataJson) y suma 1. El campo del editor sigue
// siendo texto libre — si el dueño escribe manualmente "1250" como punto de
// partida, la próxima generación automática continúa desde ahí sin
// necesitar un contador separado en ningún lado.
export async function getNextQuoteSeq(): Promise<number> {
  const actor = await requireActor(['super', 'supervisor'])

  const rows = await prisma.clientDocument.findMany({
    where: { tenantId: actor.tenantId, type: 'propuesta', quoteId: { not: null } },
    select: { quoteId: true },
  })

  let max = 0
  for (const { quoteId } of rows) {
    const match = /(\d+)$/.exec(quoteId ?? '')
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return max + 1
}
