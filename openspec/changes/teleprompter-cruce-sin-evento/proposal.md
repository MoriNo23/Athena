# Proposal: teleprompter-cruce-sin-evento

## Why

La dueña probó `teleprompter-solo-continuo` y reportó el residuo: el cruce
atómico (`slide`) sustituía la ventana `{A, B} → {B, C}` y con el ancla
compensaba el scroll — sin fundido ni aviso, pero el texto ya leído de la
página anterior DESAPARECÍA de la columna en el frame del cruce. Historia de
usuario textual: «cuando completo una página leída y empieza la primera letra
[de la nueva], desaparece lo anterior — si iba leyendo un poco lento no puedo
leer». El criterio correcto es el que ella enuncia: **el scroll es quien debe
ocultar el texto**, no el seguimiento de lectura. Y el fundido nunca fue la
solución: solo maquillaba el intercambio.

## What Changes

- **Columna viva**: la ventana deja de ser un par fijo `{actual, siguiente}`.
  El cruce de página virtual deja de tocar el DOM: la página nueva se AÑADE
  AL FINAL de la columna (por debajo de la vista — nada de lo visible se
  mueve) y el texto ya leído permanece encima; es el scroll, a ritmo de
  lectura, el que lo saca del encuadre.
- **Poda frontal imperceptible**: cuando el pie de una página leída lleva
  fuera del encuadre un margen de respeto (30 % del alto visible), se poda
  del DOM con el ancla de vista compensando el scroll antes del pintado —
  ni un píxel salta. La memoria queda acotada (página en curso + siguiente
  precargada + lo aún visible de lo leído).
- `slide()` y `allowCross` se jubilan: el cruce es SOLO progreso
  (`onGoToPage`) + prefetch. Sin Auto el flujo sigue deteniéndose al final de
  cada página (pageDone); con Auto continúa a ritmo normal. La espera del
  revelado instantáneo con Auto (2 s) se conserva.
- `Shift+→` ya no intercambia la ventana: enciende el resto de la página en
  curso (ya está en la columna), anuncia la siguiente y deja que el flujo
  continúe — el texto saltado se va por el scroll. `Shift+←` conserva el
  prepend con ancla (cambio discreto e intencional).
- El progreso de página (barra y cabecera) pasa a derivarse de la página real
  que contiene el carácter activo (offsets acumulados por página), no del
  inicio de la ventana; el corte natural del aviso de descanso se detecta por
  `pageNum` (el cruce real), no por el inicio de la ventana.
- La ventana se reconstruye SOLO cuando el lector sale de ella (salto
  externo, cambio de fuente): mientras la página pedida viva dentro, la
  columna no se toca.

## Impact

- Affected specs: `teleprompter` (reescribe «Encadenado de páginas»: el texto
  leído permanece y el scroll lo oculta; la página nueva se añade debajo; la
  poda es imperceptible y solo fuera de encuadre).
- Affected code: `src/lib/teleprompter.ts` (helpers puros: offsets,
  página contenedora, fin de página, techo de poda), `src/hooks/
  use-teleprompter-window.ts` (ventana de longitud variable + `pageOffsets` +
  `pruneMeasure`), `src/hooks/use-teleprompter-player.ts` (sin `slide`;
  `appendNext`, `crossBoundaries`, `pruneFront`), `src/components/reader/
  TeleprompterOverlay.tsx` (render por páginas con claves estables, progreso
  por página real, corte de descanso por `pageNum`).
- Tests: `teleprompter` (offsets, página contenedora, fin de página, techo de
  poda con páginas mudas y protección de la última página).
- No hay cambio de ajustes ni de persistencia: es el mismo comportamiento
  continuo, sin el frame que borraba lo leído.
