# Tasks

## 1. Baseline de medición (antes de tocar nada)

- [ ] 1.1 (a) Medir payload y conteo de filas de `GET /api/books` con la biblioteca del fixture (`/tmp/opencode`: script ad-hoc con `asegurarLibro` + sesiones inyectadas vía `use-reading-session` o BD) — número antes.
- [ ] 1.2 (b) Contar renders/tick del overlay (React Profiler en un run de ~10 s con la sonda `probe-flechas-tp.js` en marcha o export de Profile via page.evaluate) — número antes.
- [ ] 1.3 (c) `bunx next build` y registrar el peso del chunk del lector (route bundle del lector) — número antes.

## 2. Lever (a): agregación por día en GET /api/books

- [ ] 2.1 Grep maestro de compatibilidad: ningún consumidor usa sesiones a nivel unidad (solo `groupSessionsByDay`/sumas por día); si aparece un uso unit-sesión, parar la palanca y re-plantear con el usuario.
- [ ] 2.2 Implementar el `groupBy` (`src/app/api/books/route.ts` GET): sumas por `(bookId, date)`, campo `sessions` como filas por día, badge intacto.
- [ ] 2.3 Re-medir con el script de 1.1 (payload/filas después) y comprobar la UI de biblioteca (streak/rate/today) con el mismo numéro que antes (regresión cero).

## 3. Lever (b): tick del teleprompter donde solo duele

- [ ] 3.1 Aplicar la opción (b-i) design §2: `React.memo` a los subárboles que no consumen `lit` (el stream ya se actualiza imperativo).
- [ ] 3.2 Perfil de renders/tick (como 1.2). Si (b-i) deja renders en hijas que dependen del tick o congela algo vivo, caer a (b-ii: `lit` al componente mínimo con `litRef` + rAF).
- [ ] 3.3 Verificar la conducta viva: `probe-camara-suave.js` 8/8 + `probe-flechas-tp.js` 9/9 + aviso de página (`tp-page-notice-bar` ≈2000 ms) — nada congelado ni tardío.

## 4. Lever (c): stage perezoso

- [ ] 4.1 `ReaderView`: `next/dynamic` de `ReaderStage` con `ssr: false` (design §3).
- [ ] 4.2 Re-medir bundle (como 1.3) y abrir PDF y EPUB en el browser — carga identica, sin FOC/hidración muerta.

## 5. Cierre

- [ ] 5.1 `bun run lint` + `bunx tsc --noEmit` en verde
- [ ] 5.2 Tabla final antes/después de las 3 métricas (payload, renders/tick, bundle) en el mensaje del último commit
- [ ] 5.3 Commits por lever (design §4) y push
