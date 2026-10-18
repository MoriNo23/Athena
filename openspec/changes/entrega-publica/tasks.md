# Tasks

## 1. Licencia

- [ ] 1.1 Añadir `LICENSE` con el texto MIT estándar (año 2026; titular: la dueña — su nombre público o `MoriNo23`). Verificación: el texto coincide con la plantilla oficial de MIT y GitHub lo detecta como MIT tras el push.
- [ ] 1.2 Cerrar en `PRODUCT.md` la ausencia de licencia y la decisión abierta de apertura pública. Verificación: `rg "no hay archivo LICENSE|Decisión abierta" PRODUCT.md` sin resultados.

## 2. Arranque de clon limpio

- [ ] 2.1 Determinar empíricamente la forma canónica de `DATABASE_URL` para este repo (probar `file:./db/custom.db` y `file:../db/custom.db` en un clon limpio con `bunx prisma db push` y `bun run dev`). Verificación: la biblioteca vacía queda en `<raíz del clon>/db/custom.db`, sin `prisma/db/` colgando.
- [ ] 2.2 Alinear `.env`, `.env.example` y el instructivo de README/LEEME a la forma canónica; retirar el `prisma/db/` vacío si nadie lo usa. Verificación: las tres fuentes dicen el mismo valor y un clon limpio levanta copiando el instructivo al pie de la letra.
- [ ] 2.3 Correr `scripts/clean-install-test.sh` sobre un clon limpio (ajustarlo si no cubre este caso). Verificación: script verde con la salida anotada.

## 3. Onboarding y checklist de release

- [ ] 3.1 Recorrer README «RUN IT» y LEEME como tercero: prereqs, copia de `.env`, `db push`, primera subida de un libro, OCR/idiomas y backup. Verificación: fricciones anotadas y corregidas (o justificadas por escrito).
- [ ] 3.2 Documentar el checklist de release para quien clone (`bun run build`, `bun run lint`, `bunx tsc --noEmit`, `bun run crap` y su banda). Verificación: la sección existe con los comandos exactos y al menos uno se ejecuta tal cual desde el clon.

## Workflow follow-up

- Archivar el change cuando la entrega pública esté verificada.
