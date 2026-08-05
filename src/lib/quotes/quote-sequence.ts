import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = 5

// Contador real, no un MAX(quoteId existente)+1 — si fuera un MAX recalculado,
// eliminar el documento con el número más alto liberaría ese número para el
// próximo, violando la regla explícita "un número usado no se reutiliza"
// (pedido del dueño vía el documento de Sebastián Garrido). Mismo patrón de
// reintento optimista que generateJobCodeWithRetry/createTicketWithUniqueCode
// ya usan en este proyecto — updateMany con el valor esperado en el `where`
// en vez de un lock: si otra request ya avanzó el contador, `count` da 0 y
// se reintenta con el valor fresco, correcto bajo MVCC de Turso/libSQL.
export async function assignQuoteNumber(tenantId: string, assignedById: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const config = await prisma.quoteSequenceConfig.upsert({
      where: { tenantId },
      create: { tenantId, nextNumber: 1, updatedById: assignedById },
      update: {},
      select: { nextNumber: true },
    })
    const current = config.nextNumber
    const result = await prisma.quoteSequenceConfig.updateMany({
      where: { tenantId, nextNumber: current },
      data: { nextNumber: current + 1 },
    })
    if (result.count === 1) return String(current)
    // count === 0: otra request ganó la carrera entre el upsert y este
    // updateMany — reintentar con el valor ya avanzado.
  }
  throw new Error('No se pudo asignar el número de cotización (demasiada contención).')
}
