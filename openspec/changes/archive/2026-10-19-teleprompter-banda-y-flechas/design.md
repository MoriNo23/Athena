# Design

## Context

Ver `proposal.md` para el motivo. Estado actual que condiciona el enfoque:

- La cámara (`use-teleprompter-window.ts`, `scrollToChar`) sitúa el carácter activo en `clientHeight * 0.4`: el objetivo es `scrollTop + (pos del carácter − 0.4 · alto)`. Con la columna actual (`pt-24` = 96 px de reserva) el primer carácter de una página está a 96 px del borde: el objetivo es **negativo**, el navegador clampa a 0 y el animador (`animateScrollTopTo`) sigueAnimando hacia un destino inalcanzable → la columna oscila (vaivén) en vez de avanzar.
- El cruce de página (`slide()` en `use-teleprompter-player.ts`) publica la ventana nueva y el rebase en el mismo render; el anclaje de vista (`stageViewAnchor` + `useLayoutEffect` sobre `[win]`) conserva la posición visual del ancla. Con la banda inalcanzable, el ancla del cruce (primer carácter de la página nueva) queda en el margen superior en vez de en la línea de lectura.
- `→` ejecuta `forward()`: si el flujo suena, revela la página entera de golpe; si está en `pageDone`, encadena la página siguiente; si está en pausa, reanuda. `←` ejecuta `rewindOne()`: apaga un carácter (o carga la página anterior al llegar al inicio). La misma flecha significa cosas distintas según el estado.
- El player expone `lit`, `playing`, `pageDone`, `bookDone`, `forward` y `rewindOne`; el overlay reparte las teclas en su propio `keydown` (captura, con `stopPropagation`).

## Goals / Non-Goals

**Goals:**

- La banda de lectura (40 % del alto) es alcanzable en todo momento: inicio de página, cruce, avance y rebobinado. Sin posiciones inalcanzables → sin clamp, sin vaivén.
- El cruce de página (con Auto o por orden) deja la página nueva exactamente en la línea de lectura.
- Un gesto por tecla: letra con las flechas, página con las flechas modificadas.

**Non-Goals:**

- No cambian el motor de encendido, los presets de velocidad, el sonido, el Auto ni el rebobinado.
- No cambian las teclas del lector normal (`←/→` = página, `↑/↓` = desplazamiento).
- No se toca API, base de datos ni respaldo.

## Decisions

### D1. La banda se alcanza reservando espacio, no corrigiendo el objetivo

Alternativas descartadas:

- **Clampar el objetivo de la cámara al rango válido** (`max(0, …)`): elimina el rebote pero el texto se queda pegado al margen superior toda la página y el cruce corta la lectura de la banda al margen. El síntoma se tapa, la causa sigue.
- **Bajar la regla de la banda** (el carácter activo al 0 %): el texto se pegaría al borde superior, bajo la barra de la interfaz.
- **Reservar el 40 % del alto por encima del primer carácter** (elegido): el objetivo de la cámara pasa a ser una posición válida desde el primer carácter de cualquier página; el ancla del cruce (que ya mide la posición visual) cae en `320 − 320 = 0` → la página nueva arranca en la línea de lectura sin reacomodo.

La reserva vive en CSS (`.tp-scroll { padding-top: 40vh }`), la misma regla que aplica la cámara (40 % del alto del contenedor). La columna del teleprompter ocupa todo el alto del overlay, así que `40vh` y `0.4 · clientHeight` coinciden.

### D2. `→` y `←` mueven una letra; `Shift+→` / `Shift+←` cambian de página

- `→` → `stepForward()`: enciende **un** carácter (si cae dentro de un título, enciende el bloque entero, como ya hace el motor), pausa el flujo automático y lleva la vista al carácter nuevo.
- `←` → `rewindOne()`: sin cambios (ya apaga un carácter y cruza al inicio de la página).
- `Shift+→` → `goToNextPage()`: el cruce atómico de `slide(0)` — la página siguiente entra con su primer carácter sin encender en la banda.
- `Shift+←` → `goToPrevPage()`: la página anterior completa y encendida (el `loadPreviousPage` que ya usa el rebobinado).

Alternativas descartadas:

- **Mantener `→` = "revelar la página" y añadir `Shift+→` = otra cosa**: la colisión que se quiere eliminar.
- **Hacer que `→` cambie de página al llegar al final de la página**: la tecla vuelve a depender del estado (una letra dentro de la página, una página en el borde). Al final de la página `→` no hace nada y el gesto de página es `Shift+→` (además, el botón inferior ya rotula «Página siguiente»).
- **Avance por palabra**: el pedido es letra a letra.

El botón «Siguiente» y el click en el escenario conservan su papel (revelar/encadenar): son gestos amplios, no flechas.

### D3. El motor sigue el avance manual

`stepForward()` mueve `litRef` mientras el motor lleva su propio contador. El motor re-sincroniza su índice con `litRef` en cada paso, de modo que un avance manual no se pierde ni deja el contador atrás. Sin esto, el motor podría volver a iluminar por detrás del avance manual.

## Risks / Trade-offs

- [La reserva del 40 % deja hueco visible al inicio de cada página] → es el aspecto de un teleprompter: la primera línea entra en la línea de lectura y el texto sube desde ahí. El texto ya está en la banda al abrir el modo.
- [Páginas muy cortas no tienen contenido suficiente bajo la banda] → el texto baja poco hacia el final; el cruce a la página siguiente recoloca la banda.
- [La sonda necesita un libro con texto denso] → las sondas de cámara usan un PDF de prueba generado al vuelo (`scripts/tp-fixture.js`), no el primer libro de la biblioteca: el resultado deja de depender de los libros del usuario.
- [`→` deja de ser «continuar»] → el recordatorio de teclas, la pista inferior y el `aria-label` de los botones se actualizan en los tres idiomas.

## Migration Plan

Sin migración: no hay cambios de API, base de datos ni formato de respaldo. Revertir el commit revierte el change completo.

## Open Questions

_(ninguna)_
