#!/usr/bin/env bash
# Athena · paquete Linux x64 para el release (ver LEEME.md y docs/SELFHOSTING.md)
#
# Empaqueta el proyecto con el BUILD DE PRODUCCIÓN ya hecho (.next) para que
# quien lo descargue solo tenga que: descomprimir → bun install → arrancar.
# Lo llama .github/workflows/release-linux.yml justo después de `bun run build`.
set -euo pipefail

VERSION=$(bun -e "console.log(require('./package.json').version)")
NAME="Athena-${VERSION}-linux-x64"
STAGE="dist/${NAME}"

rm -rf dist
mkdir -p "${STAGE}/db"

# 1) Árbol del repo (ficheros rastreados: sin node_modules, sin .git, sin .next)
git archive --format=tar HEAD | tar -x -C "${STAGE}"

# 2) Build de producción precompilado (lo genera `bun run build` justo antes)
cp -r .next "${STAGE}/.next"

# 3) Instrucciones de arranque dentro del paquete
cat > "${STAGE}/COMO-ARRANCAR.txt" <<EOF
Athena ${VERSION} — Linux x64 (Debian, Ubuntu, Mint…)

REQUISITO: Bun (sustituye a Node y npm). Instalación:
  curl -fsSL https://bun.sh/install | bash

ARRANQUE (dentro de esta carpeta):
  1) bun install          # instala dependencias y genera el cliente de BD
  2) ./bin/athena init    # crea la casa de datos (~/.local/share/athena)
                          # y aplica el esquema de la BD (migrate deploy)
  3) ./bin/athena start   # abre http://localhost:3000 y a leer

Modo normal = solo localhost. Para abrirlo en tu red:
  ./bin/athena start --lan   (candado opcional, ver LEEME.md)

Otros comandos: ./bin/athena doctor · backup · home
Los datos viven FUERA del paquete (sobreviven a actualizaciones):
  \$XDG_DATA_HOME/athena o ~/.local/share/athena
  (personalizable con la variable ATHENA_HOME; el método antiguo de tener
  los datos dentro de la carpeta sigue funcionando si ya los tenías así)

El build de producción YA VIENE HECHO (.next/): «athena start» no
recompila nada y arranca directo.

Guía completa: LEEME.md · Auto-alojamiento: docs/SELFHOSTING.md
EOF

# 4) Tarball final
tar -czf "dist/${NAME}.tar.gz" -C dist "${NAME}"
echo "Paquete listo: dist/${NAME}.tar.gz ($(du -h "dist/${NAME}.tar.gz" | cut -f1))"
