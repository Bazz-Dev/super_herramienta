// Ticket code: [YYMMDD]-[CLIENTE]-[URG]1-[SUCURSAL]
// Shared by the internal new-ticket form (preview) and the portal server action,
// so every client gets its own prefix — no per-client hardcode. Este archivo se
// importa desde un componente cliente (new-ticket-form.tsx, solo para la preview)
// — NUNCA importar el cliente de Prisma acá (arrastra `node:module` al bundle del
// navegador y rompe el build de Turbopack). Por eso el chequeo de P2002 más abajo
// es estructural (duck typing) y no un `instanceof Prisma.PrismaClientKnownRequestError`.

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

const MAX_CODE_ATTEMPTS = 5

// Turso/libSQL resuelve escrituras concurrentes con MVCC bajo BEGIN CONCURRENT
// — el conflicto se detecta al hacer commit, no antes. Un check previo
// (findUnique) más un create separado deja una ventana real entre ambos donde
// otra request puede colar el mismo código; el único punto que no miente es la
// constraint única de `ticketCode` en sí. Por eso este helper reintenta sobre
// el P2002 real en vez de adivinar con un check — ver
// docs/ARQUITECTURA.md § Modelo objetivo, guardrail 4.
export async function createTicketWithUniqueCode<T>(
  baseCode: string,
  create: (code: string) => Promise<T>,
): Promise<T> {
  let code = baseCode
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    try {
      return await create(code)
    } catch (e) {
      const isCodeConflict = typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002'
      if (!isCodeConflict || attempt === MAX_CODE_ATTEMPTS) throw e
      code = `${baseCode}-${attempt + 1}`
    }
  }
  throw new Error('unreachable')
}
