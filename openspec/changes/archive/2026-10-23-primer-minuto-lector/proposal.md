# Proposal

## Why

La crítica UX del 23-10-2026 (24.5/40, snapshot `.impeccable/critique/2026-10-23T05-35-47Z__src-app-page-tsx.md`) midió dos P0 en el primer minuto del lector — el dock de modos recibe tapando el libro (352px en desktop, ~90% del visor móvil y cortado fuera del viewport) y el auto-ocultado del chrome a los 4 s sin pista alguna («se rompió», rendición del minuto uno) — más un P1 que contradice la promesa del producto («el texto manda»): el indicador de zoom nunca nombra el modo y la crítica leyó recortes que venían de un fixture que se dibujaba más ancho que su propia página. Con el permiso de la dueña se incluye además el destilado del chrome del lector (`/impeccable distill`, cortes preguntados y aprobados en su sesión).

## What Changes

- **Palanca a (P0):** el dock de modos de lectura nace **cerrado** en la primera visita (sin regla guardada = cerrado); el toggle persistente existente manda a partir de la primera decisión del usuario, sin migración de datos.
- **Palanca b (P0):** pista **única por dispositivo** del auto-ocultado: la primera vez que el chrome se esconde solo, una pastilla autodesmontable explica cómo volver («La interfaz vuelve al mover el mouse», es/en/pt); el timing de 4 s queda intacto; el ocultado por tecla no dispara pista (ahí el mouse no despierta).
- **Palanca c (P1):** el disparador de zoom **nombra el modo activo** («Óptima»/«Página», i18n es/en/pt) en vez de mostrar siempre el % derivado del visor; el % solo aparece cuando la escala es el estado (manual); verificación con libros reales (Quijote + tomo gordo) y fixture regenerado que ya no se recorta a sí mismo.
- **Destilado del lector** (aprobado por la dueña en su sesión): fuera los 6 sliders de filtros (los presets nombrados cargan el render), fuera los sliders de paso de flecha/rueda/segundos de ocultado (defaults de casa: 40%, nativa, 4 s), fuera el «32% leído» del subtítulo (lo dicen el riel y «12 de 670»), fuera 4 reglas verticales; vocabulario y ajustes del riel se pliegan al menú «⋯» de la cabecera. Migración de settings **v11 → v12**: preset `custom` → `auto`, tuning a defaults.

## Capabilities

### New Capabilities

- `reader-first-minute`: los defaults y ayudas del primer minuto de lectura — qué ve la usuaria al abrir su primer libro y cuando el chrome se esconde solo.
- `reader-settings-surface`: la superficie de ajustes del lector — qué controles existen, dónde viven y cómo migra el estado guardado.
