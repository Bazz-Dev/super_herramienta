import { prisma } from '../src/lib/prisma.js'
const jb = await prisma.client.findFirst({ where: { name: 'Just Burger' }, select: { id: true } })
if (!jb) { console.log('JB not found'); process.exit(0) }
const branches = await prisma.branch.findMany({ where: { clientId: jb.id }, select: { id: true, name: true, active: true }, orderBy: { name: 'asc' } })
console.log(`JB branches (${branches.length}):`)
branches.forEach(b => console.log(` ${b.active ? '✓' : '✗'} ${b.name}`))
await prisma.$disconnect()
