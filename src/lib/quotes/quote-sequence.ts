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
    // findUnique + create (nunca upsert): un upsert que pega en la rama UPDATE
    // toca `updatedAt` (@updatedAt) aunque `update: {}` no cambie ningún campo
    // — eso pisaría "última modificación" del panel admin en CADA asignación
    // normal, no solo la primera vez. Solo una creación real (o
    // updateQuoteSequenceConfig) debe tocar updatedAt/updatedById.
    //
    // Ojo: @updatedAt también se auto-dispara en CUALQUIER escritura al
    // modelo, incluido el updateMany de abajo que avanza el contador en
    // TODAS las llamadas (no solo la primera) — no alcanza con evitar el
    // upsert. Prisma solo respeta un valor explícito de un campo @updatedAt
    // si se lo pasás vos mismo en `data`; si se omite, lo autogenera. Por
    // eso el updateMany reenvía `updatedAt: config.updatedAt` (el mismo
    // valor ya leído, sin cambios) — verificado en vivo, ver task-2-report.md.
    let config = await prisma.quoteSequenceConfig.findUnique({ where: { tenantId }, select: { nextNumber: true, updatedAt: true } })
    if (!config) {
      try {
        config = await prisma.quoteSequenceConfig.create({
          data: { tenantId, nextNumber: 1, updatedById: assignedById },
          select: { nextNumber: true, updatedAt: true },
        })
      } catch (e) {
        // Otra request ganó la carrera de creación simultánea (P2002 en tenantId único) — releer, ya existe.
        const isUniqueConflict = typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
        if (!isUniqueConflict) throw e
        config = await prisma.quoteSequenceConfig.findUnique({ where: { tenantId }, select: { nextNumber: true, updatedAt: true } })
        if (!config) throw e
      }
    }
    const current = config.nextNumber
    const result = await prisma.quoteSequenceConfig.updateMany({
      where: { tenantId, nextNumber: current },
      data: { nextNumber: current + 1, updatedAt: config.updatedAt },
    })
    if (result.count === 1) return String(current)
    // count === 0: otra request ganó la carrera entre el read y este
    // updateMany — reintentar con el valor ya avanzado.
  }
  throw new Error('No se pudo asignar el número de cotización (demasiada contención).')
}
