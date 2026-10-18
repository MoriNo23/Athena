# Proposal

## Why

Quien lee de verdad no lee citas: el modo cine parte la página en tarjetas ("tarjeta 1 de 9") que se sienten como citas, no deja retroceder si el ritmo se pasa de largo y releer exige salir del modo. Además la página del lector se ve genérica —una hoja pegada encima de la app— y no acompaña al tema claro/oscuro; los PDF quedan condenados a la imagen fija, sin tipografía de la casa. En una app de lectura el texto debe mandar, en los dos formatos y en los dos temas.

## What Changes

- **Renombre total**: `cinematic` / «novela visual» / `vn` → **teleprompter** en código, CSS, i18n, docs y scripts. Se borran el overlay viejo sin uso (`VisualNovelOverlay.tsx`) y sus capturas. **BREAKING (interno)**: la clave `vn` del store persistido migra a `teleprompter` con migración automática de settings.
- **Teleprompter continuo**: sin tarjetas; una columna que sube sola mientras las letras se encienden a ritmo; lo leído sube y se desvanece; fuera la marca asimétrica de primera palabra. Auto encadena páginas sin corte; sin Auto, frena al final de la página y espera.
- **Retroceso**: `←` rebobina el encendido letra a letra; rueda/`↑` releen desplazando sin apagar; al cruzar el inicio de la página se carga la anterior ya encendida.
- **Títulos**: se detectan y aparecen completos con fundido y pausa antes de seguir (EPUB: títulos reales del libro; PDF: heurística conservadora, se aceptan falsos positivos ocasionales).
- **Superficie de lectura temática**: el libro —texto EPUB y página de PDF— sigue el tema claro/oscuro de la app; se acaba la «hoja blanca pegada». Texto a todo el ancho con padding real (fuera la jaula 860px/36em), fuente de lectura configurable (recomendada: Literata; alternativas: EB Garamond y Atkinson Hyperlegible) y tamaño ajustable. Colores de lectura fijados con contraste AA+ en ambos temas. En tema oscuro la página del PDF recibe render nocturno por defecto; los presets Papel/Sepia/Cálido/Noche quedan como override manual y se corrige la doble inversión actual (preset Noche + tema oscuro).
- **Modo texto para PDF digital**: se extrae el texto del PDF y se pagina en páginas virtuales (~320 palabras) renderizadas por el mismo visor textual que el EPUB (fuente, tema, full-width y teleprompter incluidos), con toggle Página/Texto y correspondencia con las páginas reales para que riel, hitos, racha y ETA no cambien de significado. Los PDF escaneados quedan en modo página (su OCR actual no se toca).
- **Auditoría impeccable** de las superficies del lector: detector mecánico (`impeccable detect`) + revisión visual 1280×800 y 390×844, antes y después, con informe en `docs/`.

## Capabilities

### New Capabilities

- `teleprompter`: lectura a ritmo continuo — flujo sin tarjetas, encendido letra a letra, retroceso (rebobinar y releer), títulos con pausa, controles y encadenado de páginas.
- `reader-surface`: render de la superficie de lectura — tema claro/oscuro, ancho completo con padding, fuente y tamaño de lectura, tono de la página PDF.
- `pdf-text-mode`: lectura reflow de PDFs digitales — extracción a páginas virtuales, toggle Página/Texto, correspondencia con páginas reales y límites declarados.

### Modified Capabilities

(Vacío: el proyecto aún no tiene specs; ninguna capacidad existente cambia de requisitos.)

## Impact

- Lector: `src/components/reader/` (CinematicOverlay → TeleprompterOverlay; EpubViewport, PdfViewport, ReaderView, ReaderStage, ReaderHeader), `src/lib/vn.ts` → motor teleprompter, `src/lib/epub.ts` (paginación y bloques reutilizados para PDF texto), pipeline nuevo de extracción + paginación de PDF, `src/lib/settings.ts` (migración de store, clave de fuente de lectura), `src/app/globals.css` (tokens de lectura, `.vn-*` → `.tp-*`, medias de ancho), i18n es/en/pt (`cin.*` → `tp.*`, textos de los dos modos), scripts espejo de tests (`test-vn-*`, `audit_vn_timing.py`), docs (README, LEEME) y capturas.
- Usuarios: el modo sigue existiendo renombrado; los ajustes guardados (velocidad, sonido, auto, tamaño de letra) se conservan vía migración. PDF escaneados no cambian; los digitales ganan el modo texto.
- Límites declarados: la extracción de PDF pierde figuras y puede desordenar tablas o doble columna.
