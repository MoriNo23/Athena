import { PrismaClient } from '@prisma/client'
import { asegurarUrlDb } from '@/core/ensure-db'

// BD cero-config (change bd-cero-config): sin DATABASE_URL en el entorno,
// se fija apuntando a la casa de datos (ATHENA_HOME/XDG/legacy — ver
// src/core/data-home.ts) ANTES de construir el cliente, porque Prisma lee
// la URL al instanciarlo. Si la URL ya venía (Docker, bundle, CLI), se
// respeta tal cual.
asegurarUrlDb()

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