# Proposal

## Why

Hoy una página se cuenta cuando el lector **entra** en ella, no cuando la termina: `pagesRead` se deduce del delta de `currentPage`. Eso infla la racha y la meta (una página apenas hojeada ya suma), pierde la primera página de cada sesión y no cuenta ninguna página virtual del modo texto. El teleprompter, que es el modo de lectura principal, tampoco respira bien en la puntuación española (miles con punto, abreviaturas, párrafos) ni avisa de la página leída, y la sinopsis del libro no existe en la biblioteca.

## What Changes

- **Página leída como evento propio**: `markPageRead(page)` idempotente por sesión. El teleprompter la dispara al entrar en la última línea visible de la página; la lectura manual, al cumplir un dwell mínimo con la pestaña visible. `currentPage` sigue moviendo el riel, la ETA y los hitos, pero deja de sumar páginas.
- **Puntuación española en el motor**: punto de miles (`1.500`) y coma decimal (`3,14`) no pausan ni cortan tarjeta; abreviaturas (`Sr.`, `etc.`, `p. ej.`) tampoco; `¿` y `¡` abren respiro; pausa de párrafo entre bloques de cuerpo; la raya respira en apertura y cierre.
- **Aviso no invasivo de página leída** en el teleprompter («Página leída · hoy N/meta»), reutilizando el CSS `.tp-notice-flash` que quedó huérfano; el contador «hoy» deja de ocultarse en móvil.
- **Correcciones visuales**: offsets de cabecera/progreso/avisos respetan `safe-area-inset-top` (hoy se pisan en móviles con notch); se retira el `backdrop-filter` del aviso en puntero grueso (misma clase de parpadeo del WebView que ya se corrigió en cabecera y pie); prioridad entre aviso de descanso y aviso de página.
- **Sinopsis automática**: al detectar título y autor, el cliente busca la descripción en Google Books y, si falla, en OpenLibrary; se guarda en `extras.synopsis` (sin migración de esquema), se muestra en la tarjeta con `line-clamp` y se puede editar en el diálogo de edición. Sin cuentas, sin nube y con el texto cacheado para leer offline.
- **Limpieza de la casa**: se corrige `.github/PULL_REQUEST_TEMPLATE.md`, que aún referencia `prisma/schema.prisma` y `src/app/api/**`, y se añade `.github/dependabot.yml` (bun + github-actions, semanal).

## Capabilities

### New Capabilities

- `reading-session`: cuándo cuenta una página como leída, deduplicación por sesión, dwell mínimo, y separación entre posición de lectura y páginas leídas.
- `teleprompter`: tipografía y pausas en español, umbral de última línea, aviso de página leída, contador móvil y offsets de interfaz con safe-area.
- `book-metadata`: sinopsis obtenida de fuentes públicas desde el cliente, cacheada localmente en `extras`, editable y mostrada en la biblioteca.

### Modified Capabilities

Ninguna: el proyecto no tenía specs previas.

## Impact

- `src/core/reading.ts` y `src/core/teleprompter.ts` (reglas puras + tests).
- `src/hooks/use-reading-session.ts`, `src/hooks/use-teleprompter-player.ts`, `src/hooks/use-teleprompter-window.ts`.
- `src/components/reader/TeleprompterOverlay.tsx`, `src/components/reader/ReaderView.tsx`, `src/components/library/BookCard.tsx`, `src/components/library/EditBookDialog.tsx`.
- `src/styles/globals.css` (offsets con safe-area, aviso, puntero grueso).
- `src/core/types.ts` (`BookExtras.synopsis`), `src/lib/i18n/{es,en,pt}.ts`.
- Nuevo `src/lib/book-metadata.ts` (búsqueda de sinopsis) reutilizando el patrón de `src/lib/cover-search.ts`.
- Nuevo `.github/dependabot.yml` (bun + github-actions) y corrección de `.github/PULL_REQUEST_TEMPLATE.md`.
- **No cambia** `server/api.ts` ni `public/athena-offline.js`: `extras` ya se persiste y se espeja, y `pagesRead`/`currentPage` mantienen el mismo contrato `{ ok, data?, error? }`.
- Tres PRs con subida de parche (2.1.6, 2.1.7, 2.1.8): cada push a `main` publica release.
