# Proposal

## Why

Petición de la dueña (24-10): **que sea más cómodo al ver un encabezado al
leer y al transicionar a la página siguiente**. Hoy la lectura tiene dos
rozaduras concretas:

1. **Las transiciones son a golpe seco**: los tres visores (PDF imagen, PDF
   texto, EPUB) repintan la página sin ninguna transición; cuando la página
   tarda en renderizar aparece el spinner y la anterior desaparece — el lector
   pierde el hilo un instante.
2. **Los encabezados se ven incómodos**: en EPUB ya tienen estilo (tamaño,
   color,.filete), pero nada evita que un título quede **huérfano** al final de
   una página (solo, con su texto en la siguiente), ni que un capítulo arranque
   sin aire, igual que cualquier párrafo.

## What Changes

- **Transición suave al girar la página**: fundido corto (~150–200 ms) de la
  página nueva sobre la anterior; la página anterior **permanece visible**
  hasta que la nueva está lista (adiós al parpadeo de spinner en el giro
  normal). En EPUB/modo texto, el texto también entra con fundido.
- **Encabezados cómodos**:
  - **anti-huérfano**: un encabezado no se queda solo al final de una página —
    baja a la siguiente con su primer párrafo (regla en la paginación del
    EPUB).
  - **arranque de capítulo con aire**: los capítulos (h1) respiran más y
    arrancan distinguidos del flujo normal; opción de empezar capítulo en
    página limpia.
- **PDF (imagen real, no se re-estila nada)**: la portada del libro no se
  toca — la comodidad viene por la transición suave y por un **aviso discreto
  de cambio de capítulo** cuando el libro trae esquema, para que el lector
  sepa que empieza sección nueva.
- **Respeto al leer**: ni la posición de lectura ni el foco saltan tras la
  transición; `prefers-reduced-motion` apaga el movimiento (accesibilidad).

## Lo que YA existe (no se repite trabajo)

- Encabezados EPUB con estilo dedicado (`.epub-h*` en globals.css: tamaño,
  color, márgenes, filete bajo h1).
- `PagePeek` (ojeada de páginas) y esquema del PDF navegable.
- Paginación virtual del EPUB (`paginateEpub`) ya calcula páginas por palabras.

## Open questions (se cierran antes del apply)

1. ¿Movimiento: **fundido**, deslizamiento (pasar hoja) o ambos a elegir?
2. ¿Capítulo nuevo en **página limpia** siempre, o solo con aire extra?
3. Para PDF: ¿con fundido + aviso de capítulo basta, o quiere además salto a
   capítulo desde el riel/índice?
4. ¿Duración fija (~180 ms) o ajuste en el panel de lectura?

## Impact

- Ámbito: `src/components/reader/PdfViewport.tsx`, `EpubViewport.tsx`,
  `PdfTextView.tsx` (fundido + conservar página previa),
  `src/lib/epub.ts` (anti-huérfano de encabezados en la paginación — mueve
  el número de páginas virtuales de algunos EPUB),
  `src/app/globals.css` (aire de capítulo), aviso de capítulo del outline.
- Sin dependencias nuevas: CSS puro; respeta `prefers-reduced-motion`.
- Fuera de alcance v1: animaciones de "pasar hoja" 3D, re-estilar encabezados
  dentro de PDFs de imagen (imposible sin tocar el fichero), voz/TTS.
