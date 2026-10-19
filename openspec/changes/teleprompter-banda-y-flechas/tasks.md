# Tasks

## 1. Banda de lectura alcanzable (fin del rebote en Auto)

- [x] 1.1 La columna del teleprompter reserva el 40 % del alto por encima del primer carácter (`.tp-scroll { padding-top: 40vh }` en `globals.css`, retirando el `pt-24` del className de `TeleprompterOverlay`). Verificación: `node scripts/probe-auto-cruce.js` — el cruce en Auto deja el carácter activo en la banda (320-428px con un alto de 800px) y la columna no invierte su dirección (0 inversiones). **RED comprobada**: sin la reserva el mismo caso falla (el texto activo se queda entre 60 y 214px, pegado al margen superior).
- [x] 1.2 El motor sigue el avance manual: el índice del motor se re-sincroniza con `litRef` en cada paso, de modo que un avance manual no queda atrás ni lo deja atrás el contador. Verificación: `node scripts/probe-flechas-tp.js` — tras `→` el motor no vuelve a iluminar por detrás.

## 2. Flechas: letra a letra y salto de página

- [x] 2.1 `use-teleprompter-player.ts`: `stepForward()` (enciende un carácter —o el bloque entero si es un título—, pausa el flujo y lleva la vista), `goToNextPage()` (cruce atómico a la página siguiente) y `goToPrevPage()` (página anterior completa y encendida). Verificación: `node scripts/probe-flechas-tp.js` 9/9.
- [x] 2.2 `TeleprompterOverlay.tsx`: `→` → `stepForward()`, `←` → `rewindOne()`, `Shift+→` → `goToNextPage()`, `Shift+←` → `goToPrevPage()`; el resto de teclas sin cambios. Verificación: la sonda de flechas (→ +1 letra, ← −1 letra, Shift+→ cambia de página, Shift+← vuelve).
- [x] 2.3 Recordatorio de teclas y pista inferior al mapa nuevo (es/en/pt): `ghost.tp.next` → avanzar una letra, `ghost.tp.rewind` → retroceder una letra, `ghost.tp.page` → cambiar de página, `tp.hint` al día. Verificación: `bunx tsc --noEmit` y `bun run lint` en verde.

## 3. Sondas deterministas

- [x] 3.1 `scripts/tp-fixture.js`: libro de prueba con texto denso (PDF generado al vuelo con `make-big-pdf.py --lines 6` y subido por la API) para que las sondas de cámara no dependan de los libros de la biblioteca del usuario. Verificación: el fixture abre con 700+ caracteres por página y la columna scrollea.
- [x] 3.2 `scripts/probe-auto-cruce.js`: cruce en Auto sin vaivén y con el texto en la banda de lectura.
- [x] 3.3 `scripts/probe-flechas-tp.js`: `→`/`←` mueven una letra, `Shift+→`/`Shift+←` cambian de página.
- [x] 3.4 `scripts/probe-camara-suave.js` adaptado: libro de prueba denso, `Shift+→` para el salto de página, análisis del cruce por muestras (resiste el bloqueo del hilo principal con columnas densas) y espera de asiento del scroll de la rueda.

## 4. Verificación de integración

- [x] 4.1 `bunx tsc --noEmit` y `bun run lint` en verde.
- [ ] 4.2 `node scripts/test-vn-auto.js` en verde (18/18, tras esperar la condición del primer encendido en la página nueva) y `node scripts/test-vn-stress.js` **sin completar**: la biblioteca del usuario no tiene los libros semilla que la suite exige («Don Quijote», «Cuaderno de Atenas») — se restauraron dos, y la suite llega al tramo «tormenta de clicks» y se detiene al pulsar `tp-auto` con el chrome auto-oculto (fragilidad de la sonda, no del producto). `node scripts/test-hotkeys-e2e.js` sin ejecutar. **Queda en el change siguiente.**
- [x] 4.3 `node scripts/probe-auto-cruce.js` (5/5) y `node scripts/probe-flechas-tp.js` (9/9) en verde; `node scripts/probe-camara-suave.js` en 7/8 (R1, X1, X2, T1 y B1 en verde; **C1 sigue en rojo → sigue en el change siguiente**).
- [x] 4.4 `openspec validate teleprompter-banda-y-flechas --strict` sin hallazgos.

## Notas de implementación

- El salto de página con `Shift+→` reutiliza el cruce atómico que ya existe (`slide(0)`): la página siguiente entra con su primer carácter sin encender y el anclaje lo deja en la banda de lectura.
- `→` al final de la página no hace nada: el gesto de página es `Shift+→` (y el botón inferior, que ya rotula «Página siguiente»).
- La sonda `probe-camara-suave.js` fallaba en baseline (4/8) porque elegía el primer libro con texto de la biblioteca: con los libros reales (páginas escasas) la columna no scrollea y los casos de cruce, título y revelado no se pueden observar. Con el fixture denso los casos tienen sentido.
- El dev server no recompilaba el CSS de `globals.css` (caché de Turbopack): hay que reiniciarlo para que los cambios de estilo lleguen al navegador.

## Workflow follow-up

- Archivar el change cuando la revisión del usuario esté satisfecha (`openspec archive`) y verificar el resultado archivado.
