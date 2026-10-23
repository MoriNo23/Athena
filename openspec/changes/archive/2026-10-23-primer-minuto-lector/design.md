# Design

## Context

Crítica dual-agent del 23-10-2026 con evidencia medida (ver proposal). El trabajo lo ejecutaron tres sesiones de agente en paralelo sobre el mismo árbol (palanca a, palanca b, palanca c) más una cuarta con el destilado aprobado por la dueña; la integración y verificación en vivo corresponde a esta sesión (probe de integración 14/14 + probe de la casa del hint 7 PASS + tsc 0, sin errores de consola). El fixture original de la crítica (`make-big-pdf.py`) dibujaba líneas más anchas que su propia página A4: parte del «recorte» era artefacto de prueba, no defecto del visor.

## Goals / Non-Goals

**Goals:**
- Que el primer minuto del lector sea página primero: dock cerrado, pista única del auto-ocultado, zoom que nombra su modo.
- Reducir el chrome del lector a lo que sirve a la lectura (destilado) sin quitar capacidades: cada control retirado mantiene su efecto por defaults de casa o acceso alternativo.
- Migración de estado sin ruptura (v11 → v12) verificada en vivo con estado viejo sembrado.

**Non-Goals:**
- Móvil (hero 390px, toolbar en filas, targets 44px) — ronda próxima.
- Claves i18n crudas `config.pos-*`, foco visible de acciones de card, reset-all fuera de la CTA, deep-link de lectura, día-1 del clonador — ronda próxima.
- Tocar el timing del auto-ocultado (4 s, norma de industria) ni el hook de inmersión.
- Re-pintar los fixtures existentes (cambiaría la paginación virtual que otros probes consumen): se corrigió solo el generador para tomos nuevos.

## Decisions

- **Default invertido con regla de lectura invertida:** `riel-dock-open` ausente = cerrado (`=== "1"`). Sin migración: una regla de lectura, no un dato.
- **Pista con llave propia y reloj propio:** `riel-immerse-hint-seen` (familia `riel-`), pastilla con el patrón visual de la casa (`kbd-focus-hint`), 4 s autodesmontable; solo el camino de inactividad la dispara (ocultado por tecla queda fuera — ahí «mueve el mouse» sería falso).
- **Nombre de modo en el disparador:** «Óptima»/«Página» (i18n `zoom.optimalShort`/`zoom.pageShort`); el % solo cuando la escala manual es el estado. Feedback honesto aunque el dibujo sea casi igual.
- **Recortes con puerta alternativa:** cada control retirado conserva su efecto (presets cargan el render; tecla «H» editable sigue; menú «⋯» concentra vocabulario + ajustes del riel). Documentado corte por corte en `docs/destilado-lector.md`.
- **Verificación por libros reales:** matriz 4 zonas × 4 estados × 3 idiomas sobre Quijote + tomo gordo de 670 páginas; el fixture regenerado ajusta sus líneas al ancho útil de A4 con `stringWidth`.

## Risks / Trade-offs

- **Tres corrientes tocaron i18n en paralelo:** la coherencia de claves no la cubre tsc (claves dinámicas); se cerró con chequeo grep de todas las claves usadas contra el diccionario (13 sospechas = falsos positivos del regex) + probes en vivo.
- **Pérdida de ajuste fino:** quien usaba filtros custom pierde el control (migra a `auto`); aceptado por la dueña en la sesión del destilado — el modo noche vive en los presets.
- **El «100% en móvil» de la crítica no fue reproducible en el código actual** (encaja en <1 s tras el spinner): si reaparece es transitorio de carga, no geométrico.
