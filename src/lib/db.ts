import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // El log de queries es útil en desarrollo; en producción solo errores
    log: process.env.NODE_ENV === "development" ? ["query"] : ["error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db