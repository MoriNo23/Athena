#!/usr/bin/env node
/**
 * Completa la salida standalone de Next (.next/standalone) para que valga
 * por sí sola. Lo usan el Dockerfile (etapa builder) y `bin/athena bundle`.
 *
 *   node scripts/complete-standalone.mjs [raíz-del-repo]
 *
 * Dos huecos que el rastreo de Next 16 no cubre:
 *
 *  1. El CLI de Prisma (`node_modules/prisma`) y su cierre de dependencias:
 *     hace falta para el `db push` del arranque, que crea la BD la primera
 *     vez y alinea el esquema en actualizaciones (igual que la imagen Docker
 *     hacía copiando 3 carpetas a mano — insuficiente: faltaba @prisma/debug
 *     y el arranque fresco se caía).
 *  2. `start.sh`: el comando de arranque que fija la BD (ATHENA_HOME manda,
 *     igual que src/core/data-home.ts), aplica el esquema y levanta el
 *     servidor con solo Node. Por defecto offline en 127.0.0.1: nunca se
 *     abre al WiFi sin querer.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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
#   HOSTNAME         interfaz (127.0.0.1; usa 0.0.0.0 para abrir a la LAN)
#   ATHENA_MODO      offline (sin candado) | lan (con candado)
#   ATHENA_PASSWORD  contraseña fija del candado en modo lan
#   ATHENA_HOME      casa de datos externa (igual que src/core/data-home.ts)
#   ATHENA_DB        ruta concreta de la BD si no usas ATHENA_HOME
set -e
cd "$(dirname "$0")"

export PORT="\${PORT:-3000}"
# HOSTNAME: bash lo predefine con el nombre de la máquina (sin exportar);
# solo lo fijamos si no viene ya del entorno real (p. ej. Docker pone
# HOSTNAME=0.0.0.0). Default honesto: localhost, nunca el WiFi de casualidad.
if [ -z "$(printenv HOSTNAME)" ]; then
  export HOSTNAME=127.0.0.1
fi
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

exec env DATABASE_URL="file:$BD" ATHENA_MODO="$ATHENA_MODO" node server.js
`

/**
 * Añade a .next/standalone lo que le falta para arrancar por sí sola:
 * el cierre del CLI de Prisma, el esquema/migraciones y start.sh.
 * Idempotente: lo que ya está, no se toca. Devuelve lo añadido.
 */
export function completarStandalone(raiz) {
  const raizAbs = resolve(raiz)
  const standalone = join(raizAbs, '.next', 'standalone')
  if (!existsSync(join(standalone, 'server.js'))) {
    throw new Error(`Falta ${standalone}/server.js — ejecuta antes: bun run build`)
  }
  const nmRepo = join(raizAbs, 'node_modules')
  const nmSa = join(standalone, 'node_modules')
  const anadidos = []
  for (const nombre of cierrePrisma(raizAbs)) {
    const origen = join(nmRepo, nombre)
    const destino = join(nmSa, nombre)
    if (!existsSync(origen)) continue
    if (existsSync(join(destino, 'package.json'))) continue // ya trazado
    cpSync(origen, destino, { recursive: true })
    anadidos.push(`node_modules/${nombre}`)
  }
  const esquemaRepo = join(raizAbs, 'prisma')
  const esquemaSa = join(standalone, 'prisma')
  if (existsSync(join(esquemaRepo, 'schema.prisma')) && !existsSync(join(esquemaSa, 'schema.prisma'))) {
    cpSync(esquemaRepo, esquemaSa, { recursive: true })
    anadidos.push('prisma/')
  }
  writeFileSync(join(standalone, 'start.sh'), START_SH, { mode: 0o755 })
  return anadidos
}

if (process.argv[1] && process.argv[1].endsWith('complete-standalone.mjs')) {
  const anadidos = completarStandalone(resolve(process.argv[2] ?? '.'))
  console.log(`standalone completado (${anadidos.length} añadidos):`)
  for (const anadido of anadidos) console.log('  +', anadido)
  console.log('  + start.sh')
}
