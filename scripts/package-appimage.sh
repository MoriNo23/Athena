#!/usr/bin/env bash
# Athena · AppImage x64 para el release (ver README.md)
#
# Un solo fichero ejecutable con Node incluido: doble clic (o ./Athena…AppImage)
# y el servidor arranca. La biblioteca NUNCA vive dentro de la imagen (es de
# solo lectura): va a ~/.local/share/athena o a ATHENA_HOME, como siempre.
#
# Lo llama .github/workflows/release-linux.yml justo después de
# `bun run build` + package-linux.sh + package-deb.sh — y DESPUÉS de ellos
# a propósito: package-linux.sh limpia release/ entera al empezar.
#
# Requisitos locales: build hecho (`bun run build`), Node ≥ 23.4 en el PATH
# (su binario viaja dentro del AppImage) y curl para bajar appimagetool.
set -euo pipefail

VERSION=$(node -e "console.log(require('./package.json').version)")
NOMBRE="Athena-${VERSION}-x86_64"
APPDIR="release/AppDir"
HERRAMIENTA="release/appimagetool-x86_64.AppImage"

case "$(uname -m)" in
  x86_64|amd64) ;;
  *) echo "Este empaquetado es x86_64 (host: $(uname -m))" >&2; exit 1 ;;
esac

[ -f server-dist/server.cjs ] || { echo "Falta server-dist/ — ejecuta antes: bun run build" >&2; exit 1; }
[ -f dist/index.html ] || { echo "Falta dist/ — ejecuta antes: bun run build" >&2; exit 1; }

# 1) standalone (ensamblado único de la casa: server-dist + dist + arranque)
node scripts/complete-standalone.mjs

# 2) AppDir: el programa en usr/share/athena, el runtime en usr/bin
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/athena"
for entrada in server-dist dist package.json LICENSE; do
  cp -r "standalone/${entrada}" "$APPDIR/usr/share/athena/${entrada}"
done

# 3) Node del host viaja dentro (≥ 23.4: node:sqlite estable, cero dependencias)
NODE_BIN="$(command -v node)"
[ -n "$NODE_BIN" ] || { echo "No hay node en el PATH" >&2; exit 1; }
cp "$NODE_BIN" "$APPDIR/usr/bin/node"

# 4) AppRun — cd al programa (el servidor sirve dist/ desde cwd) y exec node
cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
# Athena AppImage: el servidor corre desde la imagen de solo lectura; la
# biblioteca vive en ATHENA_HOME (default ~/.local/share/athena), jamás dentro.
HERE="$(dirname "$(readlink -f "$0")")"
cd "$HERE/usr/share/athena" || exit 1
export PORT="${PORT:-3000}"
export ATHENA_HOST="${ATHENA_HOST:-127.0.0.1}"
export ATHENA_MODO="${ATHENA_MODO:-offline}"
exec "$HERE/usr/bin/node" server-dist/server.cjs "$@"
EOF
chmod +x "$APPDIR/AppRun"

# 5) escritorio + icono (el sello de la casa)
cat > "$APPDIR/athena.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Athena
GenericName=Lector de libros
Comment=Finish your books — PDF/EPUB local-first con riel de progreso
Exec=athena
Icon=athena
Terminal=true
Categories=Education;Literature;
StartupWMClass=athena
EOF
cp public/athena-seal.svg "$APPDIR/athena.svg"

# 6) appimagetool (se descarga una vez; APPIMAGE_EXTRACT_AND_RUN: sin FUSE,
#    igual de válido en el sandbox que en los runners de GitHub)
mkdir -p release
if [ ! -x "$HERRAMIENTA" ]; then
  echo "▸ bajando appimagetool…"
  curl -fL --retry 3 -o "$HERRAMIENTA" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$HERRAMIENTA"
fi

# 7) empaquetar
rm -f "release/${NOMBRE}.AppImage"
APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 "$HERRAMIENTA" "$APPDIR" "release/${NOMBRE}.AppImage"

echo "AppImage listo: release/${NOMBRE}.AppImage ($(du -h "release/${NOMBRE}.AppImage" | cut -f1))"
