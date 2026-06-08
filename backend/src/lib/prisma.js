import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const prisma = global.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default prisma
