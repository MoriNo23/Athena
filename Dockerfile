# Athena — imagen self-hosted (multi-stage, sin nada raro en el host:
# solo Docker). El build usa Bun (la casa manda) y el runtime es la salida
# standalone de Next 16 servida por Node.

# ---------- deps: lockfile + cliente prisma ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
# postinstall genera el cliente de Prisma
RUN bun install --frozen-lockfile

# ---------- builder: next build (standalone) ----------
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# la BD no se toca en build; la URL existe solo para satisfacer el entorno
ENV DATABASE_URL=file:/tmp/athena-build.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build && node scripts/complete-standalone.mjs

# ---------- runner: standalone + cliente prisma ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/db/custom.db

# servidor standalone de Next completo: server.js + node_modules mínimos
# + cierre del CLI de Prisma + esquema/migraciones + start.sh
# (scripts/complete-standalone.mjs lo deja todo dentro de .next/standalone)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# el candado y la BD viven en el volumen; los libros subidos, en el suyo
RUN mkdir -p /app/db /app/public/uploads

EXPOSE 3000
# start.sh: db push (crea la BD la primera vez, alinea el esquema después)
# y node server.js — el mismo arranque que el paquete standalone de bin/athena bundle
CMD ["sh", "start.sh"]
