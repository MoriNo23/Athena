# Tasks

## 1. Reproducir y localizar el caso C1 (la rueda contra la cámara en vuelo)

- [ ] 1.1 Sonda que reproduzca el caso con la cámara en vuelo: revelado completo → `ArrowLeft` → 80 ms → rueda `−240` → medir `scrollTop` a los 500 ms, comparando con el destino de la animación (~1257 px) y con el lugar de la rueda (~1001 px). Instrumentar `viewAnimRef` y el `scrollTop` de cada frame. Verificación: la sonda falla hoy (el scroll acaba en el destino de la animación) y dice cuál de los tres candidatos es (compositor / animación reiniciada / cancelación que no llega).
- [ ] 1.2 Descartar candidatos: repetir con la cámara en reposo (sin animación en vuelo) y con el scroll suave del compositor desactivado (`--disable-smooth-scrolling`), para separar el scroll del compositor de la cancelación de la animación. Verificación: notas en el design del change con el resultado de cada variante.

## 2. Arreglo: el desplazamiento manual gana a la cámara en vuelo

- [ ] 2.1 Aplicar el arreglo en `use-teleprompter-window.ts` / `TeleprompterOverlay.tsx` (cancelar la animación en vuelo al llegar la rueda, o congelar la cámara si el compositor manda). Verificación: el caso C1 de `node scripts/probe-camara-suave.js` en verde — la vista se queda donde el lector la puso (deriva < 30 px) y el seguimiento no la arrastra de vuelta.
- [ ] 2.2 La transición breve del seguimiento normal se conserva (avance de línea, título, rebobinado). Verificación: `probe-camara-suave.js` completo en verde (R1, C1, X1, X2, T1, B1).

## 3. Entorno reproducible

- [ ] 3.1 `scripts/seed-library.mjs` vuelve a garantizar sus libros: los PDFs semilla se generan con `make-big-pdf.py` (el escaneado OCR se toma de `scripts/`) cuando no están en `public/uploads/`, o el script dice qué falta en vez de romperse. Verificación: `bun scripts/seed-library.mjs` deja la biblioteca con «Don Quijote», «Cuaderno de Atenas» y «Meditaciones».
- [ ] 3.2 Procedimiento de verificación (`scripts/README` o el propio change): dev server con el CSS recompilado (`scripts/with-dev.sh`, que reinicia el servidor porque Turbopack no recompila `globals.css` en caliente), semilla, fixture de cámara y recorrido de las sondas con el resultado esperado. Verificación: el procedimiento se puede seguir desde cero en otra máquina.

## 4. Verificación completa (todo el teleprompter)

- [ ] 4.1 `node scripts/probe-auto-cruce.js` (5/5), `node scripts/probe-flechas-tp.js` (9/9), `node scripts/probe-camara-suave.js` (8/8) en verde.
- [ ] 4.2 `node scripts/test-vn-auto.js` (18/18), `node scripts/test-vn-stress.js` (completa) y `node scripts/test-hotkeys-e2e.js` en verde con el servidor dev.
- [ ] 4.3 `bunx tsc --noEmit`, `bun run lint` y `bun run crap:changed` en verde.
- [ ] 4.4 `openspec validate teleprompter-verificacion-y-rueda --strict` sin hallazgos.

## Notas de estado (para quien siga)

- Lo archivado (`2026-10-19-teleprompter-banda-y-flechas`) ya está aplicado y verificado: banda de lectura del 40 % alcanzable (`padding-top: 40vh` en `.tp-scroll`) y flechas con un gesto por tecla (`→`/`←` una letra, `Shift+→`/`Shift+←` página). Sus sondas (`probe-auto-cruce.js`, `probe-flechas-tp.js`) están en verde; no hay que rehacer ese trabajo.
- `test-vn-stress.js` exige los libros semilla por nombre («Don Quijote», «Cuaderno de Atenas»): sin ellos se detiene al principio. En este entorno se restauraron a mano (subiendo por la API) porque los archivos no están en `public/uploads/`.
- `test-vn-stress.js` se detiene también al pulsar `tp-auto` con el chrome auto-oculto (3,5 s de quietud): se añadió `despertar(page)` antes del clic, pero la suite completa sigue sin ejecutarse de principio a fin.
- La biblioteca del usuario quedó con libros de prueba: «Atensayo (fixture de sondas)» (el fixture de cámara), «Don Quijote de la Mancha (Selección Atena)» y «Cuaderno de Atenas (libro capturado, img)». El primero lo sube `scripts/tp-fixture.js` de forma idempotente.
