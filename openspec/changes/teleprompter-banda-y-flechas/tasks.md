# Tasks

## 1. Banda de lectura alcanzable (fin del rebote en Auto)

- [ ] 1.1 La columna del teleprompter reserva el 40 % del alto por encima del primer carácter (`.tp-scroll { padding-top: 40vh }` en `globals.css`, retirando el `pt-24` del className de `TeleprompterOverlay`). Verificación: `node scripts/probe-auto-cruce.js` — el cruce en Auto deja el carácter activo en la banda (~40 % del alto) y la columna no invierte su dirección (0 inversiones); antes del cambio el mismo caso falla (texto en el margen, 3 inversiones).
- [ ] 1.2 El motor sigue el avance manual: el índice del motor se re-sincroniza con `litRef` en cada paso, de modo que un avance manual no queda atrás ni lo deja atrás el contador. Verificación: `node scripts/probe-flechas-tp.js` — tras `→` el motor no vuelve a iluminar por detrás.

## 2. Flechas: letra a letra y salto de página

- [ ] 2.1 `use-teleprompter-player.ts`: `stepForward()` (enciende un carácter —o el bloque entero si es un título—, pausa el flujo y lleva la vista), `goToNextPage()` (cruce atómico a la página siguiente) y `goToPrevPage()` (página anterior completa y encendida). Verificación: `node scripts/probe-flechas-tp.js`.
- [ ] 2.2 `TeleprompterOverlay.tsx`: `→` → `stepForward()`, `←` → `rewindOne()`, `Shift+→` → `goToNextPage()`, `Shift+←` → `goToPrevPage()`; el resto de teclas sin cambios. Verificación: la sonda de flechas.
- [ ] 2.3 Recordatorio de teclas y pista inferior al mapa nuevo (es/en/pt): `ghost.tp.next` → avanzar una letra, `ghost.tp.rewind` → retroceder una letra, `ghost.tp.page` → cambiar de página (`Shift+→`/`Shift+←`), `tp.hint` al día. Verificación: `bunx tsc --noEmit` y `bun run lint` en verde.

## 3. Sondas deterministas

- [ ] 3.1 `scripts/tp-fixture.js`: libro de prueba con texto denso (PDF generado al vuelo con `make-big-pdf.py` y subido por la API) para que las sondas de cámara no dependan de los libros de la biblioteca del usuario. Verificación: la sonda abre el fixture y la columna tiene contenido scrolleable.
- [ ] 3.2 `scripts/probe-auto-cruce.js`: cruce en Auto sin vaivén y con el texto en la banda de lectura.
- [ ] 3.3 `scripts/probe-flechas-tp.js`: `→`/`←` mueven una letra, `Shift+→`/`Shift+←` cambian de página.
- [ ] 3.4 `scripts/probe-camara-suave.js` adaptado: libro de prueba denso y `Shift+→` para autorizar el cruce (la tecla `→` ya no cambia de página).

## 4. Verificación de integración

- [ ] 4.1 `bunx tsc --noEmit`, `bun run lint` y `bun run crap:changed` en verde.
- [ ] 4.2 `node scripts/test-vn-auto.js`, `node scripts/test-vn-stress.js` y `node scripts/test-hotkeys-e2e.js` en verde con el servidor dev.
- [ ] 4.3 `node scripts/probe-auto-cruce.js`, `node scripts/probe-flechas-tp.js` y `node scripts/probe-camara-suave.js` en verde.
- [ ] 4.4 `openspec validate teleprompter-banda-y-flechas --strict` sin hallazgos.

## Notas de implementación

- El salto de página con `Shift+→` reutiliza el cruce atómico que ya existe (`slide(0)`): la página siguiente entra con su primer carácter sin encender y el anclaje lo deja en la banda de lectura.
- `→` al final de la página no hace nada: el gesto de página es `Shift+→` (y el botón inferior, que ya rotula «Página siguiente»).
