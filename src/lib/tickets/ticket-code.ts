// Ticket code: [YYMMDD]-[CLIENTE]-[URG]1-[SUCURSAL]
// Shared by the internal new-ticket form (preview) and the portal server action,
// so every client gets its own prefix — no per-client hardcode.

export function clientTicketPrefix(client: { portalSlug: string | null; name: string }): string {
  return client.portalSlug ?? client.name.split(' ')[0]
}

export function buildTicketCode(urgency: string, branchName: string, clientPrefix: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const urgMap: Record<string, string> = { emergencia: 'EM', urgencia: 'UR', no_urgente: 'RQ', preventivo: 'PR' }
  const code = urgMap[urgency] ?? 'RQ'
  const suc    = branchName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const prefix = clientPrefix.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `${yy}${mm}${dd}-${prefix}-${code}1-${suc}`
}
