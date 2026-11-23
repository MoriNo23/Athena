# Proposal

## Why

Los títulos del teleprompter se encienden como un bloque con un fundido de 900 ms, pero el motor avanza al siguiente paso en ~42 ms a 4 pal/s: la animación se corta antes de terminar y el lector percibe que el encabezado se salta. Dos títulos consecutivos comparten además un único respiro, así que el segundo aparece sin pausa propia.

## What Changes

- **A · Respiro acoplado al tempo con piso en ms**: cada título espera `max(unidades · msPorUnidad(wps), pisoMs)` antes de continuar, y la duración del fundido se expone al CSS mediante una variable que el player actualiza al cambiar la velocidad. El slider nunca puede borrar el fundido.
- **B · Coreografía de dos tiempos**: (1) el título aparece atenuado y sube 0,3 em durante ~300 ms; (2) se enciende del todo con el fundido completo y guarda ~400 ms de silencio antes del cuerpo. Cada título tiene su propio compás, incluso cuando viene otro detrás; no se suman pausas, gana la mayor.
- **Interruptor de estilo**: ajuste nuevo en el teleprompter, `Títulos: Coreografiados | Como texto normal` (por defecto, coreografiados). En modo *Como texto normal* el título usa exactamente la misma cadencia y la misma animación por carácter que el cuerpo: sin piso en ms, sin dos tiempos y sin respiro extra.
- **Movimiento reducido**: se conserva el tiempo de lectura del título pero se suprime el desplazamiento; el ajuste sigue siendo respetado.
- **Cámara**: el encabezado se centra en la zona cómoda de lectura en vez de anclarse sólo por su primera línea, para que un título de dos líneas no quede partido por el borde.
- Sin cambios en la base de datos, en el contrato `{ ok, data?, error? }` ni en el motor offline.

## Capabilities

### New Capabilities

- `teleprompter`: cadencia, pausas y movimiento de los bloques de encabezado, incluido el estilo elegido por el lector.

### Modified Capabilities

Ninguna: el proyecto aún no tiene specs archivadas; este delta convive con el de `honest-reading-teleprompter` hasta su archivado.

## Impact

- `src/core/teleprompter.ts` (timeline de títulos y pausa entre encabezados consecutivos).
- `src/hooks/use-teleprompter-player.ts` (espera del título, sincronización de la variable CSS de duración, cámara).
- `src/components/reader/TeleprompterOverlay.tsx` y `src/components/reader/TeleprompterSettingsSheet.tsx` (interruptor de estilo).
- `src/core/types.ts` y `src/lib/settings.ts` (`TeleprompterSettings.headingStyle`, migración del valor por defecto).
- `src/styles/globals.css` (animación en dos tiempos, variable de duración, regla de movimiento reducido).
- `src/lib/i18n/{es,en,pt}.ts` (etiquetas del ajuste).
- Tests: `src/core/teleprompter.test.ts`, `src/hooks/use-teleprompter-player.test.tsx` (nuevo) y `src/styles` vía test de empaquetado si aplica.
