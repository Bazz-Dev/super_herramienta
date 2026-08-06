// Prefijo de referencia del ticket: [YYMMDD]-[CLIENTE]-[SUCURSAL]-[CP|EM].
// El correlativo real ({prefix}{seq}) se calcula server-side, en
// ticket-code-server.ts — este archivo se importa desde un componente
// cliente (new-ticket-form.tsx, solo para la preview) y por eso NUNCA debe
// importar el cliente de Prisma (arrastra `node:module` al bundle del
// navegador y rompe el build de Turbopack).
//
// CP/EM = modalidad comercial (Ticket.processFlow, ya existente — informe
// #2): pre_quote exige propuesta aprobada antes de ejecutar, post_execution
// ejecuta primero y valoriza después. Reemplaza el esquema anterior
// (urgencia + sufijo -2/-3 en colisión) — la urgencia sigue existiendo como
// campo (Ticket.urgency), simplemente ya no participa en el código.

export function ticketModalityCode(processFlow: 'pre_quote' | 'post_execution'): 'CP' | 'EM' {
  return processFlow === 'pre_quote' ? 'CP' : 'EM'
}

function normalize(input: string, max: number): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max)
}

export function ticketCodePrefix(opts: {
  clientPrefix: string
  branchName: string
  processFlow: 'pre_quote' | 'post_execution'
  date?: Date
}): string {
  const date = opts.date ?? new Date()
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const prefix = normalize(opts.clientPrefix, 4)
  const suc = normalize(opts.branchName, 14)
  return `${yy}${mm}${dd}-${prefix}-${suc}-${ticketModalityCode(opts.processFlow)}`
}

export function clientTicketPrefix(client: { portalSlug: string | null; name: string }): string {
  return client.portalSlug ?? client.name.split(' ')[0]
}
