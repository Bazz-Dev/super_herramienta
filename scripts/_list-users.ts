import { prisma } from '../src/lib/prisma.js'
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true, username: true, role: true, active: true, clientId: true },
  orderBy: [{ role: 'asc' }, { name: 'asc' }],
})
users.forEach(u => {
  const portal = u.clientId ? ` [portal clientId=${u.clientId}]` : ''
  console.log(`${u.role.padEnd(12)} ${(u.username ?? '—').padEnd(14)} ${u.email}${portal}`)
})
await prisma.$disconnect()
