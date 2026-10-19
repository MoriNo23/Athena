# Proposal

## Why

La cámara animada del teleprompter persigue una banda de lectura que no puede alcanzar: el carácter activo se sitúa al 40 % del alto visible, pero la columna solo deja 96 px por encima del primer carácter (`pt-24`). Al inicio de cada página —y justo después de un cruce— esa banda es **inalcanzable**: la cámara apunta a un `scrollTop` negativo, el navegador lo clampa a 0 y el animador se pasa de largo. De ahí los dos defectos que se ven en pantalla: el texto se queda pegado al margen superior peleándose con el espacio y la columna **rebota** (vaivén) en vez de avanzar.

Además las flechas del modo hacen dos cosas a la vez: `→` revela la página entera de golpe (o cruza) mientras `←` retrocede una letra. La misma tecla significa "un carácter" y "una página" según el estado: el lector tiene que adivinar qué va a pasar.

## What Changes

- **Banda de lectura alcanzable.** La columna reserva el 40 % del alto antes del primer carácter de cada página. La banda deja de ser inalcanzable: la cámara apunta a posiciones válidas, el texto se queda en la línea de lectura y el cruce de página (Auto u orden del lector) aterriza el inicio de la página nueva exactamente donde estaba la lectura, sin rebote ni vaivén.
- **Flechas con un único efecto.** `→` y `←` mueven el encendido **una letra**; `Shift+→` y `Shift+←` cambian de página. El recordatorio de teclas y la pista inferior acompañan el mapa nuevo.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `teleprompter`: la banda de lectura del 40 % es alcanzable en todo momento (inicio de página, cruce, final) y las flechas del modo se reparten en un gesto por tecla (letra / página).

## Impact

- Estilos: `src/app/globals.css` (reserva superior de la columna del teleprompter) y `src/components/reader/TeleprompterOverlay.tsx` (se retira el `pt-24` de la columna).
- Hooks: `src/hooks/use-teleprompter-player.ts` (acciones `stepForward`, `goToNextPage`, `goToPrevPage`; el motor sigue el avance manual).
- Componentes: `src/components/reader/TeleprompterOverlay.tsx` (reparto de teclas, recordatorio de teclas, pista inferior).
- i18n es/en/pt (`src/lib/i18n/*`): mapa de teclas del teleprompter.
- Sondas: `scripts/probe-auto-cruce.js` (nuevo, cruce en Auto), `scripts/probe-flechas-tp.js` (nuevo, mapa de teclas), `scripts/probe-camara-suave.js` (libro de prueba denso y `Shift+→` para autorizar el cruce) y `scripts/tp-fixture.js` (nuevo, libro de prueba denso para las sondas de cámara).
- Sin cambios de API, base de datos, dependencias ni formato de respaldo.
