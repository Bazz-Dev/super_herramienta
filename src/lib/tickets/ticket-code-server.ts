import { prisma } from '@/lib/prisma'

const MAX_CODE_ATTEMPTS = 5

// Correlativo real por prefijo (fecha+cliente+sucursal+modalidad) — MAX
// existente con ese prefijo exacto + 1. Reemplaza el esquema anterior
// (código completo calculado client-side, colisión resuelta apendizando
// "-2"/"-3") por el mismo patrón ya usado en generateJobCode() para Job.code:
// se recalcula desde la DB real en cada intento, nunca se confía en un
// contador en memoria. Turso/libSQL resuelve la escritura concurrente por
// MVCC (BEGIN CONCURRENT) — el create real contra el `ticketCode` único es
// lo único que no miente, por eso el reintento es sobre el P2002 real, no
// sobre un check previo.
async function nextTicketCode(prefix: string): Promise<string> {
  const existing = await prisma.ticket.findMany({ where: { ticketCode: { startsWith: prefix } }, select: { ticketCode: true } })
  const seq = existing.reduce((max, t) => Math.max(max, Number(t.ticketCode.slice(prefix.length)) || 0), 0) + 1
  return `${prefix}${seq}`
}

export async function createTicketWithUniqueCode<T>(
  prefix: string,
  create: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    const code = await nextTicketCode(prefix)
    try {
      return await create(code)
    } catch (e) {
      const isCodeConflict = typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
      if (!isCodeConflict || attempt === MAX_CODE_ATTEMPTS) throw e
    }
  }
  throw new Error('unreachable')
}
