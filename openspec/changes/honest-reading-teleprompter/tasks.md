# Tasks

## 1. PR 1 · Conteo honesto y aviso (2.1.6)

- [x] 1.1 Añadir `PAGE_READ_MIN_MS = 15_000` y un helper puro `shouldMarkPage` en `src/core/reading.ts`; verificar con `src/core/reading.test.ts` (casos: recién entrado, dwell cumplido, ya marcada).
- [x] 1.2 Implementar `markPageRead(page)` idempotente con `Set` por sesión en `src/hooks/use-reading-session.ts`, hacer que el ticker marque al cumplir el dwell con pestaña visible y quitar la suma de páginas de `turn()`; verificar en el lector que un giro rápido guarda `currentPage` sin subir `pagesRead` y que 20 s en una página guardan 1.
- [x] 1.3 Añadir la medición de la última línea visible y el callback `onPageRead` en `src/hooks/use-teleprompter-player.ts` (fallback a `pageDone` si no hay medida); verificar con un helper puro testeado y con el teleprompter abierto: llegar a la última línea suma, entrar en la siguiente no.
- [x] 1.4 Conectar `onPageRead` en `TeleprompterOverlay.tsx` y `ReaderView.tsx` sin tocar `onGoToPage`; verificar que el riel sigue avanzando y que el contador «hoy» sube al marcar.
- [x] 1.5 Mostrar la píldora «Página leída · hoy N/meta» con `.tp-notice` + `.tp-notice-flash`, `role="status"`, `aria-live="polite"`, `pointer-events: none`, 2,6 s y clave por página; verificar que desaparece sola y que un toque sobre ella sigue pausando el flujo.
- [x] 1.6 Dar prioridad al aviso de descanso sobre el de página y mostrar el contador «hoy» en móvil; verificar en viewport estrecho que no hay dos píldoras ni controles fuera de la barra.
- [x] 1.7 Añadir las claves i18n en `es`, `en` y `pt`; verificar con `src/lib/i18n.test.ts`.
- [x] 1.8 Subir la versión a 2.1.6 y abrir el PR con la checklist de la casa; verificar `bunx tsc --noEmit`, `bun run lint`, `bun test` y humo en APK.

## 2. PR 2 · Puntuación española y móvil (2.1.7)

- [x] 2.1 Implementar `corteTras` con guardas de miles (`1.500`), decimal (`3,14`) y abreviaturas (`Sr.`, `etc.`, `p. ej.`, `EE. UU.`), y usarlo en `buildTeleprompterStream` y `partirEnFrases`; verificar con tests de `src/core/teleprompter.test.ts` (la cifra no pausa ni corta tarjeta).
- [x] 2.2 Añadir respiro de `¿` `¡`, pausa de párrafo entre bloques de cuerpo (nunca entre tarjetas del mismo bloque) y pausa de raya al abrir y cerrar; verificar con tests de la muestra `El Sr. Pérez llegó a las 3,14. —Hola —dijo. ¿Vienes?`.
- [x] 2.3 Sustituir `top-[52px]` y `4.25rem` por una variable `--tp-chrome-top` que sume alto de cabecera y `env(safe-area-inset-top)`; verificar en viewport con safe-area simulada que progreso y avisos no pisan el estado.
- [x] 2.4 Quitar `backdrop-filter` de los avisos en `@media (pointer: coarse)`; verificar en APK que el aviso no provoca repintado del fondo.
- [x] 2.5 Eliminar el CSS que siga huérfano (`.tp-notice-soon`, `.tp-notice-bar`, `tp-notice-count`) y corregir `.github/PULL_REQUEST_TEMPLATE.md` (quitar `prisma/schema.prisma` y `src/app/api/**`); verificar con `rg` que no quedan referencias y que la plantilla solo nombra rutas reales.
- [x] 2.6 Añadir `.github/dependabot.yml` con `bun` (raíz, `bun.lock`) y `github-actions` (raíz): cadencia semanal, `open-pull-requests-limit: 5`, parches y menores agrupados y prefijo `chore(deps)` para respetar Conventional Commits; verificar que GitHub lo lee en Insights → Dependency graph → Dependabot.
- [x] 2.7 Dejar `gradle` (`/android`) fuera a propósito: las versiones las fija Capacitor y un salto automático rompe el APK. Un PR de Dependabot que cambie dependencias de runtime sube parche en el mismo PR (cada push a `main` publica release).
- [x] 2.8 Subir la versión a 2.1.7 y abrir el PR; verificar `bunx tsc --noEmit`, `bun run lint`, `bun test` y humo en APK.

## 3. PR 3 · Sinopsis automática (2.1.8)

- [x] 3.1 Añadir `extras.synopsis?: { text: string; source: "googlebooks" | "openlibrary" | "manual" }` en `src/core/types.ts`; verificar que `BookExtras` sigue compilando en los consumidores.
- [x] 3.2 Crear `src/lib/book-metadata.ts` con Google Books → OpenLibrary, timeout, sin reintentos y fallo silencioso, más un normalizador de `description` (string u objeto); verificar con tests puros del normalizador y de la elección de fuente.
- [x] 3.3 Disparar la búsqueda al guardar título/autor sin sinopsis y al abrir un libro sin sinopsis con título; verificar que no se repite si ya hay sinopsis y que un fallo de red no muestra error.
- [x] 3.4 Añadir textarea de sinopsis y botón «Buscar sinopsis» en `EditBookDialog.tsx`, con `source: "manual"` al editar; verificar que una edición manual no se pisa y que el botón vuelve a proponer texto.
- [x] 3.5 Mostrar la sinopsis con `line-clamp-2` en `BookCard.tsx` sin reservar hueco si falta; verificar en móvil que la tarjeta conserva altura y controles.
- [x] 3.6 Añadir las claves i18n en `es`, `en` y `pt`; verificar con `src/lib/i18n.test.ts`.
- [x] 3.7 Subir la versión a 2.1.8 y abrir el PR; verificar `bunx tsc --noEmit`, `bun run lint`, `bun test` y humo en APK (sinopsis visible offline tras la primera descarga).

## 4. Integración

- [x] 4.1 Verificar que `server/api.ts`, `public/athena-offline.js` y `tests/offline-engine.test.ts` no cambian de contrato y que la sinopsis viaja dentro de `extras` en web y APK.
- [ ] 4.2 Verificar el recorrido completo en APK: leer una página manual (dwell), terminarla en teleprompter (última línea), ver el aviso y el contador, y reabrir sin conexión con la sinopsis cacheada. (Hecho: dwell, última línea, aviso y contador en APK; falta reverificar la sinopsis cacheada sin conexión en el APK.)
- [ ] 4.3 Revisar las release notes de 2.1.6, 2.1.7 y 2.1.8: mencionar el cambio de conteo y la petición de red de la sinopsis (solo título y autor).

## Workflow follow-up

- Archivar el change cuando los tres PRs estén mergeados y verificados.
- Confirmar que las specs archivadas (`reading-session`, `teleprompter`, `book-metadata`) son la referencia vigente.
