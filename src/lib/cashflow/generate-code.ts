import { prisma } from '@/lib/prisma'

// Esquema de código legible y escalable — ver
// docs/superpowers/specs/2026-07-24-flujo-caja-job-schema-design.md.
// YYMMDD-CLI-TT-NN (con fecha) | IMP-CLI-NNNN (sin fecha confiable).
// Usado tanto por scripts/reconcile-flujo-2026b.ts (importación masiva) como
// por la Server Action de creación en vivo — una sola fuente de verdad.

export const JOB_TYPE_CODE: Record<string, string> = {
  requerimiento: 'RQ', emergencia: 'EM', preventivo: 'PR', proyecto: 'PY', otro: 'OT',
}

// Deriva un código de 3 letras del nombre del cliente (no hay un campo
// `code` en Client — con esto alcanza; si dos clientes derivan el mismo
// código igual no colisiona, porque `code` de Job además lleva fecha+tipo+secuencia).
export function clientCodeFrom(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-ZÀ-Ú]/g, '').replace(/[ÁÀÄ]/g, 'A').replace(/[ÉÈË]/g, 'E').replace(/[ÍÌÏ]/g, 'I').replace(/[ÓÒÖ]/g, 'O').replace(/[ÚÙÜ]/g, 'U')
  return (letters.slice(0, 3) || 'CLI').padEnd(3, 'X')
}

// `seqCache` es opcional — un script que procesa muchos registros con el
// mismo prefijo en una sola corrida (ver scripts/reconcile-flujo-2026b.ts)
// debe pasar un Map compartido entre llamadas, si no dos registros del mismo
// día+cliente+tipo consultarían la misma "secuencia máxima actual" y
// colisionarían. La app en vivo (un solo create a la vez) no lo necesita.
// ponytail: sin lock — dos creates concurrentes para el mismo cliente+tipo+
// día podrían calcular el mismo código antes de que ninguno se guarde; el
// segundo create fallaría por la constraint @unique de `code` (error visible,
// no duplicado silencioso). Aceptado: equipo interno chico, no tráfico
// público concurrente. Si algún día importa, un lock por prefijo lo resuelve.
export async function generateJobCode(
  clientCode: string,
  typeCode: string,
  dateStr: string | null,
  seqCache?: Map<string, number>,
): Promise<string> {
  const prefix = dateStr ? `${dateStr.slice(2).replace(/-/g, '')}-${clientCode}-${typeCode}-` : `IMP-${clientCode}-`
  const width = dateStr ? 2 : 4

  let seq = seqCache?.get(prefix)
  if (seq == null) {
    const existing = await prisma.job.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })
    seq = existing.reduce((max, e) => Math.max(max, Number(e.code!.slice(prefix.length)) || 0), 0)
  }
  seq += 1
  seqCache?.set(prefix, seq)
  return `${prefix}${String(seq).padStart(width, '0')}`
}
