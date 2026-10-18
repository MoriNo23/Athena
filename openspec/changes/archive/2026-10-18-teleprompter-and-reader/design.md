# Design

## Context

Ver `proposal.md`. Estado actual relevante:

- El modo cine vive en `src/components/reader/CinematicOverlay.tsx` con el motor puro de timing en `src/lib/vn.ts` (espejado en `scripts/test-vn-engine.ts` y `scripts/audit_vn_timing.py`). Modelo actual: texto → tarjetas (`vnCardsFromPageText`) → spans por carácter encendidos imperativamente con `.on`.
- El EPUB ya pagina en páginas virtuales de bloques con tipo (`src/lib/epub.ts`: `EpubBlock`, `paginateEpub`, `epubPageText`) y `EpubViewport` las renderiza. El PDF se dibuja como página imagen en `PdfViewport` (canvas pdf.js + filtros CSS); el texto solo se extrae por página para el modo cine y el diccionario (`extractVnPageText`).
- La superficie de lectura usa `--stage` (papel cálido, `globals.css`) y el EPUB se encierra en `.epub-frame` (860px) + `.epub-page` (36em centrada). Los filtros de comodidad (`filters`) invierten la página con `filterCss` (preset `noche`), lo que en tema oscuro produce doble inversión al competir con los tokens del tema.
- Temas: `next-themes` con clase `dark` (default oscuro, «noche egea»), claro «mañana de mármol». Settings persistidos en el store `riel-settings-v1` versión 10.
- No hay `PRODUCT.md`/`DESIGN.md`: el sistema visual vigente es el código (autoridad para refinamiento). Auditoría previa: `docs/auditoria-impeccable.md`.

## Goals / Non-Goals

**Goals:**

- Teleprompter continuo (sin tarjetas) con retroceso real (rebobinar letra a letra y releer por scroll) y títulos con pausa.
- Superficie de lectura que sigue el tema en ambos formatos, a todo el ancho, con fuente y tamaño de lectura configurables.
- Modo texto para PDFs digitales reutilizando el pipeline de bloques/paginación del EPUB y conservando el significado de páginas reales (riel, hitos, racha, ETA).
- Renombre total a «teleprompter» y auditoría impeccable antes/después.

**Non-Goals:**

- OCR masivo de PDFs escaneados (siguen en modo página; el OCR actual no se toca).
- Reflow fiel de figuras, tablas o doble columna (se pierden/desordenan; límite declarado).
- Persistir el índice de texto del PDF fuera de la sesión (se evalúa después; ver Open Questions).
- Tocar datos de la biblioteca o el esquema de Prisma (no hay cambios de DB).

## Decisions

### D1 — Un solo modelo de «página de texto» para EPUB y PDF

Se conserva `EpubPage`/`EpubBlock` como modelo común. El PDF digital produce bloques equivalentes (`kind`, `text`, `words`) mediante un pipeline nuevo, y ambos alimentan el mismo visor reflowable y el mismo `getPageText`.

- **Por qué**: evita un segundo visor con su propia tipografía y hace que fuente, tema, full-width y teleprompter funcionen igual en ambos formatos.
- **Alternativas descartadas**: (a) dejar el PDF solo como imagen y limitar fuente/tema al teleprompter — no resuelve la queja del lector; (b) librería externa de reflow de PDF — dependencia pesada y sin control de calidad de extracción.

### D2 — Extracción de PDF: bloques con heurística de títulos + doble índice de páginas

Módulo puro nuevo (`src/lib/pdf-text.ts`):

1. Por página: ítems de `getTextContent` → líneas (por Y) → párrafos (por salto vertical), reutilizando la lógica que hoy vive en `extractVnPageText` (se mueve a función pura compartida).
2. Heurística de título (conservadora): 1–2 líneas, ≤ ~40 caracteres o ≤ ~6 palabras, sin puntuación final (`. , ; : ! ? …`), inicio mayúscula/dígito, y opcionalmente altura de fuente > mediana o nombre de fuente en negrita. Salida: `kind` `h2`/`h3`; el resto `p`.
3. Paginación en páginas virtuales de ~320 palabras reutilizando las reglas de `paginateEpub` (títulos estrenan página, bloque entero nunca se parte, cola corta se funde).
4. Doble índice: `pageStart[v]` = página real de origen de la página virtual `v`; `realToVirtual[r]` = primera página virtual con origen ≥ `r`. Todo el aparato de progreso sigue leyendo/escribiendo páginas reales.

- **Por qué**: una sola función pura es auditable con bun (patrón ya usado por el motor EPUB) y la heurística es ajustable en un único sitio.
- **Alternativas descartadas**: detección de layout con ML (sobredimensionado); heurística agresiva (más falsos positivos, peor lectura).

### D3 — Preparación no bloqueante del modo texto

La extracción corre página a página en segundo plano; la lectura arranca con lo listo y el visor muestra progreso. El índice vive en memoria por sesión (un libro de ~600 páginas ronda 1–2 MB de texto). Al saltar por el riel antes de que el índice llegue a esa página, la preparación prioriza la página destino y el visor espera con indicador.

- **Por qué**: bloquear la primera entrada 10–30 s sería peor que leer mientras se prepara; la memoria por sesión evita tocar DB o disco.
- **Alternativas descartadas**: persistir el índice en Prisma o IndexedDB ya — complejidad de invalidación sin necesidad demostrada (queda como Open Question).

### D4 — Teleprompter continuo: stream con scroll real

Reescritura del overlay (ahora `TeleprompterOverlay.tsx`):

- **Flujo**: una columna única de bloques (títulos y párrafos) dentro de un contenedor con scroll real. El encendido sigue siendo imperativo (clase `.on` por carácter, como hoy: nada de re-render por letra). Ventana de DOM acotada: página anterior + página actual (la anterior queda para rebobinar; al encadenar se suelta la más vieja).
- **Seguimiento**: en cada carácter encendido se ajusta `scrollTop` para mantener el carácter activo a ~40 % de la altura del visor, con el ajuste limitado a un frame de animación (rAF) para no pelear con el layout.
- **Títulos**: bloque completo, fundido de caja (opacidad), tipografía display, y pausa fija escalada por velocidad antes de retomar el cuerpo. No consumen encendido letra a letra.
- **Rebobinar**: puntero global de carácter sobre el stream; `←` apaga un carácter por pulsación (con auto-repetición) y mueve la vista. Al cruzar el inicio: carga la página anterior con todo encendido y el puntero al final; seguir rebobinando la apaga.
- **Releer**: rueda/`↑` dan scroll libre y pausan el avance automático (si no, la posición viva escaparía); `→`/botón/click reanudan desde el puntero actual. No se apaga nada.
- **Fin de página**: con Auto se encadena la siguiente sin corte; sin Auto se detiene con la acción «Página siguiente» (y «Fin del libro» al final).
- **Sin marca asimétrica**: se elimina la lógica y el estilo del resaltado de primera palabra (`vn-lead`).
- **Movimiento reducido**: todo encendido, sin animación de scroll (saltos instantáneos), rebobinado por bloques.

- **Alternativas descartadas**: mantener tarjetas con crossfade (rechazado por el usuario); columna con `transform: translateY` (más suave en teoría, pero rompe scroll libre y complica el rebobinado; el scroll real regala rueda, relectura y accesibilidad de teclado).

### D5 — Superficie de lectura: tokens de tema, ancho completo y fuentes

- Se jubila `--stage` como papel cálido del lector y entran tokens de lectura por tema (`--reader-bg`, `--reader-ink`, `--reader-title`, `--reader-rule`): oscuro = azul egeo elevado sobre el fondo de la app; claro = mármol de la mañana. Contrastes verificados (≥ 4.5:1 cuerpo, ≥ 3:1 títulos).
- **Ancho completo**: se elimina `.epub-frame` (860px) y la medida de 36em; el texto vive en un bloque con padding `clamp(1.25rem, 3vw, 3.5rem)` horizontal y respiración vertical. `ReaderStage` usa `--reader-bg` en vez de `--stage`.
- **Fuentes de lectura** (next/font, autocontenidas): **Literata** predeterminada, **EB Garamond** y **Atkinson Hyperlegible** alternativas. La UI conserva Fraunces. La elección va al store (`reader.font`) y se aplica por variable CSS `--reader-font` al texto reflowable y al teleprompter.
- **Filtros de comodidad**: nuevo preset `auto` (predeterminado) = tono ligado al tema. Cambios de semántica:
  - PDF: `auto` en tema oscuro aplica el filtro nocturno afinado (invert + hue-rotate + brillo/contraste); en tema claro, página limpia. Los presets manuales (Papel/Sepia/Cálido/Noche) siguen siendo override explícito.
  - EPUB: nunca se invierte (su noche la dan los tokens); sepia/brillo/cálido actúan como tinte suave. Adiós a la doble inversión preset+`dark`.
- **Teleprompter**: mismo criterio (`--tp-bg` = `--reader-bg`, texto `--reader-ink`).

### D6 — Renombre total y migración de settings

Mapa de nombres: `CinematicOverlay → TeleprompterOverlay`; `lib/vn.ts → lib/teleprompter.ts` (`buildVnTimeline → buildTeleprompterTimeline`, `vnCardsFromPageText` desaparece con las tarjetas, `vnPresetById → teleprompterPresetById`, `clampVnFontScale → clampTeleprompterFontScale`, `VN_* → TELEPROMPTER_*`); `VnSettings → TeleprompterSettings`; store `vn → teleprompter` y `setVn → setTeleprompter`; CSS `.vn-* → .tp-*`, `--vn-bg → --tp-bg`, fuera `--vn-lead`; i18n `cin.* → tp.*` (es/en/pt con textos nuevos); `data-testid vn-* → tp-*`; scripts espejo renombrados (`test-teleprompter-engine.ts`, `audit_teleprompter_timing.py`). Se borran `VisualNovelOverlay.tsx` (sin uso) y `docs/screenshots/visual-novel-*.png`.

Migración del store (versión 10 → 11): `teleprompter = { ...defaults, ...persisted.vn }` (se conservan velocidad, sonido, auto y tamaño); `reader.font = default`; `filters.preset = "auto"` salvo que el guardado sea `custom` (el objetivo del change es que el libro siga al tema; los presets siguen elegibles).

- **Alternativas descartadas**: mantener claves `vn` internas «por compatibilidad» — contradice el pedido de eliminar toda referencia y perpetúa la ambigüedad.

### D7 — Modo texto en la interfaz y el estado

- Toggle segmentado **Página | Texto** en la cabecera del lector, visible solo si el PDF tiene capa de texto (chequeo barato de las primeras páginas). El modo elegido se guarda por libro en `extras` y se restaura al reabrir.
- Navegación: el riel, los saltos y los atajos siguen trabajando en páginas reales; al asentarse en una página virtual se actualiza `pageNum` con su `pageStart` (modo silencioso, como los saltos actuales).
- El teleprompter, estando en modo texto, consume `getPageText` de las páginas virtuales del PDF (mismo contrato que EPUB).
- Página sin texto extraíble: se muestra aviso «página sin texto» y el flujo continúa (la página real se mantiene en el riel).

### D8 — Auditoría impeccable antes/después

Baseline y cierre con el detector mecánico (`/home/fullmetal/.agents/skills/impeccable/scripts/impeccable detect --json <targets>`) sobre los componentes del lector, más capturas 1280×800 y 390×844 en claro y oscuro (libros de prueba sembrados). El informe se anexa a `docs/auditoria-impeccable.md` con fecha nueva. Sin `PRODUCT.md`: se trata como refinamiento con el código como autoridad y se ofrece `impeccable init` al final, sin bloquear.

## Risks / Trade-offs

- **Heurística de títulos (falsos positivos)** → umbrales conservadores en una única función pura, ajustable sin tocar UI; aceptado explícitamente por el usuario.
- **Líneas muy largas a ancho completo** → el brief del usuario manda; A−/A+ controla el tamaño y el padding evita bordes duros. Si en capturas resulta incómodo, se reevalúa con la auditoría (sin cambiar el diseño base).
- **Rendimiento del teleprompter (miles de spans + scroll sincronizado)** → encendido imperativo como hoy, scroll limitado por rAF, DOM acotado a dos páginas; si apareciera jank, ventana de spans (± N caracteres) sin cambiar el diseño.
- **Extracción de PDF lenta en tomos grandes** → preparación en segundo plano con progreso y prioridad a la página destino; caché por sesión; persistencia diferida (Open Questions).
- **Tablas/doble columna desordenadas y figuras perdidas** → límite declarado; el modo texto es opt-in por libro y el modo página siempre está a un toggle.
- **Migración de settings** → función `migrate` explícita con tests; rollback = revertir versión del store (los datos viejos `vn` se conservan hasta la primera escritura).

## Migration Plan

1. Renombre mecánico + migración de store (v11) en un solo paso; los ajustes guardados del modo se conservan.
2. Superficie/tema y fuentes: tokens nuevos con valores de contraste verificados; sin cambios de datos.
3. Modo texto PDF: sin cambios de esquema Prisma; `extras.readerMode` es campo nuevo opcional (JSON existente).
4. Rollback: revertir el commit del store y limpiar la clave `teleprompter` del localStorage si hiciera falta; el resto es UI.

## Open Questions

- ¿Persistir el índice de texto del PDF (IndexedDB) para evitar re-extraer por sesión? Se decide tras medir el costo real con tomos grandes; no altera specs ni tareas.
- ¿Cuarta fuente de lectura curada? Se evalúa con la auditoría visual final.
