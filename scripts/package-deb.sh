#!/usr/bin/env bash
# Athena · paquete .deb para Debian/Ubuntu (ver LEEME.md y docs/SELFHOSTING.md)
#
# Monta la jerarquía de un paquete Debian a partir del build de producción
# (.next) ya hecho y lo compila con dpkg-deb. Lo llama
# .github/workflows/release-linux.yml justo después de `bun run build`.
#
#   /opt/athena/                 la app (ficheros rastreados + .next)
#   /usr/bin/athena              symlink al CLI (bin/athena)
#   /usr/share/doc/athena/       copyright (MIT) + LEEME.md
#   DEBIAN/{control,postinst,postrm}
#
# Los datos de la persona NUNCA van en el paquete: viven en la casa de datos
# (~/.local/share/athena o ATHENA_HOME) y sobreviven al paquete.
set -euo pipefail

VERSION=$(bun -e "console.log(require('./package.json').version)")
DEBROOT="dist/deb-root"
APP="$DEBROOT/opt/athena"
DOC="$DEBROOT/usr/share/doc/athena"
DEB="dist/athena_${VERSION}_amd64.deb"

[ -d .next ] || { echo "Falta el build de producción (.next). Ejecuta antes: bun run build"; exit 1; }
command -v dpkg-deb >/dev/null 2>&1 || { echo "Falta dpkg-deb (viene con dpkg en Debian/Ubuntu)."; exit 1; }

rm -rf "$DEBROOT"
mkdir -p "$APP" "$DEBROOT/DEBIAN" "$DEBROOT/usr/bin" "$DOC"

# 1) App: ficheros rastreados del repo + build de producción precompilado
git archive --format=tar HEAD | tar -x -C "$APP"
cp -r .next "$APP/.next"

# 2) CLI en el PATH (bin/athena resuelve su raíz con readlink -f: el symlink vale)
ln -s /opt/athena/bin/athena "$DEBROOT/usr/bin/athena"

# 3) Documentación
install -m 644 LEEME.md "$DOC/LEEME.md"
cat > "$DOC/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Athena
Source: https://github.com/MoriNo23/Athena

Files: *
Copyright: 2026 MoriNo23
License: MIT
Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
.
The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.
.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
EOF

# 4) Metadatos y guiones del paquete
INSTALLED_SIZE=$(du -sk "$APP" | cut -f1)
cat > "$DEBROOT/DEBIAN/control" <<EOF
Package: athena
Version: ${VERSION}
Section: web
Priority: optional
Architecture: amd64
Installed-Size: ${INSTALLED_SIZE}
Suggests: bun
Maintainer: MoriNo23 <MoriNo23@users.noreply.github.com>
Homepage: https://github.com/MoriNo23/Athena
Description: Lector local-first de PDF y EPUB — la última página
 Athena es una app de lectura para tu propio PC: riel de progreso,
 racha de lectura, insignias por libros terminados, lectura dual con
 PDF compañero, OCR, diccionario y modo teleprompter. Todo corre en tu
 máquina: sin nube, sin cuentas y sin telemetría.
 .
 Instala la app en /opt/athena con el comando «athena» (init, start,
 doctor, backup). Tu biblioteca vive en ~/.local/share/athena y
 sobrevive a actualizaciones y a desinstalar el paquete.
 .
 Necesita Bun en tiempo de ejecución (https://bun.sh); el postinst lo
 detecta y te da la orden exacta si falta.
EOF

cat > "$DEBROOT/DEBIAN/postinst" <<'EOF'
#!/bin/sh
# Prepara dependencias si puede; jamás toca los datos del usuario.
set -e
APP=/opt/athena
if command -v bun >/dev/null 2>&1; then
  if [ ! -d "$APP/node_modules" ]; then
    echo "Athena: instalando dependencias (bun install --production)…"
    if (cd "$APP" && bun install --production); then
      echo "Athena: dependencias listas."
    else
      echo "Athena: no pude instalarlas ahora (¿sin red?)." >&2
      echo "  Ejecútalo después:  cd /opt/athena && sudo bun install --production" >&2
    fi
  fi
else
  echo "Athena necesita Bun y no está en el PATH de la instalación." >&2
  echo "  Instálalo:  curl -fsSL https://bun.sh/install | bash" >&2
  echo "  Y luego:    cd /opt/athena && sudo bun install --production" >&2
fi
echo ""
echo "Athena instalada en /opt/athena (comando: athena)."
echo "  Primera vez:  athena init      # casa de datos + esquema"
echo "  A diario:     athena start     # http://localhost:3000"
echo "  En tu red:    athena start --lan"
echo "Tus datos viven en ~/.local/share/athena (o \$ATHENA_HOME):"
echo "sobreviven a actualizaciones y a desinstalar el paquete."
exit 0
EOF

cat > "$DEBROOT/DEBIAN/postrm" <<'EOF'
#!/bin/sh
# Limpia SOLO los ficheros generados por el paquete. Los datos de la
# persona (ATHENA_HOME o ~/.local/share/athena) no se tocan jamás.
set -e
rm -rf /opt/athena/node_modules 2>/dev/null || true
rmdir /opt/athena 2>/dev/null || true
echo "Athena desinstalada. Tus datos siguen en tu casa de datos."
exit 0
EOF
chmod 755 "$DEBROOT/DEBIAN/postinst" "$DEBROOT/DEBIAN/postrm"
sh -n "$DEBROOT/DEBIAN/postinst"   # syntax check
sh -n "$DEBROOT/DEBIAN/postrm"     # syntax check

# 5) Compilar el .deb
dpkg-deb --build --root-owner-group "$DEBROOT" "$DEB" >/dev/null
echo "Paquete listo: $DEB ($(du -h "$DEB" | cut -f1))"
dpkg-deb --info "$DEB" | sed -n '1,12p'
