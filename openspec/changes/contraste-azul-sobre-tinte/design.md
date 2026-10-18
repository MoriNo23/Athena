# Design

## Context

Ver `proposal.md`. El patrón infractor es puntual: `text-primary` sobre tinte `primary/10` en los botones «Pantalla completa» (cabecera del lector y chrome del teleprompter). Medición actual: 4,0:1 en claro y 3,4–3,5:1 en oscuro a 390×844; AA de texto pequeño pide 4,5:1. `--primary` es global (botones primarios, riel, progreso y focos), por eso el arreglo no lo toca.

## Goals / Non-Goals

**Goals:**

- Botones «Pantalla completa» ≥ 4,5:1 en ambos temas y viewports (1280×800 y 390×844).
- Re-verificación mecánica (script de contraste + detector impeccable) y documentos al día.

**Non-Goals:**

- Mover `--primary` global, el riel o el progreso.
- Rediseñar el botón ni tocar otras variantes (outline, ghost, secundaria).
- Reabrir la auditoría completa: solo el hallazgo `low-contrast`.

## Decisions

### D1 — Pareja «azul sobre tinte» por tema

Token(s) nuevos para el caso «texto azul sobre tinte azul», con valores elegidos midiendo: en claro, azul más oscuro (bajar L manteniendo hue/chroma); en oscuro, subir la luminancia del texto o reducir el tinte hasta pasar 4,5:1 — el peor caso medido es el oscuro móvil. Los valores concretos salen de la medición, no de la intuición.

- **Por qué**: conserva la señal azul de interacción sin tocar el azul global (riel, progreso, focos) y deja el par medido y documentado.
- **Alternativas descartadas**: (a) oscurecer `--primary` global — arregla un botón y mueve riel, progreso y focos en los dos temas; (b) quitar el tinte y pintar el botón como outline de tinta — pierde la señal azul y cambia más de lo necesario.

### D2 — Verificar con el método que ya midió el problema

Extender el script de contraste del lector (`scripts/audit-reader-contrast.py` o el que corresponda) al par azul-sobre-tinte y re-capturar las superficies con el método de la auditoría (capturas + `impeccable detect`); el detector debe dejar de reportar `low-contrast`.

- **Por qué**: mismo método, resultado comparable con la tabla de la auditoría.

## Risks / Trade-offs

- **El peor caso puede estar en claro o en oscuro móvil según los valores elegidos** → medir las 8 combinaciones (2 temas × 2 viewports × 2 puntos) antes de cerrar.
- **El tinte real cambia según el fondo efectivo** → medir sobre el color computado (captura), no sobre el valor a mano.
- **El token nuevo debe entrar en `DESIGN.md` y el sidecar** o `impeccable live` mostraría piezas viejas → tarea explícita en tasks.

## Migration Plan

Sin migración de datos. Rollback: revertir los tokens y estilos.

## Open Questions

Ninguna.
