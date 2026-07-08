import { prisma } from '../src/lib/prisma.js'
import bcrypt from 'bcryptjs'

const users = await prisma.user.findMany({
  where: { role: 'client' },
  select: { id: true, name: true, email: true, username: true, active: true, passwordHash: true, clientId: true },
})

for (const u of users) {
  const testPasswords = ['JustBurger@2026', 'carolina', 'portal@justburger.cl', 'Ingegar@Super1']
  console.log(`\n👤 ${u.name ?? u.email} | email: ${u.email} | username: ${u.username} | active: ${u.active} | clientId: ${u.clientId}`)
  for (const pw of testPasswords) {
    if (u.passwordHash) {
      const ok = await bcrypt.compare(pw, u.passwordHash)
      if (ok) console.log(`   ✅ password match: "${pw}"`)
    }
  }
  if (!u.passwordHash) console.log(`   ❌ NO PASSWORD HASH`)
}

await prisma.$disconnect()
