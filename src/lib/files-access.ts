// Filtro de "quién puede descargar este documento de ticket vía /api/files" —
// extraído a función pura para poder testear el scoping por rol sin mockear
// Next.js/Prisma/auth() (G48, 2026-08-02).
export function ticketFileFilter(
  role: string,
  tenantId: string,
  userId: string,
  clientId: string | null | undefined,
): { tenantId?: string; clientId?: string; assignedToId?: string } | undefined {
  if (role === 'super') return undefined
  if (role === 'client') return clientId ? { tenantId, clientId } : { tenantId, clientId: '' }
  // Mismo scoping server-side que /mi-panel/tickets/[id] (solo tickets
  // asignados a él) — sin esto, un técnico podía descargar el documento de
  // CUALQUIER ticket del tenant conociendo su key, aunque la pantalla normal
  // ya lo restringe a los suyos.
  if (role === 'tecnico') return { tenantId, assignedToId: userId }
  return { tenantId }
}
