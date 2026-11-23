# Design

## Context

Ver `proposal.md` para el porqué. Hoy el encabezado se enciende como un bloque con un fundido CSS de 900 ms, pero el motor avanza al siguiente paso en ~42 ms a 4 pal/s: la animación se corta. El timeline da 12 unidades de respiro al primer título de una secuencia y 0 a los siguientes, de modo que dos encabezados consecutivos se funden en un solo destello. La cámara ancla `heading.start`, no el centro del bloque.

El motor trabaja en unidades de tempo; el movimiento CSS, en milisegundos de reloj. Esa dualidad es la causa raíz.

## Goals / Non-Goals

**Goals:**

- Que el fundido del título termine siempre, a cualquier velocidad.
- Que cada título tenga un compás propio, incluso seguido de otro.
- Ofrecer un modo explícito para quien quiere el título exactamente igual que el texto.
- Respetar `prefers-reduced-motion` sin quitar el tiempo de lectura.
- Mantener la regla de la casa: apagar es instantáneo, la animación vive sólo en `.on`.

**Non-Goals:**

- Cambiar la puntuación, el conteo de páginas ni la sinopsis.
- Cambiar el esquema de la base de datos ni el contrato de la API.
- Añadir librerías de animación.
- Rehacer el overlay completo.

## Decisions

### D1 · Espera con piso en ms y variable CSS compartida

`src/core/teleprompter.ts` calcula para el paso siguiente del título `delay = Math.max(unidades · msPorUnidad(wps), TP_HEADING_FLOOR_MS)`. El player publica la duración del fundido en `--tp-heading-fade` sobre el contenedor del stream, y `globals.css` la consume en `animation-duration`. Así el motor y el CSS hablan la misma unidad.

Alternativa descartada: dejar la animación fija en 900 ms y esperar que el tempo la respete. Con wps alto el motor siempre llega antes y el problema vuelve.

### D2 · Coreografía de dos tiempos

Primer tiempo: el bloque entra desde `translateY(0.3em)` con opacidad 0,55 en ~300 ms. Segundo tiempo: se enciende a opacidad 1 con el fundido completo (~900 ms) y un silencio de ~400 ms antes del cuerpo. La animación se declara sólo en `.tp-block-h.on`, nunca en el estado base, para que el rebobinado siga siendo instantáneo.

Alternativa descartada: una sola animación larga. Sin el primer tiempo, el cambio de escena no se anuncia; con dos tiempos el ojo recibe «preparación» y «asentamiento».

### D3 · Títulos consecutivos: compás propio, pausa no acumulativa

Se elimina la supresión que hoy aplica `prevHeading` al segundo título. Cada encabezado recibe su piso en ms. Cuando dos títulos se suceden, la espera es `max` de los dos compases, nunca su suma, y el segundo no arranca su animación hasta que el primero haya terminado.

Alternativa descartada: dar el respiro completo a cada uno sumándolos. Encadenar tres encabezados pararía la lectura demasiado tiempo.

### D4 · Ajuste `headingStyle`

`TeleprompterSettings.headingStyle: "coreografiados" | "texto"` con valor por defecto `coreografiados`. La migración del store (`src/lib/settings.ts`) rellena el campo cuando falta; no hay esquema de BD nuevo. En modo `texto` el título se trata como un bloque de cuerpo: mismas unidades por carácter, misma transición `.tp-ch.on` de 130 ms, sin piso, sin dos tiempos y sin respiro extra.

Alternativa descartada: un interruptor boolean suelto en localStorage. Rompería el patrón de ajustes del repo y no migraría con el resto.

### D5 · Movimiento reducido

Con `prefers-reduced-motion` se mantiene el piso de lectura de D1 pero se anulan `translateY` y el fundido. En modo `texto` ya no hay movimiento especial que desactivar.

### D6 · Cámara centrada

`scrollToChar` recibe el índice central del bloque (`start + floor(length/2)`) en vez de `start`. El anclaje de la poda no cambia: sigue apoyándose en el primer carácter retenido.

## Risks / Trade-offs

- **El piso en ms hace que el título se lea más despacio que el cuerpo** → es intencionado; el modo `texto` es la salida para quien no lo quiera.
- **Dos títulos seguidos pueden sentirse solemnces** → se limita con `max`, no con suma, y se observa en el humo del APK.
- **La variable CSS se actualiza al cambiar wps en marcha** → si la animación ya está corriendo, la nueva duración aplica al título siguiente, no al actual; se documenta en el comentario del timeline.
- **Mover la cámara al centro puede desplazar el texto leído hacia arriba** → se reutiliza la compensación de ancla existente y se verifica con la poda frontal.
- **Lucide/TS no intervienen** → cero dependencias nuevas.

## Migration Plan

- Un solo PR con subida de parche (la casa publica release en cada push a `main`).
- Sin migración de datos: `headingStyle` se rellena con el valor por defecto en la migración del store de ajustes.
- Rollback: revertir el PR; los ajustes antiguos siguen leyéndose porque el campo ausente cae al default.
- Verificación: tests del timeline, test del store, `tsc`, `lint`, `bun test`, `bun run build` y humo en APK con dos títulos consecutivos y con el modo `texto`.

## Open Questions

Ninguna que cambie el enfoque. La duración exacta de los tres tiempos (300/900/400 ms) se ajusta en el PR con una prueba visual en el emulador, sin tocar las specs.
