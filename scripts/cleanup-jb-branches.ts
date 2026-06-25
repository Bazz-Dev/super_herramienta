// Remove garbage branches for JB created by the incorrect tickets import.
// Safe rule: delete branches with 0 jobs that belong to JB client.
import { prisma } from '../src/lib/prisma.js'

async function main() {
  const jb = await prisma.client.findFirst({ where: { name: 'Just Burger' }, select: { id: true } })
  if (!jb) { console.log('JB not found'); return }

  const orphans = await prisma.branch.findMany({
    where: { clientId: jb.id, jobs: { none: {} } },
    select: { id: true, name: true },
  })

  console.log(`Sucursales huérfanas (sin trabajos): ${orphans.length}`)
  orphans.forEach(b => console.log(`  - "${b.name}"`))

  if (orphans.length === 0) { console.log('Nada que limpiar.'); return }

  const { count } = await prisma.branch.deleteMany({
    where: { id: { in: orphans.map(b => b.id) } },
  })
  console.log(`✓ Eliminadas ${count} sucursales incorrectas`)

  const remaining = await prisma.branch.findMany({ where: { clientId: jb.id }, select: { name: true }, orderBy: { name: 'asc' } })
  console.log(`\nSucursales restantes (${remaining.length}):`)
  remaining.forEach(b => console.log(`  ✓ ${b.name}`))
}

main()
  .then(() => { prisma.$disconnect(); process.exit(0) })
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
