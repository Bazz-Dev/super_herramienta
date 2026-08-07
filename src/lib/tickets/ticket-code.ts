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
  // Server-side (Vercel) corre en UTC, no en hora de Chile — usar el reloj
  // del proceso (getFullYear/getMonth/getDate) desplaza la fecha un día para
  // cualquier ticket creado entre ~21:00 y 23:59 hora Chile (ya pasada la
  // medianoche UTC). El segmento YYMMDD es parte del código inmutable del
  // ticket, así que se deriva explícitamente en America/Santiago.
  const [yyyy, mm, dd] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
    .format(date)
    .split('-')
  const yy = yyyy.slice(2)
  const prefix = normalize(opts.clientPrefix, 4)
  const suc = normalize(opts.branchName, 14)
  return `${yy}${mm}${dd}-${prefix}-${suc}-${ticketModalityCode(opts.processFlow)}`
}

export function clientTicketPrefix(client: { portalSlug: string | null; name: string }): string {
  return client.portalSlug ?? client.name.split(' ')[0]
}
