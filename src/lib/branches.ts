import { prisma } from '@/lib/prisma'

// Motivos que bloquean eliminar una sucursal -- una sola fuente de verdad,
// reusada por el flujo interno (flujo/actions.ts:deleteBranch) y el
// self-service del portal (sucursales/actions.ts:deletePortalBranch), FASE 5
// del brief ("la validación debe ejecutarse también en servidor").
//
// Solo 3 modelos llevan branchId real (confirmado por grep sobre el schema):
// Job (onDelete:Restrict), Ticket (onDelete:SetNull) y User (FK suelta, SIN
// @relation declarada -- ver data.md). Todo lo demás que el brief menciona
// (OT, informes técnicos, propuestas, fotos/documentos, gastos/facturas)
// cuelga de Ticket o Job vía su propio ticketId/jobId, así que ya queda
// cubierto transitivamente por estos dos chequeos -- no tiene su propio
// branchId que revisar aparte. User sí necesitaba chequeo propio: sin este,
// borrar una sucursal con un usuario de sucursal asignado no fallaba, dejaba
// ese usuario con un branchId apuntando a una fila que ya no existe, en
// silencio (Prisma no protege una FK sin @relation).
export async function branchDeletionBlockers(branchId: string): Promise<string[]> {
  const [jobs, tickets, users] = await Promise.all([
    prisma.job.count({ where: { branchId } }),
    // Cuenta todos los tickets alguna vez asociados, incluidos los
    // soft-deleted (deletedAt) -- siguen siendo historial real.
    prisma.ticket.count({ where: { branchId } }),
    prisma.user.count({ where: { branchId } }),
  ])
  const reasons: string[] = []
  if (jobs) reasons.push(`${jobs} trabajo${jobs !== 1 ? 's' : ''}`)
  if (tickets) reasons.push(`${tickets} ticket${tickets !== 1 ? 's' : ''}`)
  if (users) reasons.push(`${users} usuario${users !== 1 ? 's' : ''} asignado${users !== 1 ? 's' : ''}`)
  return reasons
}
