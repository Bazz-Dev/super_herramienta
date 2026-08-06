// Nombres de descarga consistentes, pedido explícito del dueño (documento de
// Sebastián Garrido): PRESUPUESTO_NUMERO_ID.pdf / FACTURA_NUMERO_ID.pdf /
// OC_NUMERO_ID.ext / INFORME_TECNICO_ID.pdf — el "ID" es siempre
// Ticket.ticketCode, nunca un sufijo inventado (PPTO/FAC/OC/IT/OT quedan
// fuera del ID por pedido explícito, ver el spec). Aplica igual en descarga
// individual y masiva — una sola función, ambos caminos la llaman.
const KIND_PREFIX = {
  presupuesto: 'PRESUPUESTO',
  factura: 'FACTURA',
  oc: 'OC',
  informe_tecnico: 'INFORME_TECNICO',
} as const

export function buildDownloadFilename(opts: {
  kind: keyof typeof KIND_PREFIX
  number?: string | null
  ticketCode?: string | null
  ext?: string
}): string {
  const parts: string[] = [KIND_PREFIX[opts.kind]]
  if (opts.number) parts.push(opts.number)
  if (opts.ticketCode) parts.push(opts.ticketCode)
  return `${parts.join('_')}.${opts.ext ?? 'pdf'}`
}
