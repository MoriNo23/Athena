# Tasks

## 1. Licencia

- [x] 1.1 Añadir `LICENSE` con el texto MIT estándar (año 2026; titular: la dueña — su nombre público o `MoriNo23`). Verificación: el texto coincide con la plantilla oficial de MIT y GitHub lo detecta como MIT tras el push.
  - `LICENSE` creado con la plantilla MIT oficial, «Copyright (c) 2026 MoriNo23». Detección de GitHub: tras el push, GitHub lo etiqueta el repo como MIT (el texto es idéntico a la plantilla de choosealicense).
- [x] 1.2 Cerrar en `PRODUCT.md` la ausencia de licencia y la decisión abierta de apertura pública. Verificación: `rg "no hay archivo LICENSE|Decisión abierta" PRODUCT.md` sin resultados.
  - Capabilities: «Apertura decidida y hecha: repo público bajo licencia MIT (LICENSE)». Evidence: retirada la ausencia del LICENSE. `rg` → sin resultados (exit 1).

## 2. Arranque de clon limpio

- [x] 2.1 Determinar empíricamente la forma canónica de `DATABASE_URL` para este repo (probar `file:./db/custom.db` y `file:../db/custom.db` en un clon limpio con `bunx prisma db push` y `bun run dev`). Verificación: la biblioteca vacía queda en `<raíz del clon>/db/custom.db`, sin `prisma/db/` colgando.
  - Empírico (CLI y runtime, entorno limpio): ambas formas se resuelven relativas al directorio del schema (`prisma/`). `file:./db/custom.db` → `prisma/db/custom.db` (el colgante que denunciaba la propuesta) · `file:../db/custom.db` → `<raíz>/db/custom.db` ✓. Canonical: **`file:../db/custom.db`** (la que ya traía `.env.example`; el `.env` vivo, que traía `./`, era la fuente del problema).
  - Nota de método: dos falsos negativos durante la prueba vinieron de contaminación del entorno (una `DATABASE_URL` exportada en la sesión y un `.env` del sandbox por encima del repo — el CLI de Prisma no pisa variables ya presentes). Con `env -u DATABASE_URL` la medición es limpia y reproducible; `scripts/clean-install-test.sh` ahora hace `unset DATABASE_URL` al arrancar por la misma razón.
- [x] 2.2 Alinear `.env`, `.env.example` y el instructivo de README/LEEME a la forma canónica; retirar el `prisma/db/` vacío si nadie lo usa. Verificación: las tres fuentes dicen el mismo valor y un clon limpio levanta copiando el instructivo al pie de la letra.
  - `.env` = `.env.example` = `DATABASE_URL=file:../db/custom.db`. README «RUN IT» + nota del porqué de la ruta; LEEME «Arranque en 4 comandos (clon limpio)» con `cp .env.example .env` + `bunx prisma db push`. No había `prisma/db/` que retirar en git (directorio vacío local, nunca versionado).
- [x] 2.3 Correr `scripts/clean-install-test.sh` sobre un clon limpio (ajustarlo si no cubre este caso). Verificación: script verde con la salida anotada.
  - Ajustes al arnés: replica el instructivo LEEME al pie de la letra (`cp .env.example .env` → `bun install` → `prisma db push` → dev), `unset DATABASE_URL` (entorno limpio), exclusión de `db/custom.db` y `scripts/clean-test-copy` del rsync, y `server.js` del standalone localizado dinámicamente (Next anida el output cuando infiere un workspace root por encima de la copia) arrancado con `DATABASE_URL` absoluta explícita (el cliente Prisma embebido del standalone resuelve relativas desde su propio dir).
  - Salida verde: `OK-db-en-raiz` · `OK-sin-prisma/db` · `DEVOK=yes (http=200 tras 2s, n libros: 0)` · `PRODOK=yes (http=200, {"books":[]})`.

## 3. Onboarding y checklist de release

- [x] 3.1 Recorrer README «RUN IT» y LEEME como tercero: prereqs, copia de `.env`, `db push`, primera subida de un libro, OCR/idiomas y backup. Verificación: fricciones anotadas y corregidas (o justificadas por escrito).
  - Fricción corregida: el «Arranque en 3 comandos» del LEEME no incluía `cp .env.example .env` ni `bunx prisma db push` (un clon limpio reventaba con «Environment variable not found» o tabla ausente). Ahora son 4 comandos y están validados por el arnés. README: nota del porqué de la ruta relativa y sección LICENSE.
- [x] 3.2 Documentar el checklist de release para quien clone (`bun run build`, `bun run lint`, `bunx tsc --noEmit`, `bun run crap` y su banda). Verificación: la sección existe con los comandos exactos y al menos uno se ejecuta tal cual desde el clon.
  - README «RELEASE CHECKLIST» con los 5 pasos y las bandas de CRAPPER.md. Ejecutados tal cual en este pase: `tsc` 0 · `lint` 0/0 · `crap` en banda (los ex-monstruos ReaderView/TeleprompterOverlay dentro de presupuesto) · `build` compila · arnés de clon limpio verde.

## Workflow follow-up

- Archivar el change cuando la entrega pública esté verificada. → Archivado 2026-10-18 (LICENSE + arranque de clon limpio verificados por el arnés).
