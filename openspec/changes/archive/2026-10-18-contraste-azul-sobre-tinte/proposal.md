# Proposal

## Why

El último hallazgo real de la auditoría impeccable sigue abierto: los botones «Pantalla completa» (cabecera del lector y chrome del teleprompter) pintan `text-primary` sobre tinte `primary/10` y quedan en **4,0:1** en claro y **3,4–3,5:1** en oscuro móvil, por debajo de AA (4,5:1) para texto pequeño. Es preexistente al change archivado y quedó documentado como seguimiento porque el arreglo toca el token global `--primary` (botones, riel, progreso y focos de interacción).

## What Changes

- **Pareja «azul sobre tinte» por tema**: token(s) nuevos para usos de texto azul sobre tinte azul, con valores medidos para ≥ 4,5:1 en ambos temas y viewports. El azul global `--primary` no se mueve.
- **Aplicación**: botones «Pantalla completa» de `ReaderHeader` y del chrome de `TeleprompterOverlay`.
- **Verificación**: script de contraste del lector extendido al caso + detector impeccable sobre capturas nuevas; `low-contrast` deja de reportarse.
- **Documentos al día**: `docs/auditoria-impeccable.md` (hallazgo resuelto), `DESIGN.md` y `.impeccable/design.json` (token nuevo), y la verificación pendiente del sidecar en `impeccable live`.

## Capabilities

### New Capabilities

(Ninguna.)

### Modified Capabilities

- `reader-surface`: nuevo requisito — los controles del lector en azul sobre tinte (p. ej. «Pantalla completa») SHALL cumplir AA (4,5:1) en ambos temas y viewports.

## Impact

- `src/app/globals.css` (tokens y estilos de los botones), `src/components/reader/ReaderHeader.tsx` y `src/components/reader/TeleprompterOverlay.tsx` (uso del token), `scripts/` (medición de contraste), `docs/auditoria-impeccable.md`, `DESIGN.md`, `.impeccable/design.json` y capturas.
- Sin cambios de comportamiento de lectura, de datos ni de dependencias.
