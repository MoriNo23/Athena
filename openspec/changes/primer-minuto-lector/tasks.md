# Tasks

## 1. Palanca a — dock cerrado en primera visita (P0 #1)

- [x] 1.1 Invertir el default de `riel-dock-open` en `use-book-extras.ts`: regla ausente = cerrado (`=== "1"`, catch = false), sin migración de datos.
- [x] 1.2 Verificar en vivo: primera visita sin dock (`[data-chrome-kind="dock"]` = 0), toggle abre/cierra y persiste (probe de integración).

## 2. Palanca b — pista única del auto-ocultado (P0 #2)

- [x] 2.1 Pastilla autodesmontable en `ReaderView.tsx` (`riel-immerse-hint-seen`, 4 s propios, solo camino de inactividad vía `hiddenByKeyRef`).
- [x] 2.2 Clave i18n `rv.immerseHint` en es/en/pt con la voz de la casa.
- [x] 2.3 Probe de la casa `scripts/probe-immerse-hint.js`: 7 PASS (una sola vez, retiro solo, timing 4 s intacto, sin errores).

## 3. Palanca c — zoom que nombra su modo + texto completo (P1)

- [x] 3.1 `ZoomControls.tsx`: disparador nombra «Óptima»/«Página» (`zoom.optimalShort`/`zoom.pageShort` en es/en/pt); % solo en escala manual.
- [x] 3.2 Generador de fixture honesto: `scripts/make-big-pdf.py` ajusta líneas al ancho útil de A4 (`stringWidth`); `make-seed-books.py` con cadena de fuentes liberation/freefont.
- [x] 3.3 Verificación con libros reales (Quijote + tomo de 670 p): sin pan horizontal en cualquier ancho; matriz 4 zonas × 4 estados × 3 idiomas (capturas del agente adapt).

## 4. Destilado del lector (aprobado por la dueña en su sesión)

- [x] 4.1 `ConfigPanel.tsx`: fuera 6 sliders de filtro y sliders de paso/rueda/segundos; presets nombrados cargan el render.
- [x] 4.2 `ReaderHeader.tsx`: «% leído» fuera del subtítulo, reglas verticales fuera, vocabulario + ajustes del riel en menú «⋯» (`reader.moreAria` es/en/pt).
- [x] 4.3 `settings.ts` v11 → v12: `custom` → `auto`, tuning a defaults; verificación en vivo con estado v11 sembrado y 0 errores de consola.
- [x] 4.4 i18n: 20 claves muertas ×3 idiomas retiradas; `docs/destilado-lector.md` con corte por corte y acceso alternativo.

## 5. Integración y verificación final

- [x] 5.1 Coherencia i18n de las tres corrientes: cada clave usada existe en el diccionario (chequeo grep; 13 sospechas = falsos positivos).
- [x] 5.2 Probe de integración 14/14 en vivo + tsc 0 + 0 errores de consola/red en toda la travesía.

## 6. Cierre

- [ ] 6.1 Pase final `/impeccable polish` (advisory preexistente `text-[10px]` del peek + 2 hallazgos de lint en ReaderView) — ronda próxima, junto con los P1 de móvil.
