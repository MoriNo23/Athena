import { PrismaClient } from '@prisma/client'
import { esModoHome, ficheroDb } from '@/lib/data-home'

// ATHENA_HOME (change athena-home-cli): en modo home la BD vive fuera del
// repo y el datasource apunta ahí. El `file:` del .env solo manda en modo
// legacy/dev. Se fija ANTES de construir el cliente: Prisma lee DATABASE_URL
// al inicializar la instancia.
if (esModoHome()) process.env.DATABASE_URL = 'file:' + ficheroDb()

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