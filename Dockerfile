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
RUN bun run build

# ---------- runner: standalone + cliente prisma ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/db/custom.db

# servidor standalone de Next (server.js + node_modules mínimos)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma: CLI para `db push` en el arranque + cliente generado + engine
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# el candado y la BD viven en el volumen; los libros subidos, en el suyo
RUN mkdir -p /app/db /app/public/uploads

EXPOSE 3000
# db push: crea la BD la primera vez y alinea el esquema en actualizaciones
# (--skip-generate: el cliente ya viene generado en la imagen)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
