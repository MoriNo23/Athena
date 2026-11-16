#!/usr/bin/env bash
# Athena · instalador común Linux (AppDir y raíz del .deb)
#
# Un solo sitio que sabe cómo se instala Athena en un sistema Linux:
#
#   usr/bin/node                    el runtime (Node ≥ 23.4, node:sqlite estable)
#   usr/bin/athena                  el CLI (symlink a la app: ROOT = $0/..)
#   usr/share/athena/               la app (server-dist + dist + arranque)
#   usr/share/applications/athena.desktop
#   usr/share/metainfo/athena.metainfo.xml    (AppStream: centro de software)
#   usr/share/icons/hicolor/256x256/apps/athena.png
#
# Lo llaman package-appimage.sh (para el AppDir) y package-deb.sh (para la raíz
# del .deb). Antes cada script montaba su propia jerarquía y el .deb acabó sin
# icono ni metadatos: la app no salía con cara en ningún sitio.
#
#   uso: bash scripts/linux-install-tree.sh <DESTINO> [--atajos-appimage]
#
# `--atajos-appimage` añade lo que la especificación de AppDir exige en su raíz
# (.DirIcon y el .desktop junto al ejecutable). En un paquete Debian esos
# archivos sueltos en la raíz no pintan nada y confunden al gestor.
#
# Requisitos: build hecho (`bun run build`) y `node` en el PATH.
set -euo pipefail

DESTINO=${1:?falta el directorio destino}
ATAJOS_APPIMAGE=no
[ "${2:-}" = "--atajos-appimage" ] && ATAJOS_APPIMAGE=si

VERSION=$(node -e "console.log(require('./package.json').version)")

[ -f server-dist/server.cjs ] || { echo "Falta server-dist/ — ejecuta antes: bun run build" >&2; exit 1; }
[ -f dist/index.html ] || { echo "Falta dist/ — ejecuta antes: bun run build" >&2; exit 1; }

# 1) la app, con el ensamblado único de la casa
node scripts/complete-standalone.mjs

APP="$DESTINO/usr/share/athena"
mkdir -p "$APP" "$DESTINO/usr/bin" "$DESTINO/usr/share/applications" \
         "$DESTINO/usr/share/metainfo" "$DESTINO/usr/share/icons/hicolor/256x256/apps"

for entrada in server-dist dist package.json LICENSE; do
  cp -r "standalone/${entrada}" "$APP/${entrada}"
done

# El CLI NO está en standalone/ (ese artefacto es para arrancar con start.sh):
# se copia del repo. Sin él, el symlink de usr/bin/athena quedaría roto y
# `athena start` del paquete .deb no existiría.
mkdir -p "$APP/scripts"
cp scripts/athena "$APP/scripts/athena"
chmod +x "$APP/scripts/athena"

# 2) el runtime viaja dentro (≥ 23.4: node:sqlite estable, cero dependencias)
NODE_BIN="$(command -v node)"
[ -n "$NODE_BIN" ] || { echo "No hay node en el PATH" >&2; exit 1; }
cp "$NODE_BIN" "$DESTINO/usr/bin/node"

# 3) el CLI de la casa. Symlink, no copia: scripts/athena resuelve su raíz con
#    ROOT="$(dirname "$(readlink -f "$0")")/..", así que una copia en usr/bin
#    creería que la app está en la raíz del sistema. El symlink sigue la huella
#    hasta usr/share/athena → ROOT = usr/share/athena. Correcto.
ln -sf ../share/athena/scripts/athena "$DESTINO/usr/bin/athena"

# 4) escritorio: Icon= sin extensión, y el archivo se llama como el id
cat > "$DESTINO/usr/share/applications/athena.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Athena
GenericName=Lector de libros
Comment=Finish your books — PDF/EPUB local-first con riel de progreso
Exec=athena start
Icon=athena
Terminal=false
Categories=Education;Literature;
Keywords=lector;reader;PDF;EPUB;
StartupWMClass=athena
EOF

# 5) icono y metadatos AppStream (mismos datos para AppImage y .deb)
cp packaging/linux/athena.png "$DESTINO/usr/share/icons/hicolor/256x256/apps/athena.png"
cp packaging/linux/athena.metainfo.xml "$DESTINO/usr/share/metainfo/athena.metainfo.xml"

# 6) atajos en la raíz del árbol, solo para AppImage. `.DirIcon` tiene que ser
#    un PNG de verdad: appimagetool rechaza el SVG y ya avisa de que la próxima
#    versión negará a construir. Copia, no symlink al SVG.
if [ "$ATAJOS_APPIMAGE" = si ]; then
  cp packaging/linux/athena.png "$DESTINO/athena.png"
  cp packaging/linux/athena.png "$DESTINO/.DirIcon"
  cp "$DESTINO/usr/share/applications/athena.desktop" "$DESTINO/athena.desktop"
  echo "Atajos de AppDir añadidos en la raíz (.DirIcon PNG, athena.desktop)"
fi

echo "Árbol Linux listo en $DESTINO (versión $VERSION)"
