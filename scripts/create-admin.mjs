import dotenv from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ path: '.env', quiet: true })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const hash = await bcrypt.hash('Admin@123', 12)

const user = await prisma.user.upsert({
  where: { email: 'admin@bnccplanner.com' },
  update: { password: hash, name: 'Administrador', role: 'SUPER_ADMIN' },
  create: { email: 'admin@bnccplanner.com', name: 'Administrador', password: hash, role: 'SUPER_ADMIN' },
})

const adminPeriodEnd = new Date('2099-12-31T23:59:59.000Z')
await prisma.subscription.upsert({
  where: { userId: user.id },
  update: { plan: 'PREMIUM', status: 'ACTIVE', currentPeriodEnd: adminPeriodEnd },
  create: { userId: user.id, plan: 'PREMIUM', status: 'ACTIVE', currentPeriodEnd: adminPeriodEnd },
})

await prisma.usage.upsert({
  where: { userId: user.id },
  update: {},
  create: { userId: user.id },
})

console.log('Usuário administrador criado com sucesso:', user.email)
await prisma.$disconnect()
