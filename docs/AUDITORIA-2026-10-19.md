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
| 2 | Info | Con `npm install` (sin respetar `bun.lock`) `eslint` daba 5 errores `react-hooks/set-state-in-effect`. Con el plugin fijado por `bun.lock` (7.0.1) el lint sale limpio: 4 eran artefacto de versión. Solo `use-mobile.ts` se reescribió (con `useSyncExternalStore`) por ser una suscripción real. |
| 3 | Baja | `.env` está versionado aunque `.gitignore` ignora `.env*` (solo contiene `DATABASE_URL=file:../db/custom.db`, sin secretos). Conviene `git rm --cached .env`. |
| 4 | Baja | `upload/` (32 MB: `atena-proyecto.tar.gz` y capturas) está versionado pese a `/upload/` en `.gitignore`; infla el repo. |
| 5 | Baja | `bun.lock` resuelve contra `registry.npmjs.com` (no `.org`): falla en redes con allowlist y es un host atípico. |
| 6 | Info | Búsqueda de secretos (`ghp_`, `sk-`, `AKIA`, claves privadas) en archivos versionados: sin coincidencias. |
| 7 | Info | `scripts/seed-library.mjs` exige PDFs ausentes de `public/uploads/` (tarea 3.1 del change pendiente). |

## Correcciones aplicadas (segundo commit)

- #2 `use-mobile.ts` con `useSyncExternalStore`.
- #3 `.env` y #4 `upload/` salen del índice (`git rm --cached`; los archivos siguen en
  disco y quedan ignorados). Siguen en el historial anterior.
- #5 `bun.lock`: `registry.npmjs.com` → `registry.npmjs.org` (solo cambia el host).
- #1 **No corregido**: `prisma` (alta) exige Prisma 7; `@mdxeditor/editor` (js-yaml),
  `react-syntax-highlighter` (prismjs) y `sharp` 0.35 son versiones mayores. Subir
  Prisma 6.11→6.19 no cierra el hallazgo (todo el rango 6.13–7.10 está afectado).
  Requieren suite E2E para validarse.

## Fixes de producto

- **Páginas leídas en modo automático:** con PDF y EPUB el teleprompter giraba
  página con `silentJumpTo` (salto silencioso), que pone `pending.pages = 0` y
  suprime hitos; solo el modo texto contaba. Ahora el cruce cuenta como lectura
  (páginas de hoy, hitos, fin de libro) en los tres dominios. La alineación al abrir
  sigue siendo silenciosa y el retroceso no recuenta (marca alta). El giro no abre
  el diálogo de pausa (quedaría tapado por la capa inmersiva, z-70 > z-50).
- **Fundido de transición:** títulos con aparición de 900 ms (opacidad + asentamiento
  de 0.3em) y fundido de 700 ms de la columna al cambiar de página; respeta
  `prefers-reduced-motion` y el preset Instantánea.

Sin verificar en navegador (entorno sin Chromium ni binarios de Prisma).

## Incidente: el Auto se quedaba trabado en los títulos (regresión propia)

- **Síntoma** (EPUB «El mundo de Sofía», p. 180 «El helenismo», meta 4/10): el Auto se detenía en una página que solo contiene un título.
- **Causa:** al hacer que el teleprompter contara páginas, `onGoToPage` pasó a ser una función creada en cada render de `ReaderView`. El lector se re-renderiza cada segundo (cronómetro), así que `slide` y el efecto del motor se reiniciaban cada ~1 s y el temporizador volvía a empezar. Una pausa de título más larga que eso (1042 ms a velocidad 4, 1389 ms a 3, 2083 ms a 2; dos títulos seguidos acumulaban dos respiros) no llegaba a cumplirse nunca.
- **Arreglo (3 capas):** `tpGoToPage` con `useCallback`; el motor lee el callback por ref; y `lib/step-timer.ts` hace que un reinicio del efecto solo espere lo que faltaba. Prueba que reproduce el atasco: `scripts/test-step-timer.ts` (7/7).
- **Fluidez:** título tras título ya no acumula dos respiros (1042 → 542 ms a velocidad 4); `test-teleprompter-engine.ts` sigue en «MOTOR SANA».
- **Aviso UX:** `TeleprompterPageNotice` anticipa el cambio («Pasando a la página N…», últimas 48 letras) y confirma la llegada («Página N · hoy a/b», o «¡meta de hoy cumplida!»). Visible con la barra oculta, `aria-live`, respeta reduced-motion. `scripts/test-page-notice.tsx` (7/7).
- Sin verificar en navegador (sin Chromium ni Prisma en este entorno).
