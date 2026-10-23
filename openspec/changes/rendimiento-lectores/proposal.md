# Proposal

## Why

La verificación de rendimiento del explore confirmó tres spots de gasto sin ningún beneficio de producto: (a) `GET /api/books` devuelve **todas las filas de sesión de cada libro** cuando los consumidores solo las suman por día, (b) el overlay del teleprompter **re-renderiza el árbol completo en cada tick** del encendido solo para actualizar dos derivadas (`pct`, `atEnd`), y (c) el bundle del lector lleva el stage completo (pdf.js, epub engine) aunque nada lo pida antes de abrir un libro. Son palancas internas: el usuario no ve comportamiento distinto, ve la misma app cargando y corriendo más ligera.

## What Changes

- **(a)** `src/app/api/books/route.ts` GET: reemplazar `include: { sessions: … }` (fila por sesión) por agregación SQL por día (`groupBy(bookId, date)` sumando `pagesRead`/`minutes`), mapeada al **mismo campo** `sessions` como filas por-día — los consumidores solo usan sumas por día (verificado en `BookCard`, `use-library-books`, `use-reading-session`, `use-finish-eta`), así la respuesta queda shape-compatible.
- **(b)** `TeleprompterOverlay`/`use-teleprompter-player`: costear el tick — memo de los subárboles que no consumen `lit` (el stream se actualiza imperativo) o llevar `lit` para abajo al único consumidor; decisión por perfil de render en apply.
- **(c)** `ReaderView`: importar `ReaderStage` con `next/dynamic` (`ssr: false`) — el stage pesado (pdf.js, epub) entra solo al abrir un libro.
- **No cambia** respuesta observable, UI, ni specs: change con `skip_specs` (zero-delta).

## Capabilities

### New Capabilities

(ninguna — skip_specs: true, sin cambio de comportamiento)

### Modified Capabilities

(ninguno)

## Impact

- Ámbito: `src/app/api/books/route.ts` (GET), `src/hooks/use-teleprompter-player.ts` y/o `src/components/reader/TeleprompterOverlay.tsx`, `src/components/reader/ReaderView.tsx`. Sin cambios de dependencias ni de BD (los índices que el `groupBy` necesita ya existen).
- Riesgo: (a) si algún consumidor usa `sessions.length` o sesión-unit distinta, la forma por-día lo rompe → grep de compatibilidad maestro en task 2.1 antes de tocar el route; (b) memo mal aplicado congela UI que sí depende del tick → decidir por perfil y medir, no a ciegas.
- Rollback: palancas independientes, cada una un commit; `git revert` selectivo.
