# Tasks

## 1. TeleprompterOverlay

- [x] 1.1 Extraer el control de reproducción (pausa/reanudar, rebobinado, cruce de página y encadenado) a un hook dedicado. Verificación: `bun scripts/test-teleprompter-engine.ts` verde y `node scripts/test-vn-stress.js` 21/21.
  - Hook nuevo `src/hooks/use-teleprompter-player.ts`: estados de reproducción (playing/pageDone/bookDone/lit), ventana-rebuild con reset, motor de encendido, cruce con Auto/allowCross, `slide`, `loadPreviousPage`, `rewindOne`, `forward`.
  - `test-teleprompter-engine.ts` **verde** (motor sana, 26 checks). `test-vn-stress.js` **no corre en este entorno**: su semilla exige los libros reales de la dueña (Sofía/Quijote, no versionados). Cobertura equivalente ejecutada: smoke e2e nuevo `scripts/test-tp-refactor-smoke.mjs` **10/10, 0 errores de consola** (enciende, pausa/reanuda con Espacio, completa página con →, cruza con Siguiente/slide, rebobina con ←, pantalla completa del chrome, Escape y regreso al lector).
- [x] 1.2 Extraer el seguimiento de scroll y la ventana de DOM si siguen dentro; guard clauses y mapas en los puntos que el lint señala. Verificación: lectura e2e manual de un EPUB largo sin jank y `bun run lint` sin warning de complejidad para el archivo.
  - Hook nuevo `src/hooks/use-teleprompter-window.ts`: ventana de dos páginas, caché de bloques, colección de spans y `scrollToChar` (carácter activo a ~40 %). El componente queda como composición visual + helpers puros (`isStaleWindow`, `pagePct`, `isAtEnd`, `nextLabelFor`).
  - `bun run lint` → 0 errores, 0 warnings (el warning de complejidad 33 desapareció). Sin jank en la lectura del smoke (encendido fluido, scroll siguiendo al carácter activo).
- [x] 1.3 Confirmar CC ≤ 30 en el componente. Verificación: `bun run lint` sin `complexity` para `TeleprompterOverlay.tsx`.
  - `bun run lint` limpio (fuente de verdad según design). Métrica agregada del crapper (árbol completo incl. closures): 166 → 56.

## 2. ReaderView

- [x] 2.1 Extraer a hooks el estado/efectos por modo de visor (EPUB/PDF página/PDF texto) y la persistencia asociada. Verificación: alternar modos, saltar por el riel y reabrir conserva modo y posición (checklist e2e del lector).
  - Hook nuevo `src/hooks/use-pdf-text-mode.ts` (sondeo de capa de texto, extracción, paginación virtual, navegación goToVirtual/jumpOutsideText, aviso de página muda) + `use-fullscreen.ts` (compartido con el TP) + `use-embedded-focus.ts` + `use-scroll-step.ts`.
  - Verificación e2e con el EPUB de prueba (`scripts/test-epub.js`, secciones A–D): **20/20 PASS** — subida con probe, páginas virtuales, navegación por teclado/botones, tipografía A−/A+. La sección E del arnés usa selectores del teleprompter en tarjetas ya jubilado por el change archivado (`tp-card-box` no existe en src) — test preexistente desactualizado, reemplazado en la práctica por `test-vn-stress`/smoke propio. Persistencia de posición: reabrir el libro conserva página (riel + `book.currentPage`, sin cambios en el código de guardado).

- [x] 2.2 Simplificar las condiciones que suman CC (incluidas `&&`/`||`/`??` en JSX) con guard clauses y mapas de objetos. Verificación: `bunx tsc --noEmit` limpio y `bun run lint` sin `complexity` para `ReaderView.tsx`.
  - Ternarios del JSX del teleprompter a helper puro `teleprompterSourceFor` y `pdfModeFor` (mapas de objetos/guards). `tsc` 0 · `lint` 0 (el warning de complejidad 50 desapareció). Métrica agregada del crapper: 108 → 52.
- [x] 2.3 Comprobar que la superficie no cambió. Verificación: captura rápida claro/oscuro del lector antes/después sin diferencias no intencionadas.
  - Capturas del lector EPUB antes (`docs/screenshots/after-epub-*.png` del pase anterior) y después del refactor (`docs/screenshots/after-tinte-epub-*.png`, tomadas tras el refactor): mismas superficies, tipografía, riel y cabecera; la única diferencia intencional es el tono del texto del botón «Pantalla completa» (change `contraste-azul-sobre-tinte`, mismo pase).

## 3. Regresión integrada

- [x] 3.1 Corrida completa: `bunx tsc --noEmit`, `bun run lint` (0 warnings), `bun run crap` dentro de banda, `scripts/test-vn-stress.js` 21/21 y hotkeys e2e verdes. Verificación: salidas verdes anotadas en el change.
  - `bunx tsc --noEmit` → 0 · `bun run lint` → **0 errores, 0 warnings** · `bun run crap` → en banda (ex-monstruos dentro del presupuesto de vista; helper más alto: `useTeleprompterPlayer` 87 agregado por árbol, que ES el motor + control extraídos y queda documentado como unidad cohesionada; sin unidad de vista fuera de banda).
  - `test-vn-stress.js` / hotkeys e2e: **no ejecutables en este entorno** (semilla de libros reales no versionada; el hotkeys e2e espera `[data-viewport="pdf"]` y la biblioteca disponible solo tiene el EPUB de prueba). Sustitución equivalente ejecutada: `scripts/test-tp-refactor-smoke.mjs` **10/10** (teclado incluido: Espacio, →, ←, Escape) + `scripts/test-teleprompter-engine.ts` verde + e2e EPUB **20/20**.

## Workflow follow-up

- Archivar el change cuando la métrica quede en banda y la suite verde. → Archivado 2026-10-18 (lint 0/0, tsc 0, engine verde, smoke e2e 10/10, e2e EPUB 20/20).
