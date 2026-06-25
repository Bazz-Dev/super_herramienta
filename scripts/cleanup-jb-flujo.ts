// One-time cleanup: remove incorrectly imported JB jobs (from tickets file, not cashflow file)
import { prisma } from '../src/lib/prisma.js'

async function main() {
  const count = await prisma.job.count({ where: { importRef: { startsWith: 'JB#' } } })
  console.log(`Encontrados ${count} jobs incorrectos de JB (importados desde archivo de tickets)`)
  if (count === 0) { console.log('Nada que limpiar.'); return }

  const deleted = await prisma.job.deleteMany({ where: { importRef: { startsWith: 'JB#' } } })
  console.log(`✓ Eliminados ${deleted.count} jobs incorrectos`)
}

main()
  .then(() => { prisma.$disconnect(); process.exit(0) })
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
