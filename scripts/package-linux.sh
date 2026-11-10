#!/usr/bin/env bash
# Athena · paquete Linux x64 para el release (ver README.md)
#
# Empaqueta el proyecto con el BUILD DE PRODUCCIÓN ya hecho (server-dist/ +
# dist/) para que quien lo descargue solo tenga que: descomprimir →
# ./scripts/athena start. Sin dependencias que instalar.
# Lo llama .github/workflows/release-linux.yml justo después de `bun run build`.
set -euo pipefail

VERSION=$(node -e "console.log(require('./package.json').version)")
NAME="Athena-${VERSION}-linux-x64"
STAGE="release/${NAME}"

rm -rf release
mkdir -p "${STAGE}"

# 1) Árbol del repo (ficheros rastreados: sin node_modules ni .git)
git archive --format=tar HEAD | tar -x -C "${STAGE}"

# 2) Build de producción precompilado (lo genera `bun run build` justo antes)
cp -r server-dist "${STAGE}/server-dist"
cp -r dist "${STAGE}/dist"

# 3) Instrucciones de arranque dentro del paquete
cat > "${STAGE}/COMO-ARRANCAR.txt" <<EOF
Athena ${VERSION} — Linux x64 (Debian, Ubuntu, Mint…)

REQUISITO: Node ≥ 23.4 (node --version). Bun solo hace falta para
desarrollar (bun install); para leer no hay nada que instalar.

ARRANQUE (dentro de esta carpeta):
  ./scripts/athena start     # → http://localhost:3000 y a leer
  (equivalente: node server-dist/server.cjs)

Modo normal = solo localhost. Para abrirlo en tu red:
  ./scripts/athena start --lan   (candado opcional, ver README.md)

Otros comandos: ./scripts/athena doctor · backup · home
La BD se crea sola en el primer arranque. Los datos viven FUERA del
paquete (sobreviven a actualizaciones):
  \$XDG_DATA_HOME/athena o ~/.local/share/athena
  (personalizable con la variable ATHENA_HOME; el método antiguo de tener
  los datos dentro de la carpeta sigue funcionando si ya los tenías así)

El build de producción YA VIENE HECHO (server-dist/ + dist/): arranca
directo, sin recompilar nada.

Guía completa: https://github.com/MoriNo23/Athena
EOF

# 4) Tarball final
tar -czf "release/${NAME}.tar.gz" -C release "${NAME}"
echo "Paquete listo: release/${NAME}.tar.gz ($(du -h "release/${NAME}.tar.gz" | cut -f1))"
