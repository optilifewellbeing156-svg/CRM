import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existing) {
    console.log('Admin user already exists — skipping seed.')
    return
  }

  const hashed = await bcrypt.hash('admin123', 10)
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: 'admin',
      password: hashed,
      role: 'ADMIN',
    },
  })
  console.log('✅ Admin user created — username: admin  password: admin123')
  console.log('   ⚠️  Change the password after first login!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
