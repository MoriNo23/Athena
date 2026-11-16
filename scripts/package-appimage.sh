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

# 1) AppDir completo: app, runtime, .desktop, icono PNG y metadatos AppStream.
#    Todo eso vive en scripts/linux-install-tree.sh, compartido con el .deb:
#    antes cada script montaba su propia jerarquía y este se quedaba sin icono
#    válido (appimagetool lo avisaba: .DirIcon SVG).
rm -rf "$APPDIR"
bash scripts/linux-install-tree.sh "$APPDIR" --atajos-appimage

# 2) AppRun — el servidor sirve dist/ desde cwd, así que se entra al programa.
#    `ATHENA_APPIMAGE_APPRUN` permite inyectar un AppRun de prueba. Es solo
#    para el CI: el AppRun real es el de abajo, y aquí no hace falta.
if [ -n "${ATHENA_APPIMAGE_APPRUN:-}" ]; then
  cp "$ATHENA_APPIMAGE_APPRUN" "$APPDIR/AppRun"
else
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
fi
chmod +x "$APPDIR/AppRun"

# 3) appimagetool (se descarga una vez; APPIMAGE_EXTRACT_AND_RUN: sin FUSE,
#    igual de válido en el sandbox que en los runners de GitHub)
mkdir -p release
if [ ! -x "$HERRAMIENTA" ]; then
  echo "▸ bajando appimagetool…"
  curl -fL --retry 3 -o "$HERRAMIENTA" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$HERRAMIENTA"
fi

# 4) comprobar lo que appimagetool exige, ANTES de empaquetar. Si esto falla,
#    el mensaje dice qué archivo es y no hay que leer un log de 200 líneas.
[ -f "$APPDIR/.DirIcon" ] || { echo "Falta $APPDIR/.DirIcon" >&2; exit 1; }
file "$APPDIR/.DirIcon" | grep -qi "PNG image" || {
  echo "El .DirIcon tiene que ser un PNG (appimagetool rechaza SVG): $(file -b "$APPDIR/.DirIcon")" >&2
  exit 1
}
[ -f "$APPDIR/usr/share/metainfo/athena.metainfo.xml" ] || {
  echo "Falta el metainfo AppStream en $APPDIR/usr/share/metainfo/" >&2
  echo "  appimagetool avisa de que la app no saldrá con cara en el centro de software." >&2
  echo "  Lo genera scripts/linux-install-tree.sh desde packaging/linux/." >&2
  exit 1
}

# 5) empaquetar
rm -f "release/${NOMBRE}.AppImage"
APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 "$HERRAMIENTA" "$APPDIR" "release/${NOMBRE}.AppImage"

echo "AppImage listo: release/${NOMBRE}.AppImage ($(du -h "release/${NOMBRE}.AppImage" | cut -f1))"
