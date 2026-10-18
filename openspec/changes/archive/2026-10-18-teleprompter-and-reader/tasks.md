# Tasks

## 1. Línea base de auditoría (antes)

- [x] 1.1 Sembrar biblioteca de prueba (PDF digital, PDF escaneado, EPUB) y arrancar la app; verificar los tres libros abren y se leen. Usar los generadores existentes (`scripts/make-seed-books.py`, `make_test_pdf.py`, `make_ocr_scan_pdf.py`).
- [x] 1.2 Correr el detector impeccable sobre los componentes del lector y capturar 1280×800 y 390×844 en claro y oscuro (lector EPUB, lector PDF, modo cine); guardar baseline en `docs/auditoria-impeccable.md` (sección nueva fechada con enlace a capturas). Verificación: JSON del detector y capturas presentes en `docs/`.

## 2. Renombre total y limpieza

- [x] 2.1 Mover `src/lib/vn.ts` → `src/lib/teleprompter.ts` con símbolos `TELEPROMPTER_*` y renombrar `VnSettings` → `TeleprompterSettings` en `types.ts`, actualizando todos los imports. Verificación: `bunx tsc --noEmit` sin errores y `rg "lib/vn|VnSettings|VN_" src` sin resultados.
- [x] 2.2 Renombrar UI: `CinematicOverlay` → `TeleprompterOverlay`, testids `vn-*` → `tp-*`, claves i18n `cin.*` → `tp.*` en es/en/pt con textos «Teleprompter» (el estado ya no menciona tarjetas). Verificación: `rg '"cin\.' src` sin resultados y smoke del botón que dice Teleprompter en los tres idiomas.
- [x] 2.3 Renombrar CSS: `.vn-*` → `.tp-*`, `--vn-bg` → `--tp-bg`; eliminar `--vn-lead` y la lógica del resaltado de primera palabra en el overlay. Verificación: `rg "vn-|vn-lead" src` sin resultados y captura del modo sin marca de inicio.
- [x] 2.4 Borrar `VisualNovelOverlay.tsx` y `docs/screenshots/visual-novel-*.png`; renombrar scripts espejo (`test-teleprompter-engine.ts`, `audit_teleprompter_timing.py`) y actualizar probes que usan testids viejos. Verificación: scripts corren verdes (`bun scripts/test-teleprompter-engine.ts`, `python3 scripts/audit_teleprompter_timing.py`) y `rg -i "cinematic|novela visual" README.md LEEME.md src scripts` sin resultados.
- [x] 2.5 Migración de store versión 11: `vn` → `teleprompter` (conserva velocidad, sonido, auto y tamaño), default de fuente de lectura y preset de filtros `auto` (salvo `custom`). Verificación: prueba con estado v10 sintético que conserva los ajustes migrados y captura manual en devtools tras recargar.

## 3. Superficie de lectura temática

- [x] 3.1 Tokens de lectura por tema (`--reader-bg`, `--reader-ink`, `--reader-title`, `--reader-rule`) con contraste AA+; `ReaderStage` y visores los consumen. Verificación: medición de contraste ≥ 4.5:1 cuerpo y ≥ 3:1 títulos en ambos temas (cálculo documentado) y capturas en claro/oscuro.
- [x] 3.2 Ancho completo: eliminar la jaula `.epub-frame` (860px) y la medida de 36em; padding `clamp()` intencional y revisión de inmersión/pantalla completa. Verificación: captura 1280×800 sin franjas laterales vacías y con padding real (y sin desborde horizontal a 390×844).
- [x] 3.3 Fuentes de lectura: `next/font` para Literata (predeterminada), EB Garamond y Atkinson Hyperlegible; ajuste `reader.font` persistido y selector en la cabecera del lector. Verificación: cambio de fuente en vivo sobre un EPUB y la elección persiste al recargar.
- [x] 3.4 Filtros de comodidad: preset `auto` ligado al tema (PDF: render nocturno afinado en oscuro, página limpia en claro; EPUB: sin inversión, solo tintes suaves), corrigiendo la doble inversión y actualizando la UI de presets. Verificación: matriz tema × preset en capturas — «Noche» en tema oscuro no reinvierte; «Papel» blanco solo si se elige a mano.

## 4. Modo texto PDF

- [x] 4.1 `src/lib/pdf-text.ts` puro: ítems → líneas → párrafos, heurística de títulos (corta, sin puntuación final, mayúscula inicial; altura/negrita como señal débil) y paginación ~320 palabras con reglas del EPUB + índices `pageStart`/`realToVirtual`. Verificación: tests bun con fixtures sintéticos que cubren «Aristóteles» y «El comienzo de la historia» como títulos y una frase terminada en punto como cuerpo.
- [x] 4.2 Preparación no bloqueante: hook de extracción en segundo plano con progreso, prioridad a la página destino del riel y caché por sesión, probado contra un PDF largo real (~670 páginas). Verificación: la lectura empieza antes de terminar la preparación y el tiempo total queda anotado en el informe.
- [x] 4.3 Toggle **Página | Texto** en cabecera (solo PDFs con capa de texto), persistencia por libro en `extras`, correspondencia con páginas reales para riel/hitos/racha/ETA y reapertura en el modo recordado. Verificación: e2e manual — alternar sin perder altura de lectura, saltar por el riel y reabrir el libro; el contador y los hitos siguen en páginas reales.
- [x] 4.4 Bordes: página sin texto extraíble muestra aviso y el flujo continúa; PDF escaneado no ofrece el toggle. Verificación: PDF escaneado de prueba solo en modo página, y un PDF con página vacía intercalada muestra el aviso sin romper el flujo.

## 5. Teleprompter continuo

- [x] 5.1 Motor puro del stream: bloques → timeline por carácter con pausas de puntuación, títulos con pausa propia, rebobinado inverso y cruce de página. Verificación: `scripts/test-teleprompter-engine.ts` verde con casos nuevos (orden inverso, pausa de título, fin de página) y espejo Python actualizado.
- [x] 5.2 UI continua: columna única con scroll real, seguimiento del carácter activo a ~40 % de altura, DOM acotado a dos páginas, controles renombrados (velocidad, sonido, auto, pantalla completa, A−/A+, salir). Verificación: lectura e2e de un EPUB largo sin jank perceptible y `scripts/test-vn-stress` actualizado pasa con una página completa.
- [x] 5.3 Retroceso: `←`/botón rebobina letra a letra y al cruzar el inicio carga la página anterior encendida; rueda/`↑` releen pausando el avance; reanudar por `→`/botón/click. Verificación: e2e manual de los tres caminos y test del motor para el cruce de página encendida.
- [x] 5.4 Títulos en el flujo: EPUB por bloques reales (h1-h4), PDF por heurística; aparición completa con fundido y pausa; sin marca de primera palabra. Verificación: un EPUB con encabezados y un PDF con «Aristóteles» muestran título completo con pausa antes del cuerpo.
- [x] 5.5 Encadenado: con Auto el flujo pasa de página sin corte; sin Auto frena con la acción de página siguiente y «Fin del libro» al final. Verificación: e2e manual con Auto encendido y apagado sobre un libro de varias páginas.
- [x] 5.6 Accesibilidad del modo: `prefers-reduced-motion` enciende todo sin animación, teclado completo (Tab despierta controles, Escape sale, flechas y Espacio operan), aria sin referencias a «tarjetas» e inmersión intacta. Verificación: checklist manual con teclado y lector de pantalla + detector impeccable sin hallazgos nuevos de a11y.

## 6. Integración del lector

- [x] 6.1 Teleprompter alimentado por páginas virtuales del PDF en modo texto y por páginas reales en modo página; EPUB conserva su contrato. Verificación: el mismo PDF entra al teleprompter desde ambos modos con contenido correcto.
- [x] 6.2 i18n completa de textos nuevos (es/en/pt) del modo texto, fuentes y presets. Verificación: recorrer modo texto + teleprompter en los tres idiomas sin claves crudas ni texto en otro idioma.
- [x] 6.3 Regresión general: hotkeys, diccionario, peek, inmersión, guardado de progreso y riel con las tres variantes (EPUB, PDF página, PDF texto). Verificación: corrida guiada de los scripts e2e existentes de hotkeys/diccionario y checklist manual de guardado.

## 7. Auditoría impeccable (después) y documentación

- [x] 7.1 Correr el detector sobre los componentes cambiados y repetir capturas 1280×800/390×844 en claro y oscuro; comparar contra el baseline y resolver hallazgos nuevos. Verificación: detector sin hallazgos nuevos (o justificados por escrito) y capturas comparables.
- [x] 7.2 Anexar el informe después a `docs/auditoria-impeccable.md` y actualizar docs vivos: README y LEEME (modo Teleprompter, modo texto, fuentes, tema) y capturas nuevas reemplazando `cinematic-*.png`. Verificación: `rg -i "cinematic|novela visual"` sin resultados en docs vivos y capturas enlazadas existentes.
- [x] 7.3 Limpieza final: `bun run lint`, `bunx tsc --noEmit` y tests de motores verdes; sin archivos huérfanos ni testids muertos. Verificación: comandos verdes y `git status` sin restos inesperados.

## Workflow follow-up

- Archivar el change cuando la revisión del proyecto lo apruebe (`openspec archive`).
- Ofrecer `impeccable init` (PRODUCT.md/DESIGN.md) como seguimiento; no bloquea este change.
