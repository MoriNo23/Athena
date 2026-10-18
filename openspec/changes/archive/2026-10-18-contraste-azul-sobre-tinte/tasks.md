# Tasks

## 1. Mecanismo y verificación AA

- [x] 1.1 Medir el par actual (texto azul sobre tinte `primary/10`) en las 8 combinaciones (2 temas × 1280×800/390×844 × cabecera y chrome del teleprompter) extendiendo el script de contraste del lector al caso, y elegir los valores del token según D1. Verificación: tabla de medidas «antes» y valores elegidos con margen ≥ 4,5:1 anotados en el change.
  - Antes: 4,0:1 en claro (`#0274C7` sobre `#D7ECF9`, medido por el detector) y 3,4–3,5:1 en oscuro móvil (píxel); compuesto oscuro plano 5,59:1 insuficiente por antialiasing de texto 12px.
  - Elegidos (compuesto real = tinte 10–20 % sobre `bg-card/40` sobre `--background`): claro `oklch(0.45 0.155 250)` → `#0055A6` (6,02 / 5,62 / 5,25:1) · oscuro `oklch(0.78 0.12 246)` → `#73BFFF` (8,68 / 8,05 / 7,40:1). Tabla completa en `docs/auditoria-impeccable.md`, sección «azul sobre tinte».
- [x] 1.2 Implementar la pareja «azul sobre tinte» en `globals.css` y aplicarla a los botones «Pantalla completa» (`ReaderHeader`, chrome de `TeleprompterOverlay`). Verificación: `bunx tsc --noEmit` limpio, `bun run lint` sin hallazgos nuevos y ambos puntos usan el token nuevo (`rg`).
  - Token `--primary-on-tint` por tema + utilidad `text-primary-on-tint` (`@theme inline`); aplicado a los dos botones «Pantalla completa» y al resto de texto azul sobre tinte del lector (badges de idioma, chips activos, preset de velocidad del TP). `tsc` 0 · `lint` 0 (solo quedaban los 2 avisos de complejidad, resueltos por `complejidad-lector` en el mismo pase). `rg "text-primary-on-tint" src` → 9 usos.
- [x] 1.3 Verificar AA con el método de la auditoría: script de contraste (las 8 combinaciones ≥ 4,5:1) y detector impeccable sobre capturas nuevas. Verificación: JSON del detector sin `low-contrast` y mediciones adjuntas.
  - `python3 scripts/audit-reader-contrast.py` → 6 mediciones por tema en PASS (exit 0); el compuesto claro `#D7ECF9` reproduce el del detector.
  - Detector impeccable v4.6.0 `detect --json` sobre 8 capturas nuevas (`after-tinte-{epub,tp}-{dark,light}-{1280x800,390x844}`): **0 `low-contrast`**. Control positivo: el mismo motor reproduce el hallazgo original (4.0:1, `#0274c7` sobre `#d7ecf9`). JSON en `docs/auditoria/after-tinte/`, capturas en `docs/screenshots/`.

## 2. Cierre de auditoría y documentos

- [x] 2.1 Actualizar `docs/auditoria-impeccable.md`: `low-contrast` pasa a resuelta con fecha, medidas y evidencia. Verificación: fila y balance actualizados; el hallazgo ya no figura como pendiente.
  - Fila «9 → 0 Resuelta (2026-10-18)» + balance «39 → 25 → 16» + sección nueva con la tabla de medidas y el método.
- [x] 2.2 Actualizar `DESIGN.md` y `.impeccable/design.json` con el token nuevo (frontmatter y colorMeta si toca). Verificación: el JSON parsea (`python3 -c "import json,sys; json.load(open('.impeccable/design.json'))"`) y el token aparece en ambos archivos.
  - `focus-blue-on-tint` / `focus-blue-on-tint-day` en ambos archivos; JSON parsea sin errores.
- [x] 2.3 Verificar `.impeccable/design.json` en `impeccable live` (dev server arriba): las piezas del sistema renderizan sin errores de tokens. Verificación: nota/captura del panel con las piezas nuevas.
  - El sidecar no corre en este entorno, verificación equivalente: el detector (misma librería de contexto) cargó `DESIGN.md` + `.impeccable/design.json` durante las 8 corridas `detect` sin error alguno de tokens (las reglas `design-system-*` leyeron el archivo y solo reportan advisories de render file://, ninguno sobre el token nuevo). Nota dejada en la sección de verificación de la auditoría.

## Workflow follow-up

- Archivar el change cuando la verificación AA cierre y la auditoría quede sin pendientes reales. → Archivado 2026-10-18 (verificado: script AA+ en verde y detector con 0 `low-contrast`).
