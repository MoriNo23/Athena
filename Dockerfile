# Athena — imagen self-hosted (multi-stage, sin nada raro en el host:
# solo Docker). El build usa Bun (la casa manda) y el runtime es Node
# sirviendo el bundle del servidor (server-dist) + la web de Vite (dist).

# ---------- deps: lockfile + cliente prisma ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
# postinstall genera el cliente de Prisma
RUN bun install --frozen-lockfile

# ---------- builder: vite build + esbuild del servidor ----------
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# la BD no se toca en build; la URL existe solo para satisfacer el entorno
ENV DATABASE_URL=file:/tmp/athena-build.db
# web (dist/) + servidor (server-dist/) + paquete standalone completo
RUN bun run build && node scripts/complete-standalone.mjs

# ---------- runner: bundle standalone servido por Node ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    ATHENA_HOST=0.0.0.0 \
    DATABASE_URL=file:/app/db/custom.db

# servidor compilado + web + cierre de Prisma (CLI para db push + cliente)
# + esquema/migraciones + start.sh — todo dentro de standalone/
COPY --from=builder /app/standalone ./

# el candado y la BD viven en el volumen; los libros subidos, en el suyo
RUN mkdir -p /app/db /app/public/uploads

EXPOSE 3000
# start.sh: db push (crea la BD la primera vez, alinea el esquema después)
# y node server-dist/server.cjs — el mismo arranque que bin/athena bundle
CMD ["sh", "start.sh"]
