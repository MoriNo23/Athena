# Tasks

## 1. Mecanismo y verificación AA

- [ ] 1.1 Medir el par actual (texto azul sobre tinte `primary/10`) en las 8 combinaciones (2 temas × 1280×800/390×844 × cabecera y chrome del teleprompter) extendiendo el script de contraste del lector al caso, y elegir los valores del token según D1. Verificación: tabla de medidas «antes» y valores elegidos con margen ≥ 4,5:1 anotados en el change.
- [ ] 1.2 Implementar la pareja «azul sobre tinte» en `globals.css` y aplicarla a los botones «Pantalla completa» (`ReaderHeader`, chrome de `TeleprompterOverlay`). Verificación: `bunx tsc --noEmit` limpio, `bun run lint` sin hallazgos nuevos y ambos puntos usan el token nuevo (`rg`).
- [ ] 1.3 Verificar AA con el método de la auditoría: script de contraste (las 8 combinaciones ≥ 4,5:1) y detector impeccable sobre capturas nuevas. Verificación: JSON del detector sin `low-contrast` y mediciones adjuntas.

## 2. Cierre de auditoría y documentos

- [ ] 2.1 Actualizar `docs/auditoria-impeccable.md`: `low-contrast` pasa a resuelta con fecha, medidas y evidencia. Verificación: fila y balance actualizados; el hallazgo ya no figura como pendiente.
- [ ] 2.2 Actualizar `DESIGN.md` y `.impeccable/design.json` con el token nuevo (frontmatter y colorMeta si toca). Verificación: el JSON parsea (`python3 -c "import json,sys; json.load(open('.impeccable/design.json'))"`) y el token aparece en ambos archivos.
- [ ] 2.3 Verificar `.impeccable/design.json` en `impeccable live` (dev server arriba): las piezas del sistema renderizan sin errores de tokens. Verificación: nota/captura del panel con las piezas nuevas.

## Workflow follow-up

- Archivar el change cuando la verificación AA cierre y la auditoría quede sin pendientes reales.
