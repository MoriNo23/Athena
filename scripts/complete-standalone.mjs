#!/usr/bin/env node
/**
 * Completa el artefacto standalone de Athena (solo Node, sin Bun ni repo
 * ni node_modules) dentro de `standalone/`. Lo usa `scripts/athena bundle`.
 *
 *   node scripts/complete-standalone.mjs [raíz-del-repo]
 *
 * El paquete necesita:
 *  - server-dist/server.cjs  (el API+estáticos compilado; Express incluido)
 *  - dist/                   (la web de Vite: index, login, assets, public)
 *  - start.sh                (arranca Node, nada más que configurar)
 *
 * La BD se crea sola al primer arranque con el node:sqlite del runtime —
 * no hay esquema que aplicar, cliente que generar ni dependencias que copiar.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const START_SH = `#!/bin/sh
# Athena standalone — arranque con solo Node ≥ 23.4 (sin Bun, sin repo).
#
# Entorno que respeta:
#   PORT             puerto (3000)
#   ATHENA_HOST      interfaz (127.0.0.1; usa 0.0.0.0 para abrir a la LAN)
#   ATHENA_MODO      offline (sin candado) | lan (con candado)
#   ATHENA_PASSWORD  contraseña fija del candado en modo lan
#   ATHENA_HOME      casa de datos externa (igual que src/core/data-home.ts)
set -e
cd "$(dirname "$0")"

export PORT="\${PORT:-3000}"
export ATHENA_HOST="\${ATHENA_HOST:-127.0.0.1}"
export ATHENA_MODO="\${ATHENA_MODO:-offline}"

mkdir -p "$PWD/public/uploads"
exec env ATHENA_MODO="$ATHENA_MODO" node server-dist/server.cjs
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

  // 1. servidor + web
  for (const [origen, destino] of [
    ['server-dist', 'server-dist'],
    ['dist', 'dist'],
  ]) {
    const de = join(raizAbs, origen)
    const a = join(paquete, destino)
    if (!existsSync(de)) continue
    cpSync(de, a, { recursive: true })
    anadidos.push(`${destino}/`)
  }

  // 2. package.json mínimo (identidad del paquete)
  const pkg = JSON.parse(readFileSync(join(raizAbs, 'package.json'), 'utf8'))
  writeFileSync(
    join(paquete, 'package.json'),
    JSON.stringify({ name: pkg.name, version: pkg.version, private: true }, null, 2)
  )

  // 3. arranque + licencia
  writeFileSync(join(paquete, 'start.sh'), START_SH, { mode: 0o755 })
  if (existsSync(join(raizAbs, 'LICENSE'))) {
    cpSync(join(raizAbs, 'LICENSE'), join(paquete, 'LICENSE'))
  }

  // 4. uploads vacío (la biblioteca personal nunca viaja) — legacy mode
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
