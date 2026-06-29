/**
 * Fixes duplicate client records created when a portalSlug is assigned to a
 * client that already existed in production under a different record.
 *
 * Problem: seed upserts by portalSlug, but if the client was created WITHOUT
 * portalSlug first, a second record gets created. Tickets point to the old record.
 *
 * Fix: for each slug (justburger, decathlon), find BOTH records, move all
 * tickets/branches/jobs to the one with portalSlug, delete the orphan.
 *
 * Run: npm run fix:portal-slugs:prod
 */
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import { PrismaClient } from '../src/generated/prisma/client.js'

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

const PORTALS = [
  { slug: 'justburger', names: ['Just Burger', 'JustBurger', 'JUST BURGER', 'Just burger'] },
  { slug: 'decathlon',  names: ['Decathlon', 'Decathlon Chile', 'DECATHLON'] },
]

async function main() {
  for (const { slug, names } of PORTALS) {
    console.log(`\n── Checking portal: ${slug} ──`)

    const withSlug = await prisma.client.findUnique({ where: { portalSlug: slug } })
    if (!withSlug) { console.log('  No client with this portalSlug — skip'); continue }
    console.log(`  Client WITH portalSlug: ${withSlug.id} "${withSlug.name}"`)

    // Find clients with same name but NO portalSlug (potential orphans)
    const orphans = await prisma.client.findMany({
      where: {
        tenantId: withSlug.tenantId,
        id: { not: withSlug.id },
        name: { in: names },
        portalSlug: null,
      },
      include: {
        _count: { select: { tickets: true, branches: true, jobs: true, assignments: true } },
      },
    })

    if (orphans.length === 0) {
      console.log('  No orphan clients found — portal is clean ✓')
      continue
    }

    for (const orphan of orphans) {
      console.log(`  Orphan: ${orphan.id} "${orphan.name}" — tickets:${orphan._count.tickets} branches:${orphan._count.branches} jobs:${orphan._count.jobs}`)

      if (orphan._count.tickets > 0) {
        const moved = await prisma.ticket.updateMany({
          where: { clientId: orphan.id },
          data: { clientId: withSlug.id },
        })
        console.log(`  → Moved ${moved.count} tickets to ${withSlug.id}`)
      }
      if (orphan._count.branches > 0) {
        const moved = await prisma.branch.updateMany({
          where: { clientId: orphan.id },
          data: { clientId: withSlug.id, tenantId: withSlug.tenantId },
        })
        console.log(`  → Moved ${moved.count} branches`)
      }
      if (orphan._count.jobs > 0) {
        const moved = await prisma.job.updateMany({
          where: { clientId: orphan.id },
          data: { clientId: withSlug.id },
        })
        console.log(`  → Moved ${moved.count} jobs`)
      }
      if (orphan._count.assignments > 0) {
        const moved = await prisma.assignment.updateMany({
          where: { clientId: orphan.id },
          data: { clientId: withSlug.id },
        })
        console.log(`  → Moved ${moved.count} assignments`)
      }

      // Delete ClientRuts first (FK)
      await prisma.clientRut.deleteMany({ where: { clientId: orphan.id } })

      try {
        await prisma.client.delete({ where: { id: orphan.id } })
        console.log(`  ✓ Deleted orphan client ${orphan.id}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(`  ⚠ Could not delete orphan (still has FKs?): ${msg}`)
      }
    }
  }

  console.log('\n✅ Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
