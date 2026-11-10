#!/usr/bin/env node
/**
 * Empaqueta el artefacto standalone como tar.gz desplegable que solo
 * necesita Node (≥ 23.4):
 *
 *   node scripts/build-standalone-bundle.mjs [destino]     (default: release/)
 *
 * Produce release/athena-standalone-<versión>.tar.gz con lo que ensambla
 * complete-standalone.mjs (server-dist + dist + start.sh), más INICIO.md y
 * LICENSE. Sin node_modules, sin esquema, sin pasos: descomprimir y arrancar.
 * La biblioteca personal nunca viaja.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { completarStandalone } from './complete-standalone.mjs'

/** Whitelist del artefacto (rutas dentro de standalone/). */
export const ENTRA = [
  'server-dist',
  'start.sh',
  'dist',
  'public',
  'package.json',
  'LICENSE',
  'INICIO.md',
]

const INICIO_MD = `# Athena — paquete standalone

Servidor de lectura local-first empaquetado para correr con solo Node ≥ 23.4.
No lleva Bun, ni node_modules, ni repo.

## Arranque

    sh start.sh

Abre http://127.0.0.1:3000 — la base de datos se crea sola en el primer
arranque (SQLite integrado en Node; no hay nada que configurar).

## Para verlo desde el WiFi (tablet, móvil)

    ATHENA_MODO=lan ATHENA_HOST=0.0.0.0 ATHENA_PASSWORD=tu-clave sh start.sh

Sin ATHENA_PASSWORD, Athena genera una y la guarda en db/athena-lock
(mírala con: cat db/athena-lock).

## Dónde viven los datos

Por defecto junto a este paquete: db/ (SQLite, config.json, candado) y
public/uploads/ (libros, portadas, fondos). Con ATHENA_HOME se van a su
propia casa (~/.local/share/athena), igual que en el resto de instalaciones.
`

/**
 * Ensambla el paquete desplegable y devuelve la ruta del tar.gz resultante.
 * No toca el repo: solo lee y escribe en destino.
 */
export function ensamblar(raiz, destino) {
  const raizAbs = resolve(raiz)
  const destinoAbs = resolve(destino)

  // 1. standalone completo (idempotente)
  completarStandalone(raizAbs)
  const paqueteStandalone = join(raizAbs, 'standalone')

  // 2. carpeta limpia con la lista blanca
  const paquete = join(destinoAbs, 'athena-standalone')
  rmSync(paquete, { recursive: true, force: true })
  mkdirSync(paquete, { recursive: true })
  for (const entrada of ENTRA) {
    const origen = join(paqueteStandalone, entrada)
    if (existsSync(origen)) cpSync(origen, join(paquete, entrada), { recursive: true })
  }

  // 3. presentación
  writeFileSync(join(paquete, 'INICIO.md'), INICIO_MD)

  // 4. tarball
  const { version } = JSON.parse(readFileSync(join(raizAbs, 'package.json'), 'utf8'))
  const nombre = `athena-standalone-${version}`
  const tarball = join(destinoAbs, `${nombre}.tar.gz`)
  mkdirSync(dirname(tarball), { recursive: true })
  rmSync(tarball, { force: true })
  execFileSync('tar', ['-czf', tarball, '-C', destinoAbs, basename(paquete)])
  return tarball
}

if (process.argv[1] && process.argv[1].endsWith('build-standalone-bundle.mjs')) {
  const tarball = ensamblar(process.cwd(), resolve(process.argv[2] ?? 'release'))
  console.log(`paquete listo: ${tarball}`)
}
