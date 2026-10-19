# Design

## Context

Estado que deja el change archivado `2026-10-19-teleprompter-banda-y-flechas` (aplicado y verificado):

- **Banda de lectura.** `.tp-scroll { padding-top: 40vh }`: la columna reserva el 40 % del alto por encima del primer carácter, así que la cámara (`scrollToChar`, objetivo = `scrollTop + (pos − 0.4 · clientHeight)`) nunca apunta a un `scrollTop` negativo. Sin la reserva el objetivo era negativo → clamp a 0 → vaivén y texto pegado al margen. Medido: sin la reserva el carácter activo tras un cruce en Auto se queda entre 60 y 214 px (banda = 320 px con alto 800); con la reserva, entre 320 y 428 px, y la columna no invierte su dirección (0 inversiones).
- **Flechas.** `→`/`←` mueven una letra (`stepForward` / `rewindOne`), `Shift+→`/`Shift+←` cambian de página (`goToNextPage` = cruce atómico `slide(0)`; `goToPrevPage` = página anterior completa y encendida). El motor re-sincroniza su índice con `litRef` en cada paso para no iluminar por detrás de un avance manual.
- **Sondas.** `scripts/tp-fixture.js` (libro de prueba con texto denso: PDF generado con `make-big-pdf.py --lines 6` y subido por la API), `scripts/probe-auto-cruce.js` (5/5) y `scripts/probe-flechas-tp.js` (9/9). `scripts/probe-camara-suave.js` usa el fixture y analiza el cruce por muestras (el hilo principal se bloquea durante el intercambio con columnas densas y la ventana por reloj se quedaba vacía).

### El caso C1, con lo medido

Secuencia de la sonda: revelado completo por click → `ArrowLeft` (rebobinado: la cámara ordena ver el carácter anterior) → 80 ms → rueda `−240` → 500 ms → medición.

| momento | `scrollTop` |
|---|---|
| tras el click (revelado) | 214 (el texto revelado queda donde está, bajo la línea) |
| 80 ms tras el rebobinado | 1241 (la animación de vista en vuelo, destino ~1257) |
| 500 ms tras la rueda | 1257 — **el destino de la animación**, no el lugar de la rueda (~1001) |

Comprobaciones de apoyo:

- La rueda **sí** desplaza la columna del teleprompter: rueda abajo `0 → 164`, rueda arriba `48 → 0` (clamp en el tope). También funciona en una página simple en headless (`scrollY 0 → 600`): no es una limitación del entorno.
- Con el CSS viejo (sin la reserva) el resultado es el mismo: el fallo **no** lo introduce la banda.
- La rueda llega cuando la animación de la cámara sigue en vuelo: `onWheel` llama a `cancelViewAnim()`, que cancela el `requestAnimationFrame`. Candidatos a explicar que la vista termine en el destino de la animación:
  1. El scroll suave del navegador corre en el compositor: un `scrollTop` escrito por el hilo principal (la cámara) cancela la animación del compositor, y la rueda se queda sin efecto.
  2. La animación se reinicia después de la rueda (el motor o un `scrollToChar` pendiente emite otra orden) y vuelve a escribir el destino.
  3. `cancelViewAnim()` no cancela la animación viva (referencia equivocada, o una segunda animación arrancada justo después).

  Hay que discriminar entre las tres antes de tocar código: instrumentar `viewAnimRef` y el `scrollTop` en cada frame, y repetir con la cámara en reposo (sin animación en vuelo) para ver si el caso se reproduce.

### Entorno

- El dev server **no recompila `globals.css`** con los cambios en caliente (caché de Turbopack): hay que reiniciarlo o los cambios de estilo no llegan al navegador. `scripts/with-dev.sh` ya lo hace (arranca, espera y para), pero mata el servidor que haya en el puerto 3000.
- La biblioteca de la casa perdió los libros semilla (`Don Quijote`, `Cuaderno de Atenas`, `Meditaciones`): `scripts/seed-library.mjs` los exige en `public/uploads/` y no están. `test-vn-stress.js` y `test-hotkeys-e2e.js` dependen de ellos.

## Goals / Non-Goals

**Goals:**

- C1 en verde: la rueda deja la vista donde el lector la puso, con la cámara en vuelo y sin ella.
- Todas las sondas de la casa del teleprompter ejecutables y en verde, con el mismo resultado en cualquier máquina (fixture + libros semilla garantizados).
- Procedimiento documentado para repetir la verificación (qué levantar, qué sembrar, qué ejecutar, qué se espera).

**Non-Goals:**

- No se toca el modelo de teclas ya aplicado (`→`/`←` letra, `Shift+→`/`Shift+←` página) ni la banda de lectura: están archivados y verificados.
- No se rediseña la cámara (transiciones, anclaje, títulos): solo que la interrupción manual gane.

## Decisions

### D1. Instrumentar antes de corregir C1

La causa exacta está entre tres candidatos y el arreglo es distinto en cada uno. Antes de tocar `use-teleprompter-window.ts` hay una sonda que reproduce el caso con la cámara en vuelo e instrumenta `viewAnimRef` y el `scrollTop` por frame; el arreglo va detrás del dato, no al revés.

### D2. La rueda manda sobre la animación en vuelo

El contrato ya está en la spec («La relectura manual manda»): el desplazamiento manual del lector gana. Con la animación en vuelo, hoy gana la cámara. El arreglo debe conservar la transición breve del seguimiento normal (el avance de línea sigue animado) y solo ceder ante la rueda.

### D3. El fixture y los libros semilla se garantizan, no se siembran a mano

`scripts/tp-fixture.js` ya sube el fixture por API si no está (idempotente, la API deduplica por nombre de archivo). Los libros semilla de `seed-library.mjs` deben poder generarse igual (el PDF se genera con `make-big-pdf.py`; el escaneado OCR se puede copiar desde `scripts/`), o las sondas que los necesitan deben declarar que no pueden correr sin ellos en vez de romperse a mitad.

### D4. La verificación se apoya en condiciones, no en tiempos

Dos casos se quedaron falsos por carrera: `test-vn-auto.js` medía los encendidos en el mismo instante del giro de página (el título de la página nueva abre con un respiro) y `probe-camara-suave.js` esperaba por reloj una ventana de muestras que el hilo principal bloqueado deja vacía. Ambas esperas son ahora por condición.

## Risks / Trade-offs

- [Cancelar la animación de la cámara al llegar la rueda puede cortar una transición visible] → es justo el comportamiento pedido: la rueda es una orden del lector.
- [El scroll suave del compositor puede seguir la orden del hilo principal] → hay que comprobar si el navegador honra el `scrollTop` escrito durante una animación de scroll; si no, la alternativa es congelar la cámara (no emitir órdenes) mientras el lector desplaza.
- [Restaurar los libros semilla toca la biblioteca del usuario] → el `seed-library.mjs` ya es la herramienta de la casa para eso («garantiza los libros»); documentar que las sondas lo usan.

## Migration Plan

Sin migración: no hay cambios de API, base de datos ni formato de respaldo.

## Open Questions

- El pixel de scroll del compositor: ¿gana el hilo principal? (decide entre «cancelar la animación» y «congelar la cámara»).
