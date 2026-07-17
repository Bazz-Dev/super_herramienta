/**
 * Limpieza de copias huérfanas en R2: la primera pasada de migrate-drive-to-r2
 * subió las carpetas pre-app a clients/justburger/archive/; tras el fix ea2133e
 * esos mismos archivos viven vinculados bajo clients/justburger/tickets/{code}/.
 *
 * Este script SOLO borra un objeto de archive/ si su contraparte EXISTE en
 * tickets/ (verificado contra el listado real). Lo que no tenga contraparte se
 * conserva y se reporta. Dry-run por defecto; borra con --apply.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/cleanup-r2-archive.ts [--apply]
 */
import { listR2Objects, deleteFromR2 } from '../src/lib/r2'

const APPLY = process.argv.includes('--apply')
const ARCHIVE_PREFIX = 'clients/justburger/archive/'
const TICKETS_PREFIX = 'clients/justburger/tickets/'

async function main() {
  const [archived, linked] = await Promise.all([
    listR2Objects(ARCHIVE_PREFIX),
    listR2Objects(TICKETS_PREFIX),
  ])
  const linkedKeys = new Set(linked.map(o => o.key))
  console.log(`archive/: ${archived.length} objetos | tickets/: ${linked.length} objetos`)

  let deletable = 0, kept = 0, bytes = 0
  const keepers: string[] = []
  for (const obj of archived) {
    const counterpart = TICKETS_PREFIX + obj.key.slice(ARCHIVE_PREFIX.length)
    if (linkedKeys.has(counterpart)) {
      if (APPLY) await deleteFromR2(obj.key)
      deletable++
      bytes += obj.size
    } else {
      kept++
      keepers.push(obj.key)
    }
  }

  console.log(`${APPLY ? '✂ Eliminados' : '[dry-run] Eliminables'}: ${deletable} objetos (${(bytes / 1024 / 1024).toFixed(1)} MB) — todos con contraparte verificada en tickets/`)
  console.log(`Conservados (sin contraparte): ${kept}`)
  for (const k of keepers.slice(0, 10)) console.log(`   - ${k}`)
  if (!APPLY && deletable > 0) console.log('\nEjecuta con --apply para eliminar.')
}
main()
