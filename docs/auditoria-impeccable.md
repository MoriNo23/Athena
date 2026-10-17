# Auditoría Impeccable — Atena

Fecha: 2026-10-17 · Motor: [impeccable](https://github.com/pbakaus/impeccable) v0.1.15 (59 reglas deterministas + revisión visual VLM) · Superficies auditadas: biblioteca (oscuro/claro, 1280×800 y 390×844), lector EPUB, lector PDF, modo novela visual.

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
- Aria-labels en español en TODOS los controles; el modo novela es un `role=dialog` con barra de progreso; foco gestionado al abrir libro y tras Enter/Escape del input de página.
- `prefers-reduced-motion` enciende todas las letras y desactiva animaciones — la ruta alternativa correcta.
- Paginación del EPUB real del usuario (Sofía, 670 páginas): mediana 289 palabras/página, 0 páginas sobre el tope, 0 vacías, parse en 471ms.

## Verificación

- Motor impeccable: biblioteca desktop **exit 0** (0 hallazgos, 0 avisos), biblioteca móvil **exit 0**, estático sobre `src/` limpio.
- Regresión: motor EPUB 25/25 · e2e EPUB 28/28 (subida→ficha→riel→VN→diccionario→índice→peek→persistencia, 0 errores de página) · `tsc` 0 en `src` · `eslint` 0.
- Revisión visual (VLM): medida cómoda, jerarquía clara, portadas coherentes con el sistema brutalista.
- Estado del usuario restaurado byte a byte tras las pruebas (BD + uploads).
