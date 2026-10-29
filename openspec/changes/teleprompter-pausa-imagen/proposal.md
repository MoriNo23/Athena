# Proposal: teleprompter-pausa-imagen

## Why

El teleprompter solo ve texto: `TeleprompterBlock` es `{ kind, text }`, los extractores
devuelven solo texto y `buildTeleprompterStream()` solo emite pasos de carácter. Cuando un
libro anuncia una figura («ver la figura 3»), el flujo la ignora y sigue. La dueña necesita
que el modo se detenga unos segundos para mostrar esa imagen por un tiempo recomendable, con
la imagen visible en el flujo y sin perder los gestos ya aprendidos (espacio, flechas,
rebobinado, Auto).

## What Changes

- Nuevo tipo `TeleprompterImageBlock { kind: 'image', src, alt, natW, natH }` y pasos de
  imagen en el timeline: `TeleprompterStep` gana `image?: { src, alt }` y su `delay` es el
  `holdMs` de exposición.
- Extracción PDF vía `page.getOperatorList()` (operaciones de pintado de imagen + matriz de
  transformación), heurística de relevancia conservadora (≥ 12 % del área de página, no en
  bordes extremos), rasterizado a canvas con lado máximo 1024 px, caché por (doc, page, índice).
  EPUB: `<img>` del spine resuelto a blob URL con JSZip, sin heurística.
- Orden vertical real: los bloques se ordenan por coordenada Y, de modo que la imagen entra
  al flujo después del párrafo que la anuncia.
- Render: `<figure class='tp-image-block'>` completo en columna (sin letra a letra), borde de
  tinta, máx. 46 % del escenario, `object-fit: contain`, barra de progreso del hold en el
  borde inferior.
- Interacción: Espacio congela el hold (pausa global), `→` salta el hold, `←` re-entra la
  imagen y reinicia el hold; Auto no cruza de página con un hold pendiente. Sin tick de
  sonido en pasos de imagen; la imagen no cuenta como página leída.
- Ajustes nuevos en `db/config.json` (bloque `teleprompter`): `imagenesPausa` (bool, true),
  `imagenHoldMs` (2–30 s, default 5), `imagenAutoHold` (bool, true: ajusta por tamaño
  renderizado, clamp [3, 8] s).

## Impact

- Affected specs: `teleprompter` (añade «Pausa de imagen con exposición recomendada»;
  modifica «Encendido letra a letra con ritmo», «Rebobinar el encendido», «Encadenado de páginas»).
- Affected code: `src/lib/teleprompter.ts`, `src/lib/pdf-images.ts` (nuevo),
  `src/hooks/use-teleprompter-window.ts`, `src/hooks/use-teleprompter-player.ts`,
  `src/components/reader/TeleprompterOverlay.tsx`, `src/lib/types.ts` (settings + clamps),
  `src/lib/i18n/{es,en,pt}.ts`.
- Riesgos: ver SDD capítulo 8 (extracción perezosa, límite de caché 6 imágenes, escaneados
  sin texto sin cambio de comportamiento).
