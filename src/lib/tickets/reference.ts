// Sufijo visible de referencia — ARQUITECTURA.md § "Modelo objetivo — Ticket
// como raíz de agregación": el ticket es el ID universal, propuesta/informe
// NO tienen un generador de ID propio nuevo, solo heredan un sufijo legible
// (PPTO-N / IT[-N]) sobre la referencia del ticket. Esto es puramente
// visual — nunca se guarda, nunca reemplaza ClientDocument.id, y el orden se
// computa por createdAt ascendente (orden real de creación), no por el
// orden desc en que la UI normalmente los lista.
function ordinalsByCreatedAt(docs: { id: string; createdAt: string }[]): Map<string, number> {
  const asc = [...docs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return new Map(asc.map((d, i) => [d.id, i + 1]))
}

export function withProposalReference<T extends { id: string; createdAt: string }>(
  ticketCode: string, docs: T[],
): (T & { reference: string })[] {
  const order = ordinalsByCreatedAt(docs)
  return docs.map(d => ({ ...d, reference: `${ticketCode}-PPTO-${order.get(d.id)}` }))
}

export function withReportReference<T extends { id: string; createdAt: string }>(
  ticketCode: string, docs: T[],
): (T & { reference: string })[] {
  const order = ordinalsByCreatedAt(docs)
  return docs.map(d => {
    const n = order.get(d.id)!
    return { ...d, reference: n === 1 ? `${ticketCode}-IT` : `${ticketCode}-IT-${n}` }
  })
}
