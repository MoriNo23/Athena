# Auditoría Impeccable — Atena

Fecha: 2026-10-17 · Motor: [impeccable](https://github.com/pbakaus/impeccable) v0.1.15 (59 reglas deterministas + revisión visual VLM) · Superficies auditadas: biblioteca (oscuro/claro, 1280×800 y 390×844), lector EPUB, lector PDF en página y en texto, teleprompter continuo.

## Puntuación de salud

| # | Dimensión | Antes | Después | Hallazgo clave |
|---|-----------|-------|---------|----------------|
| 1 | Accesibilidad | 3 | 4 | Teclado varado en inmersión (arreglado); textos de 11px; salto h2→h4 |
| 2 | Rendimiento | 3 | 3 | Sin hallazgos del detector; animaciones solo opacity/transform |
| 3 | Theming | 3 | 3.5 | Kicker por debajo de 4.5:1 en ambos temas (eliminado) |
| 4 | Responsive | 2 | 3 | Overflow horizontal móvil ×2 causas; cabecera del lector sin envolver; stats 4-col |
| 5 | Integridad de implementación | 3 | 3.5 | Kicker prohibido; portadas con borde fino+sombra difusa; medida ~93ch |
| **Total** | | **14/20** | **17/20** | Bien → borde de Excelente |

## Hallazgos por severidad (todos arreglados)

- **[P1] Teclado varado en inmersión** — `use-immersive-wake.ts`. Al ocultarse el chrome por inactividad, SOLO el mouse lo despertaba; los controles quedaban en `visibility:hidden` (fuera del tab). Un usuario de solo-teclado perdía el acceso a todos los controles. **Fix:** `Tab` despierta el chrome (las teclas de acción siguen silenciosas, como manda la regla de la casa).
- **[P2] Overflow horizontal móvil (390px)** — dos raíces: el busto de la capa 2 sangraba 12px a la derecha (`.atena-capa2` ahora `overflow: hidden`) y la cabecera del lector era una fila fija de `h-14` que desbordaba 163px (ahora `min-h-14 flex-wrap`). Verificado: scrollW 390 exacto.
- **[P2] Franja de hábitos apretada** — 4 tarjetas en 390px: «Libros terminados» desbordaba 58px. Ahora `grid-cols-2 sm:grid-cols-4` y la etiqueta envuelve.
- **[P2] Kicker sobre el h1** — «Casa de la sabiduría»: patrón prohibido + contraste 4.3:1 (oscuro) / 4.4:1 (claro) / 3.2:1 (móvil) + desbordaba 58px. Eliminado; las palabras viven ahora en el subtítulo. Un solo cambio mató cuatro hallazgos.
- **[P2] Salto de encabezado h2→h4** — los capítulos EPUB (123 bloques h3) renderizaban `<h4>`: el outline de lectores de pantalla saltaba un nivel. Remapeo: h3→`<h3>`.
- **[P2] Medida de lectura ~93 caracteres** — la página EPUB medía ~93ch (objetivo 65–75). Ahora `max-width: 36em` centrada: ~70ch a CUALQUIER tamaño de letra (viaja en em, así A−/A+ no la estira).
- **[P2] Texto informativo de 11px** — subtítulo de autor, «1%» del riel, línea de estado del modo novela, tagline del dock, hints de teclas: ahora 12px.
- **[P3] Portadas con borde fino + sombra difusa de 40px** — firma de UI generada que peleaba con el neobrutalismo de las tarjetas. Las portadas visten ahora tinta: borde 2px + sombra dura 3px 3px 0.
- **[P3] Franja lateral de la cita EPUB** — 3px de primario → 2px de tinta al 72% (filete editorial fino, alineado con la voz de la casa).
- **[P3] Hints al 70% de opacidad** — `text-muted-foreground/70` en los índices ≈ 3.8:1 → contraste pleno + 12px.

## Patrones y sistemas

- El detector marcó `content-hidden-at-rest` sobre snapshots del lector: **falso positivo verificado** — es el modo inmersión (característica), correctamente implementado con `visibility:hidden` + `pointer-events:none` (no deja controles fantasma enfocables).
- `overused-font: fraunces 93%`: **intencional** — la voz tipográfica de lectura de la casa. El brief gana sobre la regla de gusto del detector.

## Lo que funciona bien (mantener y replicar)

- Contraste del cuerpo y de la UI verificado por el detector en ambos temas (después de los fixes, cero hallazgos primarios y cero avisos).
- Aria-labels en español en TODOS los controles; el modo teleprompter es un `role=dialog` con barra de progreso; foco gestionado al abrir libro y tras Enter/Escape del input de página.
- `prefers-reduced-motion` enciende todas las letras y desactiva animaciones — la ruta alternativa correcta.
- Paginación del EPUB real del usuario (Sofía, 670 páginas): mediana 289 palabras/página, 0 páginas sobre el tope, 0 vacías, parse en 471ms.

## Verificación

- Motor impeccable: biblioteca desktop **exit 0** (0 hallazgos, 0 avisos), biblioteca móvil **exit 0**, estático sobre `src/` limpio.
- Regresión: motor EPUB 25/25 · e2e EPUB 28/28 (subida→ficha→riel→VN→diccionario→índice→peek→persistencia, 0 errores de página) · `tsc` 0 en `src` · `eslint` 0.
- Revisión visual (VLM): medida cómoda, jerarquía clara, portadas coherentes con el sistema brutalista.
- Estado del usuario restaurado byte a byte tras las pruebas (BD + uploads).

---

## Baseline «Teleprompter y lector» — 2026-10-17

Antes de arrancar el cambio `teleprompter-and-reader` (tempo/palabra encendida,
ancho de lectura, marcas de estructura, progreso real en el teleprompter, modo
texto de PDF). Método: app real en `localhost:3000` (dev), navegación por CDP
(`scripts/cdp-capture.mjs` sobre chromium headless), snapshot estático +
[impeccable](https://pbakaus.github.io/impeccable/) **v4.6.0** `detect`
(`scripts/snap-and-detect.sh`).

**Superficies** (3 vistas × 2 temas × 2 viewports = 12 capturas):

| Vista | Estado capturado |
|-------|------------------|
| Lector EPUB | «El mundo de Sofia», página 5 (texto) |
| Lector PDF | «Don Quijote (Selección Atena)», página 1 (canvas) |
| Teleprompter (versión en tarjetas) | Sofia p.5 en tarjetas, ~3,5 s de encendido (marca de primera palabra visible) |

Tema oscuro/claro vía `theme` de next-themes; viewports 1280×800 y 390×844.

**Capturas:** `docs/screenshots/baseline-{epub,pdf,cine}-{dark,light}-{1280x800,390x844}.png`
**JSON del detector:** `docs/auditoria/baseline/baseline-{...}.json` (mismo nombre)

**Hallazgos baseline (sin arreglar todavía):**

| Regla | Severidad | Dónde | Nota |
|-------|-----------|-------|------|
| `flat-type-hierarchy` | advisory | las 12 | Menos de 1.25× entre títulos y cuerpo dominantes |
| `body-text-viewport-edge` | warning | las 6 de 390×844 | Cuerpo pegado al borde sin contenedor con padding |
| `low-contrast` | warning | 4 en claro (EPUB/PDF) | Botón del header del lector no llega a AA en tema claro; el overlay en tarjetas tapa el header y no lo reporta |
| `buried-raster` | warning | 6 en claro | Decoración de la sala (`atena-capa2__fachada`, `__busto`) bajo un velo casi opaco: nunca llega a la pantalla en claro |
| `overused-font` | warning | 2 del teleprompter en tarjetas (oscuro) | Fuente de sistema con firma de plantilla (Inter/Geist y compañía) |

Los defectos concretos del cambio (ancho de medida ~93ch, marca `--vn-lead`,
progreso encendido/total, cifras quemadas de velocidad) se documentan y arreglan
en las tareas 3.x–6.x; este baseline es su «antes» comparable.

---

## Tokens de lectura (tarea 3.1) — 2026-10-17

Se jubila `--stage` (papel cálido) y entran los tokens de lectura por tema:
`--reader-bg`, `--reader-ink`, `--reader-title`, `--reader-rule`; `--tp-bg`
pasa a ser alias de `--reader-bg` (teleprompter y lector comparten superficie).
`ReaderStage`, `.epub-page`, los títulos, filetes y el teleprompter los consumen.

Cálculo reproducible: `python3 scripts/audit-reader-contrast.py` (oklch → sRGB →
luminancia WCAG, umbrales AA+; exit 1 si algo no llega):

| Tema | Token | Color sRGB | Contraste vs fondo | Umbral |
|------|-------|-----------|--------------------|--------|
| Claro | fondo | `#F3FCFF` | — | — |
| | cuerpo | `#14243C` | **14.91:1** | ≥ 4.5 ✔ |
| | títulos | `#05152E` | **17.39:1** | ≥ 3 ✔ |
| | regla | `#667D94` | 4.09:1 | ≥ 3 ✔ |
| Oscuro | fondo | `#021328` | — | — |
| | cuerpo | `#DCE6F0` | **14.75:1** | ≥ 4.5 ✔ |
| | títulos | `#EBF7FF` | **17.09:1** | ≥ 3 ✔ |
| | regla | `#596B80` | 3.40:1 | ≥ 3 ✔ |

**Capturas:** `docs/screenshots/lectura-claro-1280x800.png`,
`docs/screenshots/lectura-oscuro-1280x800.png` (Sofia p.5, dock cerrado).

## Preparación del modo texto (tarea 4.2) — 2026-10-17

La extracción del PDF corre en segundo plano por libro (`src/lib/pdf-text-index.ts`
+ `usePdfText`): la lectura arranca con el prefijo listo, el progreso se publica
coalescido (≤ ~1 notificación cada 150 ms) y el riel puede adelantar su página
destino (`ensurePdfTextPage`). Caché en memoria por sesión; si el libro se cierra
a mitad, lo extraído se conserva y la siguiente entrada retoma donde quedó.

Medición reproducible: `bun scripts/test-pdf-text-prep.ts` (tomo sintético de
**670 páginas**, `scripts/libro-largo-670.pdf`, generado con
`python3 scripts/make-big-pdf.py 670 --nopad --out libro-largo-670.pdf`):

| Medida | Resultado |
|--------|-----------|
| Una página suelta (primera lectura posible) | **59–97 ms** |
| Preparación completa de 670 páginas | **4,7 s** (7,0 ms/página; 4,3–6,0 s según carga) |
| Prioridad del riel (página 600 al saltar) | **24–47 ms** |
| Primera página visible con el bombeo | `ready ≥ 1` y `done = false` ✔ (la lectura empieza antes de terminar) |
| Notificaciones a la UI | ≈ 40 para 670 páginas (coalescencia activa) |

Nota: los tiempos son del reloj de bun con el fake worker de pdf.js (el poll de
20 ms sufre contención y exagera «primera página lista»); en el navegador la
extracción real corre en el worker de pdf.js y la UI queda libre entre páginas.

## Modo texto reflowable (tareas 4.3–4.4) — 2026-10-17

El PDF digital se puede leer como texto reflowado (`PdfTextView`): páginas
virtuales de ~320 palabras paginadas como en el EPUB, tipografías de lectura —
Literata, EB Garamond, Atkinson Hyperlegible, servidas con `next/font` y la
variable `--reader-font` — letra escalable en caliente y un aviso cuando la
página real pedida no tiene texto extraíble («La página N no tiene texto;
continúo en la M»). El riel, el contador y los hitos siguen hablando de páginas
reales; el teleprompter consume las virtuales (tarea 6.1), y al girar de página
en modo texto las dos primeras se sirven al instante del prefijo ya extraído.

Límite conocido (heurística de muebles): el filtro de encabezados y pies
(`extractPdfPageBlocks`) solo actúa cuando recibe `pageHeight`; el camino
directo del teleprompter sobre páginas reales (libros que no usan el modo
texto) no lo pasa, así que en PDFs con encabezado repetido esas líneas pueden
colarse en el flujo. El modo texto sí lo pasa y las filtra.

**Capturas:** `docs/screenshots/pdf-texto-claro-1280x800.png`,
`docs/screenshots/pdf-texto-oscuro-1280x800.png` (Quijote, modo texto); la
matriz «después» añade `after-texto-{dark,light}-{1280x800,390x844}.png`.

---

## Después «Teleprompter y lector» — 2026-10-17

Método idéntico al baseline (app real en dev, `scripts/cdp-capture.mjs` +
`scripts/snap-and-detect.sh`, impeccable **v4.6.0** `detect --json`). Ahora son
**4 superficies × 2 temas × 2 viewports = 16 capturas**: se añaden el modo
texto del PDF y el teleprompter de flujo continuo (las tarjetas del «modo cine»
ya no existen).

**Capturas:** `docs/screenshots/after-{epub,pdf,texto,tp}-{dark,light}-{1280x800,390x844}.png`
**JSON del detector:** `docs/auditoria/after/after-{...}.json` (mismo nombre).
El par de README `teleprompter-{dark,light}.png` se regeneró con el flujo
continuo (Sofia p.5, ~3,5 s de encendido, Auto apagado).

### Resolución del baseline

| Regla (baseline) | Antes | Después | Estado |
|------------------|-------|---------|--------|
| `flat-type-hierarchy` (advisory) | 12/12 superficies | 0 | **Resuelta** — la escala tipográfica del lector (tarea 3.1) da el escalón que pedía la regla |
| `body-text-viewport-edge` (warning) | 6/6 en 390×844 | 0 | **Resuelta** — el reflow del modo texto y el padding del flujo contienen el cuerpo |
| `overused-font` (warning) | 2 (teleprompter en tarjetas) | 0 | **Resuelta** — el teleprompter hereda la fuente de lectura de la casa (`--reader-font`) |
| `buried-raster` (warning) | 6 en claro | 16 en claro (8 superficies) | **Permanece, justificada** — es la misma decoración de la sala (`atena-capa2__fachada`, `__busto`) bajo un velo casi opaco; en claro nunca llega a la pantalla, igual que en el baseline. Aparece en las 4 superficies porque el snapshot incluye la biblioteca de fondo |
| `low-contrast` (warning) | 5 | 9 → **0** | **Resuelta (2026-10-18, change `contraste-azul-sobre-tinte`)** — el patrón era el texto azul de enfoque sobre tinte del mismo azul (`text-primary` sobre `primary/10`: 4,0:1 en claro y 3,4–3,5:1 en oscuro móvil, por debajo de AA 4,5:1). Se añadió la pareja «azul sobre tinte» `--primary-on-tint` por tema (claro `oklch(0.45 0.155 250)`, oscuro `oklch(0.78 0.12 246)`) sin mover `--primary` global; los botones «Pantalla completa» de la cabecera y del chrome del teleprompter — y el resto de texto azul sobre tinte (badges y chips activos) — la consumen. Re-escaneo del detector sobre capturas nuevas: **0 hallazgos `low-contrast`** en las 8 superficies con el patrón (lector EPUB y teleprompter × 2 temas × 2 viewports; PDF página y modo texto comparten la misma cabecera) — ver sección siguiente. |

Balance: **39 hallazgos del baseline → 25 → 16** tras resolver el
`low-contrast` (2026-10-18); el único patrón restante es el `buried-raster`
preexistente y justificado de la decoración de la sala. Ninguna regla nueva
sin resolver.

### Hallazgo nuevo del cambio: el apagado del teleprompter (resuelto en el mismo pase)

El detector marcó el texto aún no encendido del flujo (`span.tp-ch` y los
títulos `.tp-block-h`): 1,4–1,6:1. Heredaba el apagado de las tarjetas
(`opacity: 0,17/0,18`). Se sube a **0,55** — y **0,68** en pantallas ≤ 640 px,
donde la letra baja de 24 px y el umbral AA sube a 4,5:1. Re-escaneo verificado
de las 4 capturas del teleprompter: oscuro **0 hallazgos** (1280 y 390), claro
solo el `buried-raster` preexistente. La señal del modo queda intacta: el texto
encendido va a contraste completo (≈15:1) sobre un apagado que ahora es texto
legible y no una mancha.

### Otros ajustes de este pase

- `scripts/test-vn-stress.js` despierta el chrome del teleprompter antes de
  tocar sus controles: el auto-ocultado (3,5 s) le ganaba la carrera al
  hit-test de Playwright (flacuencia del arnés, no de la app).
- `scripts/test-hotkeys-e2e.js` y `scripts/test-dead-keys.js` aceptan
  `ATENA_CHROMIUM` para correr con el Chromium del sistema.

**Verificación final:** `bunx tsc --noEmit` limpio · `bun run lint` 0 errores
(2 avisos de complejidad tolerados) · `scripts/test-vn-stress.js` **21/21** ·
`scripts/test-pdf-text-prep.ts` **9/9** (4,7 s / 7,0 ms por página en 670) ·
`scripts/audit-reader-contrast.py` AA+ · `scripts/audit_teleprompter_timing.py`
fórmula sana · i18n es/en/pt con paridad perfecta de 501 claves y pase en vivo
sin claves crudas.

---

## Resolución del último hallazgo: «azul sobre tinte» (change `contraste-azul-sobre-tinte`) — 2026-10-18

El seguimiento abierto de la auditoría cierra aquí: los botones «Pantalla
completa» (cabecera del lector y chrome del teleprompter) pintaban
`text-primary` sobre tinte `primary/10` y no llegaban a AA para texto
pequeño — **4,0:1** en claro (`#0274C7` sobre `#D7ECF9`) y **3,4–3,5:1** en
oscuro móvil. El arreglo no toca `--primary` global (riel, progreso y focos
quedan intactos): entra la pareja «azul sobre tinte» por tema,
`--primary-on-tint`, elegida midiendo contra el fondo compuesto real
(tinte 10–20 % sobre `bg-card/40` sobre `--background`):

| Tema | Texto (token) | Tinte 10 % | Tinte 15 % | Tinte 20 % (hover) |
|------|----------------|------------|------------|--------------------|
| Claro | `oklch(0.45 0.155 250)` → `#0055A6` | **6,02:1** | 5,62:1 | 5,25:1 |
| Oscuro | `oklch(0.78 0.12 246)` → `#73BFFF` | **8,68:1** | 8,05:1 | 7,40:1 |

(antes: 3,99:1 en claro y 5,59:1 plano en oscuro — insuficiente por píxel en
móvil por el antialiasing de texto 12px; el nuevo margen cubre ambos métodos).

**Aplicación:** botón «Pantalla completa» de `ReaderHeader` (mismo look, texto
cambiado al token) y del chrome de `TeleprompterOverlay` (pasa de ghost a la
pareja azul-sobre-tinte con borde `primary/40`, igual que su gemelo de la
cabecera), más el resto de texto azul sobre tinte del lector: badges de
idioma (vocabulario, diccionario, OCR), chips activos (OCR, diccionario,
posición del riel, presets de filtro) y preset activo del menú de velocidad
del teleprompter.

**Verificación (método de la auditoría):**
- `python3 scripts/audit-reader-contrast.py` — extendido con la pareja: las
  6 mediciones por tema (tintes 10/15/20 %, hover incluido) en **PASS** y el
  compuesto claro `#D7ECF9` reproduce exactamente el que midió el detector.
- Detector impeccable **v4.6.0** `detect --json` sobre capturas nuevas del
  lector (mismo método: app en dev + snapshot del DOM + CSS del server):
  **0 hallazgos `low-contrast`** en las 8 superficies con el patrón
  (`after-tinte-{epub,tp}-{dark,light}-{1280x800,390x844}`) — JSON en
  `docs/auditoria/after-tinte/`, capturas en `docs/screenshots/after-tinte-*.png`.
  Los hallazgos restantes son el `buried-raster` documentado arriba y
  advisories `design-system-*` propios del render estático file:// (fuentes y
  tokens computados sobre fallbacks); control positivo: el mismo motor sobre
  el par antiguo reproduce el hallazgo original («4.0:1 — text #0274c7 on
  #d7ecf9»), así que el 0 es real y no un escaneo vacío.
- `bunx tsc --noEmit` limpio · `bun run lint` sin hallazgos nuevos.
