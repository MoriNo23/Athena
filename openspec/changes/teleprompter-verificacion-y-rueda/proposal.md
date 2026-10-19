# Proposal

## Why

El change `teleprompter-banda-y-flechas` (archivado) corrigió el defecto reportado del teleprompter —el salto de página en modo Auto «brincoteaba» porque la banda de lectura del 40 % era inalcanzable— y repartió las flechas en un gesto por tecla. Quedan tres cosas sin cerrar:

1. **La aplicación está verificada con sondas propias, no con las de la casa.** `probe-auto-cruce.js` (5/5) y `probe-flechas-tp.js` (9/9) están en verde, pero `probe-camara-suave.js` sigue en 7/8: el caso **C1** (la rueda manda sobre la cámara) falla. Las mediciones apuntan a que la cámara sigue escribiendo el desplazamiento después de la rueda: el rebobinado deja una animación de vista en vuelo con un recorrido enorme y, cuando llega la rueda, el desplazamiento acaba en el destino de esa animación (1257 px) en vez de donde el lector dejó la vista (~1001 px).
2. **Dos suites de la casa no completan en este entorno.** `test-vn-stress.js` exige los libros semilla «Don Quijote» y «Cuaderno de Atenas», que no estaban en la biblioteca (se restauraron dos a mano; el `seed-library.mjs` no puede garantizarlos porque los archivos no están en `public/uploads`). `test-hotkeys-e2e.js` no llegó a ejecutarse.
3. **La verificación depende del entorno, no del código.** Las sondas de cámara medían sobre los libros reales de la biblioteca —páginas escasas, columna que no scrollea— y sus casos de cruce, título y revelado no se podían observar (la sonda de la casa fallaba 4/8 en baseline). El fixture (`scripts/tp-fixture.js`) lo resuelve, pero no está en la biblioteca de la casa: hay que generarlo y subirlo en cada entorno.

## What Changes

- **C1: la rueda gana a la cámara en vuelo.** El desplazamiento manual del lector manda sobre una animación de vista que sigue en curso: al llegar la rueda, la cámara se cancela y la vista se queda donde el lector la puso. El requisito ya existe en la spec («La relectura manual manda»); hoy no se cumple cuando la animación en vuelo tiene un recorrido grande.
- **Verificación reproducible de lo aplicado.** Un procedimiento (script) que deja el entorno en condiciones de ejecutar todas las sondas del teleprompter: libros semilla garantizados (incluido el fixture de cámara), dev server con el CSS recompilado y recorrido de las suites con su resultado esperado.
- **La biblioteca de pruebas de la casa, restaurable.** `scripts/seed-library.mjs` vuelve a poder garantizar sus libros (hoy los archivos no están en `public/uploads`) o el fixture se genera y sube por API desde las sondas.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `teleprompter`: el desplazamiento manual (rueda) gana a una animación de vista en vuelo; la vista se queda donde el lector la puso.

## Impact

- Hooks: `src/hooks/use-teleprompter-window.ts` (cancelación de la animación en vuelo cuando llega la rueda) y, si hace falta, `src/components/reader/TeleprompterOverlay.tsx` (el manejador `onWheel` de la columna).
- Scripts: `scripts/probe-camara-suave.js` (caso C1 en verde), `scripts/tp-fixture.js` y `scripts/seed-library.mjs` (libros de prueba garantizados), `scripts/with-dev.sh` (dev server con el CSS al día).
- Sin cambios de API, base de datos, dependencias ni formato de respaldo.
