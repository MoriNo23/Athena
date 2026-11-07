#!/usr/bin/env node
/**
 * Empaqueta la salida standalone de Next como artefacto desplegable que
 * solo necesita Node:
 *
 *   node scripts/build-standalone-bundle.mjs [destino]     (default: dist/)
 *
 * Produce dist/athena-standalone-<versión>.tar.gz con:
 *   server.js + node_modules (CLI de Prisma completo vía
 *   complete-standalone.mjs), .next compilado + estáticos del cliente,
 *   public con uploads VACÍO (la biblioteca personal nunca viaja),
 *   prisma/ (esquema y migraciones), start.sh, INICIO.md, LICENSE.
 *
 * La salida standalone trae restos del repo (docs/, src/, android/,
 * openspec/, tests/…): una lista blanca decide qué entra — lo que no está,
 * no viaja.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { completarStandalone } from './complete-standalone.mjs'

/** Whitelist del artefacto (rutas dentro de .next/standalone). */
export const ENTRA = [
  'server.js',
  'start.sh',
  'node_modules',
  '.next',
  'public',
  'prisma',
  'package.json',
  'LICENSE',
]

/** Carpetas de public que nunca viajan en el artefacto (datos personales). */
const PUBLIC_PROHIBIDO = ['uploads', 'evidencia']

const INICIO_MD = `# Athena — paquete standalone

Servidor de lectura local-first empaquetado para correr con solo Node (≥ 20).
No lleva Bun, ni repo, ni Docker.

## Arranque

    sh start.sh

Abre http://127.0.0.1:3000 — el primer arranque crea la BD aplicando el
esquema (node node_modules/prisma … db push, sin Bun).

## Para verlo desde el WiFi (tablet, móvil)

    ATHENA_MODO=lan HOSTNAME=0.0.0.0 ATHENA_PASSWORD=tu-clave sh start.sh

Sin ATHENA_PASSWORD, Athena genera una y la guarda en db/athena-lock
(mírala con: cat db/athena-lock).

## Dónde viven los datos

Por defecto junto a este paquete: db/ (SQLite, config.json, candado) y
public/uploads/ (libros, portadas, fondos). Con ATHENA_HOME se van a su
propia casa, igual que en el resto de instalaciones de Athena.

Más documentación: https://github.com/MoriNo23/Athena → docs/SELFHOSTING.md
`

/**
 * Ensambla el paquete desplegable en `destino` y devuelve la ruta del
 * tar.gz resultante. No toca el repo: solo lee y escribe en destino.
 */
export function ensamblar(raiz, destino) {
  const raizAbs = resolve(raiz)
  const standalone = join(raizAbs, '.next', 'standalone')
  const destinoAbs = resolve(destino)
  const paquete = join(destinoAbs, 'athena-standalone')

  // 1. standalone completo (cierre de Prisma + start.sh, idempotente)
  completarStandalone(raizAbs)

  // 2. paquete limpio desde cero
  rmSync(paquete, { recursive: true, force: true })
  mkdirSync(paquete, { recursive: true })
  for (const entrada of ENTRA) {
    const origen = join(standalone, entrada)
    if (existsSync(origen)) cpSync(origen, join(paquete, entrada), { recursive: true })
  }
  // estáticos del cliente: viven en .next/static, fuera del standalone
  cpSync(join(raizAbs, '.next', 'static'), join(paquete, '.next', 'static'), { recursive: true })

  // 3. biblioteca personal fuera: uploads vacío de fábrica
  for (const prohibido of PUBLIC_PROHIBIDO) {
    rmSync(join(paquete, 'public', prohibido), { recursive: true, force: true })
  }
  mkdirSync(join(paquete, 'public', 'uploads'), { recursive: true })
  writeFileSync(join(paquete, 'public', 'uploads', '.gitkeep'), '')

  // 4. presentación y arranque
  writeFileSync(join(paquete, 'INICIO.md'), INICIO_MD)

  // 5. tarball
  const { version } = JSON.parse(readFileSync(join(raizAbs, 'package.json'), 'utf8'))
  const nombre = `athena-standalone-${version}`
  const tarball = join(destinoAbs, `${nombre}.tar.gz`)
  mkdirSync(dirname(tarball), { recursive: true })
  rmSync(tarball, { force: true })
  execFileSync('tar', ['-czf', tarball, '-C', destinoAbs, basename(paquete)])
  return tarball
}

if (process.argv[1] && process.argv[1].endsWith('build-standalone-bundle.mjs')) {
  const tarball = ensamblar(process.cwd(), resolve(process.argv[2] ?? 'dist'))
  console.log(`paquete listo: ${tarball}`)
}
