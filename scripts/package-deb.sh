#!/usr/bin/env bash
# Athena · paquete .deb para Debian/Ubuntu (ver README.md)
#
# Monta la jerarquía de un paquete Debian a partir del build de producción
# (server-dist/ + dist/) ya hecho y lo compila con dpkg-deb. Lo llama
# .github/workflows/release-linux.yml justo después de `bun run build`.
#
#   /opt/athena/                 la app (ficheros rastreados + build)
#   /usr/bin/athena              symlink al CLI (scripts/athena)
#   /usr/share/doc/athena/       copyright (MIT) + INICIO-RAPIDO.txt
#   DEBIAN/{control,postinst,postrm}
#
# Los datos de la persona NUNCA van en el paquete: viven en la casa de datos
# (~/.local/share/athena o ATHENA_HOME) y sobreviven al paquete. El runtime
# no necesita node_modules: el build va self-contained y la BD usa el SQLite
# integrado en Node (≥ 23.4).
set -euo pipefail

VERSION=$(node -e "console.log(require('./package.json').version)")
DEBROOT="release/deb-root"
APP="$DEBROOT/opt/athena"
DOC="$DEBROOT/usr/share/doc/athena"
DEB="release/athena_${VERSION}_amd64.deb"

[ -f server-dist/server.cjs ] || { echo "Falta el build de producción (server-dist). Ejecuta antes: bun run build"; exit 1; }
command -v dpkg-deb >/dev/null 2>&1 || { echo "Falta dpkg-deb (viene con dpkg en Debian/Ubuntu)."; exit 1; }

rm -rf "$DEBROOT"
mkdir -p "$APP" "$DEBROOT/DEBIAN" "$DEBROOT/usr/bin" "$DOC"

# 1) App: ficheros rastreados del repo + build de producción precompilado
git archive --format=tar HEAD | tar -x -C "$APP"
cp -r server-dist "$APP/server-dist"
cp -r dist "$APP/dist"

# 2) CLI en el PATH (scripts/athena resuelve su raíz con readlink -f: el symlink vale)
ln -s /opt/athena/scripts/athena "$DEBROOT/usr/bin/athena"

# 3) Documentación
cat > "$DOC/INICIO-RAPIDO.txt" <<EOF
Athena ${VERSION} — inicio rápido
Manual completo: https://github.com/MoriNo23/Athena

REQUISITO: Node ≥ 23.4 (node --version). El servidor ya va compilado y
no instala dependencias: descomprime nada, ejecuta y a leer.

ARRANQUE:
  athena start       # → http://localhost:3000   (en tu red: athena start --lan)
  (equivalente: node /opt/athena/server-dist/server.cjs)

La BD se crea sola en el primer arranque (~/.local/share/athena).
Tus datos viven FUERA del paquete (o \$ATHENA_HOME): sobreviven a
actualizaciones y a desinstalar. Log: <casa>/server.log
Diagnóstico: athena doctor  ·  Copia de seguridad: athena backup
EOF
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
Suggests: nodejs (>= 23.4)
Maintainer: MoriNo23 <MoriNo23@users.noreply.github.com>
Homepage: https://github.com/MoriNo23/Athena
Description: Lector local-first de PDF y EPUB — la última página
 Athena es una app de lectura para tu propio PC: riel de progreso,
 racha de lectura, insignias por libros terminados, lectura dual con
 PDF compañero, OCR, diccionario y modo teleprompter. Todo corre en tu
 máquina: sin nube, sin cuentas y sin telemetría.
 .
 Instala la app en /opt/athena con el comando «athena» (start, doctor,
 backup). Tu biblioteca vive en ~/.local/share/athena y sobrevive a
 actualizaciones y a desinstalar el paquete.
 .
 Necesita Node ≥ 23.4 en tiempo de ejecución; va todo precompilado y
 sin dependencias que instalar.
EOF

cat > "$DEBROOT/DEBIAN/postinst" <<'EOF'
#!/bin/sh
# Nada que instalar: el build va self-contained y la BD nace sola.
# Jamás se tocan los datos del usuario.
set -e
if command -v node >/dev/null 2>&1; then
  echo "Athena instalada en /opt/athena (comando: athena)."
  echo "  A diario:     athena start     # http://localhost:3000"
  echo "  En tu red:    athena start --lan"
else
  echo "Athena necesita Node ≥ 23.4 y no está en el PATH de la instalación." >&2
  echo "  Instálalo con el gestor de tu distribución y vuelve a llamar a athena." >&2
fi
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
