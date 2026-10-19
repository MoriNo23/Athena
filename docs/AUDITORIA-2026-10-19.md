# Auditoría — 2026-10-19

Alcance: revisión estática desde un entorno sin navegador ni binarios de Prisma
(no se pudieron levantar el dev server ni las sondas E2E).

## Verificación del último change (`teleprompter-banda-y-flechas`)

- Código coherente con el commit `55136df`: `padding-top: 40vh` en `.tp-scroll`,
  `stepForward` / `goToNextPage` / `goToPrevPage` en `use-teleprompter-player.ts`.
- `openspec validate --all --strict`: 6/6 sin hallazgos.
- Sondas (`probe-auto-cruce`, `probe-flechas-tp`) **no re-ejecutadas** aquí; se
  confía en el resultado documentado en el commit (5/5 y 9/9).

## Estado de OpenSpec

- `teleprompter-camara-y-pantalla-completa`: 17/17 tareas, estaba sin archivar → archivado.
- `teleprompter-verificacion-y-rueda`: 0/10 tareas, **sigue pendiente**. Requiere
  instrumentar la animación de vista en un navegador real (tareas 1.x) antes de
  tocar código; no se aplicó para no subir un arreglo sin poder medirlo.
  Pista para quien siga: `animateScrollTopTo` escribe `scrollTop` por rAF y
  `onWheel` solo cancela el rAF; si el navegador convirtió alguna escritura en un
  scroll suave de compositor, cancelar el rAF no lo detiene (fijar
  `el.scrollTop = el.scrollTop` en `onWheel` es el primer experimento barato).
  Otro candidato: `loadPreviousPage` es asíncrono y su `useLayoutEffect` de
  ancla puede reescribir `scrollTop` después de la rueda.

## Hallazgos

| # | Severidad | Hallazgo |
|---|-----------|----------|
| 1 | Media | `npm audit --omit=dev`: 9 vulnerabilidades (5 altas, 4 moderadas): `sharp` (libvips), `js-yaml`, `deepmerge-ts`, `prismjs`. |
| 2 | Media | `eslint .` falla con 5 errores `react-hooks/set-state-in-effect`: `EditBookDialog.tsx:147`, `ui/carousel.tsx:98`, `use-cover-manager.ts:37`, `use-epub-book.ts:25`, `use-mobile.ts:14`. |
| 3 | Baja | `.env` está versionado aunque `.gitignore` ignora `.env*` (solo contiene `DATABASE_URL=file:../db/custom.db`, sin secretos). Conviene `git rm --cached .env`. |
| 4 | Baja | `upload/` (32 MB: `atena-proyecto.tar.gz` y capturas) está versionado pese a `/upload/` en `.gitignore`; infla el repo. |
| 5 | Baja | `bun.lock` resuelve contra `registry.npmjs.com` (no `.org`): falla en redes con allowlist y es un host atípico. |
| 6 | Info | Búsqueda de secretos (`ghp_`, `sk-`, `AKIA`, claves privadas) en archivos versionados: sin coincidencias. |
| 7 | Info | `scripts/seed-library.mjs` exige PDFs ausentes de `public/uploads/` (tarea 3.1 del change pendiente). |

No se corrigieron 1–5 en este commit: tocan dependencias, efectos de React o el
historial del repo y no se pueden validar sin suite E2E.
