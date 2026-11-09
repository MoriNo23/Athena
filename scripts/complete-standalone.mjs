#!/usr/bin/env node
/**
 * Completa el artefacto standalone de Athena (solo Node, sin Bun ni repo)
 * dentro de `standalone/`. Lo usan el Dockerfile (etapa builder) y
 * `bin/athena bundle`.
 *
 *   node scripts/complete-standalone.mjs [raíz-del-repo]
 *
 * El paquete necesita:
 *  - server-dist/server.cjs  (el API+estáticos compilado; antes .next/standalone)
 *  - dist/                   (la web de Vite: index, login, assets, public)
 *  - prisma/                 (esquema y migraciones)
 *  - node_modules/prisma y su cierre (para el `db push` del arranque) y
 *    @prisma/.prisma (el cliente generado que requirea el servidor)
 *  - start.sh                (fija la BD, aplica el esquema y arranca Node)
 *
 * El cierre de dependencias se calcula igual que siempre: semillas
 * prisma/@prisma/client/.prisma/client + sus dependencias transitivas.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Cierre de dependencias del CLI + cliente de Prisma dentro de node_modules
 * plano (el que instala Bun). Devuelve los nombres de paquete (con scope)
 * que hacen falta para `db push` y para el cliente en runtime.
 */
export function cierrePrisma(raiz) {
  const nm = join(raiz, 'node_modules')
  // prisma: CLI · @prisma/client: runtime · .prisma/client: generado
  const semillas = ['prisma', '@prisma/client', '.prisma/client']
  const vistas = new Set()
  const cola = [...semillas]
  while (cola.length > 0) {
    const nombre = cola.shift()
    if (vistas.has(nombre)) continue
    const fichero = join(nm, nombre, 'package.json')
    if (!existsSync(fichero)) continue // dependencia ausente: no aporta nada
    vistas.add(nombre)
    const pkg = JSON.parse(readFileSync(fichero, 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies }
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith('@types/')) continue
      cola.push(dep)
    }
  }
  return [...vistas].sort()
}

const START_SH = `#!/bin/sh
# Athena standalone — arranque con solo Node (sin Bun, sin repo, sin Docker).
#
# Entorno que respeta:
#   PORT             puerto (3000)
#   ATHENA_HOST      interfaz (127.0.0.1; usa 0.0.0.0 para abrir a la LAN)
#   ATHENA_MODO      offline (sin candado) | lan (con candado)
#   ATHENA_PASSWORD  contraseña fija del candado en modo lan
#   ATHENA_HOME      casa de datos externa (igual que src/core/data-home.ts)
#   ATHENA_DB        ruta concreta de la BD si no usas ATHENA_HOME
set -e
cd "$(dirname "$0")"

export PORT="\${PORT:-3000}"
export ATHENA_HOST="\${ATHENA_HOST:-127.0.0.1}"
export ATHENA_MODO="\${ATHENA_MODO:-offline}"

if [ -n "\${ATHENA_HOME:-}" ]; then
  BD="$ATHENA_HOME/db/custom.db"
elif [ -n "\${ATHENA_DB:-}" ]; then
  BD="$ATHENA_DB"
else
  BD="$PWD/db/custom.db"
fi

mkdir -p "$(dirname "$BD")" "$PWD/public/uploads"
echo "Athena ($ATHENA_MODO) · BD: $BD"

# Crea la BD la primera vez y alinea el esquema en actualizaciones
# (--skip-generate: el cliente ya viene generado en el paquete).
if ! DATABASE_URL="file:$BD" node node_modules/prisma/build/index.js db push --skip-generate; then
  if [ -f "$BD" ]; then
    echo "aviso: db push falló; arranco con la BD existente tal cual"
  else
    echo "error: no se pudo crear la BD en $BD" >&2
    exit 1
  fi
fi

exec env DATABASE_URL="file:$BD" ATHENA_MODO="$ATHENA_MODO" node server-dist/server.cjs
`

/**
 * Ensambla el paquete en <raíz>/standalone/ (idempotente: lo que ya está,
 * no se toca). Exige un build previo (dist/ + server-dist/). Devuelve lo
 * añadido.
 */
export function completarStandalone(raiz) {
  const raizAbs = resolve(raiz)
  const paquete = join(raizAbs, 'standalone')
  const anadidos = []

  if (!existsSync(join(raizAbs, 'server-dist', 'server.cjs'))) {
    throw new Error('Falta server-dist/server.cjs — ejecuta antes: bun run build')
  }
  if (!existsSync(join(raizAbs, 'dist', 'index.html'))) {
    throw new Error('Falta dist/index.html — ejecuta antes: bun run build')
  }

  // 1. servidor + web + esquema
  for (const [origen, destino] of [
    ['server-dist', 'server-dist'],
    ['dist', 'dist'],
    ['prisma', 'prisma'],
  ]) {
    const de = join(raizAbs, origen)
    const a = join(paquete, destino)
    if (!existsSync(de)) continue
    cpSync(de, a, { recursive: true })
    anadidos.push(`${destino}/`)
  }

  // 2. cierre de Prisma (CLI para db push + cliente para el runtime)
  const nmRepo = join(raizAbs, 'node_modules')
  const nmPaquete = join(paquete, 'node_modules')
  for (const nombre of cierrePrisma(raizAbs)) {
    const origen = join(nmRepo, nombre)
    const destino = join(nmPaquete, nombre)
    if (!existsSync(origen)) continue
    if (existsSync(join(destino, 'package.json'))) continue // ya trazado
    cpSync(origen, destino, { recursive: true })
    anadidos.push(`node_modules/${nombre}`)
  }

  // 3. package.json mínimo (nombre/versión, para el runtime de Prisma)
  const pkg = JSON.parse(readFileSync(join(raizAbs, 'package.json'), 'utf8'))
  writeFileSync(
    join(paquete, 'package.json'),
    JSON.stringify({ name: pkg.name, version: pkg.version, private: true }, null, 2)
  )

  // 4. arranque + licencia
  writeFileSync(join(paquete, 'start.sh'), START_SH, { mode: 0o755 })
  if (existsSync(join(raizAbs, 'LICENSE'))) {
    cpSync(join(raizAbs, 'LICENSE'), join(paquete, 'LICENSE'))
  }

  // 5. uploads vacío (la biblioteca personal nunca viaja) — legacy mode
  // escribe en public/uploads junto al paquete (data-home modo legacy)
  mkdirSync(join(paquete, 'public', 'uploads'), { recursive: true })
  writeFileSync(join(paquete, 'public', 'uploads', '.gitkeep'), '')
  anadidos.push('public/uploads/.gitkeep')

  return anadidos
}

if (process.argv[1] && process.argv[1].endsWith('complete-standalone.mjs')) {
  const anadidos = completarStandalone(resolve(process.argv[2] ?? '.'))
  console.log(`standalone completo (${anadidos.length} entradas):`)
  for (const anadido of anadidos) console.log('  +', anadido)
  console.log('  + start.sh')
}
