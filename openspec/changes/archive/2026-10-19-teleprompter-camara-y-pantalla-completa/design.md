# Design

## Context

Ver `proposal.md` para el motivo. Estado actual que condiciona el enfoque:

- `use-teleprompter-player.ts` publica el rebase del encendido (`setLit`) de inmediato y la ventana nueva (`setWin`) tras `await loadBlocks(nextStart + 1)`: entre ambos renders el motor reordena contra el DOM viejo con índices nuevos, y la cámara anima hacia un sitio equivocado hasta que llega la ventana. Es peor en el primer cruce (la página +2 no está precargada) y sucede en cada cambio de ventana que no esté en caché.
- La orden tras un título apunta a su **último** carácter (`scrollToChar(i - 1)`), así que la cámara se sumerge el alto del bloque entero con la transición de 400 ms.
- El revelado completo de página (clic/espacio) también ordena al último carácter: la vista barre el fondo de la página.
- La barra superior del teleprompter (`TeleprompterOverlay.tsx`) muestra título, página/total/velocidad y controles; no hay hoy del libro. `ReaderView` ya tiene `todayPagesShown` y la meta efectiva para su cabecera.
- La interfaz del teleprompter se auto-oculta (`tp-immersed`, opacidad) y el lector tiene inmersión propia con tecla configurable (`useImmersiveWake` + `useReaderHotkeys`), pero ninguna superficie recuerda las teclas al ocultarse.
- `useFullscreen` es compartido por lector y teleprompter; no hay nada que impida la suspensión de pantalla.

## Goals / Non-Goals

**Goals:**

- Cámara del teleprompter sin rebote ni barridos: cruce atómico, anclaje sin reacomodo, título al inicio, revelado completo quieto.
- Hoy del libro visible en la barra del teleprompter con la misma fuente de conteo que la cabecera.
- Recordatorio de teclas fantasma en los dos modos de pantalla completa (lector y teleprompter).
- Pantalla despierta mientras la lectura está en pantalla completa o con el teleprompter abierto.

**Non-Goals:**

- No cambia el motor de encendido, los presets de velocidad, el sonido, el encadenado ni el rebobinado.
- El recordatorio no es un panel de ayuda permanente ni reemplaza los controles/tooltips; es un destello informativo.
- No se toca API, base de datos ni respaldo.

## Decisions

### D1. Cruce atómico: la ventana entra con el rebase, no después

En `slide()` la ventana nueva se publica de inmediato con los bloques ya disponibles (`{ start: nextStart, pages: [first, null] }`) y la página siguiente se rellena después con un segundo `setWin` que conserva `start`. `setLit` y `setWin` quedan en el mismo render.

- Lo hace: cero renders intermedios con DOM viejo + índices nuevos (raíz del vaivén y del despintado).
- Alternativas descartadas: mantener el `await` y congelar órdenes hasta que llegue la ventana (más estado y el rebase seguiría en otro render); precargar la página +2 al abrir (no elimina el hueco cuando la extracción tarda).

### D2. Anclaje atómico al cambiar de ventana

Antes de tocar la ventana, el jugador guarda en un ref la posición visual del carácter que será el ancla en la ventana nueva (medida sobre los spans reales). El hook de ventana, en un `useLayoutEffect` sobre `[win]`, ajusta `scrollTop` para recolocar ese carácter en la misma posición visual —sin animación— y el animador solo asienta el residual pequeño.

- Mapeo de ancla por caso: cruce → primer carácter de la página nueva (`rebase`); rebobinado con prepend de página anterior → carácter activo (`índice + prevLen`).
- Alternativas descartadas: `overflow-anchor` nativo (no cubre el intercambio completo del stream); primera orden instantánea tras el cambio (convierte el asentamiento en salto y pierde la transición breve del cruce).

### D3. Título: ancla el inicio del bloque

La orden de vista al llegar un título usa el inicio del bloque (`heading.start`) en vez del último carácter, de modo que el título completo queda en la zona cómoda y la cámara no se sumerge por el bloque.

### D4. Revelado completo sin orden de vista

Los pasos que iluminan el resto de la página no emiten orden de cámara: el texto se enciende donde está y la columna no se mueve. El seguimiento fino (carácter a carácter, rebobinado) conserva la transición breve; el asentamiento del cruce lo cubre D2.

### D5. Hoy del libro en la barra del teleprompter

`ReaderView` pasa al overlay el par que ya calcula (`todayPagesShown` + meta efectiva) y la barra lo pinta con el mismo formato y tooltip que la cabecera del lector. No se recomputa el conteo dentro del overlay: una sola fuente (hook de sesión de lectura).

### D6. Recordatorio de teclas fantasma, componente compartido

Componente nuevo (`ShortcutGhost`) con la lista tecla→efecto y una bandera de visibilidad; se monta en `TeleprompterOverlay` y en el chrome de `ReaderView`. Columna a la derecha, tipografía display, letras grandes con opacidad reducida (marca de agua), `pointer-events: none`, `aria-hidden` (decorativo: los controles y tooltips siguen siendo la fuente accesible). Aparece en cada transición de visibilidad de la interfaz y se retira solo (~2.5 s con desvanecido), con un mínimo entre apariciones (~8 s) para que el movimiento del mouse no lo repita sin parar. Mapas: teclas del teleprompter (su `keydown`) y teclas del lector (incluida la tecla de inmersión configurada). Reduced-motion: aparición/retiro sin desplazamiento.

- Alternativas descartadas: dejarlo fijo mientras la UI está oculta (ruido permanente y el pedido era «cada vez que oculte o muestre»); limitarlo al teleprompter (el pedido abarca los modos de pantalla completa y el lector tiene el suyo).

### D7. Pantalla despierta: hook `useWakeLock(enabled)`

Pide `navigator.wakeLock.request("screen")` cuando `enabled` y la pestaña está visible; re-adquiere en `visibilitychange` (visible) y libera al deshabilitar o desmontar; sin soporte, silencio total. `enabled` = `isFullscreen` en `ReaderView` ∪ teleprompter montado (el overlay existe solo mientras el modo está abierto; sin F11 el teleprompter también debe impedir la suspensión: es su caso de uso).

- Alternativa descartada: limitarlo a la Fullscreen API (dejaría fuera el teleprompter sin F11).

## Risks / Trade-offs

- [Reflow tardío de fuentes al cambiar de ventana desplaza el ancla] → la compensación se mide en el layout effect (antes del pintado) y el residual lo asienta el animador; un reflow posterior ya era un riesgo previo.
- [El recordatorio puede sentirse repetitivo] → throttle, desvanecido corto y solo en transiciones reales de visibilidad.
- [Wake Lock no existe en navegadores viejos] → guard silencioso; el spec lo cubre.
- [La sonda requiere Playwright, ausente local] → se extiende `probe-camara-suave.js` con los casos nuevos y se corre donde Playwright exista; los casos cubren cruce con/sin caché, título y revelado.

## Migration Plan

Sin migración: no hay cambios de API, base de datos ni formato de respaldo. Revertir el commit revierte el change completo.

## Open Questions

_(ninguna)_
