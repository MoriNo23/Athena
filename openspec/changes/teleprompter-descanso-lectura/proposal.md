# Proposal: teleprompter-descanso-lectura

## Why

La lectura sostenida en pantalla se degrada con el tiempo: la atención cae en
«piloto automático» (los ojos siguen la columna, la comprensión se apaga —
muy fácil en teleprompter a velocidad constante), suben las regresiones y
aparece fatiga ocular. Un microdescanso resetea la atención: no sube la
velocidad punta, pero MANTIENE la velocidad efectiva y la comprensión en
sesiones largas — y alinea el modo con la regla 20-20-20 (cada 20 min, mirar
algo a ~6 m durante 20 s). El lector ya tiene su sugerencia de pausa
(`pauseMinutes` en cortes naturales), pero el diálogo queda tapado por la
capa inmersiva del teleprompter: el modo necesita el suyo.

## What Changes

- Nuevo ajuste `descansoMin` (bloque `teleprompter`, **0 = desactivado**,
  default 0 — la dueña decide; opciones de UI: Nunca / 15 / 20 / 30 / 45;
  dominio 0-120). Persist v16 (mismo salto que teleprompter-solo-continuo)
  y saneo en `db/config.json` + `_doc`.
- Tras `descansoMin` minutos de LECTURA REAL el aviso se arma y aparece en
  el PRÓXIMO CORTE NATURAL: pausa de la lectora (rueda arriba, rebobinado,
  botón) o cruce de página — nunca a mitad de frase. No pausa sola: sugiere.
- El contador solo corre con el flujo en marcha y la pestaña visible
  (pausa y pestaña oculta no suman).
- Aceptar el descanso detiene el flujo y abre un velo con cuenta atrás de
  20 s (`TELEPROMPTER_DESCANSO_S`, regla 20-20-20) y el consejo. La
  reanudación es EXPLÍCITA («Continuar leyendo» o Esc): la lectora puede
  estar lejos del teclado. «Seguir leyendo» descarta y rearma al cumplir de
  nuevo.
- Mientras el velo está abierto, el teclado es del descanso (Esc termina
  antes); nada salta bajo el velo.
- El velo y la píldora solo transicionan opacidad; con
  `prefers-reduced-motion` no hay animación (la quietud ES el descanso).
- Control de ajuste en la sheet in-mode (sección Comportamiento, antes de
  Auto) y en el panel de configuración, en los tres idiomas.

## Impact

- Affected specs: `teleprompter` (nuevo Requirement: «Aviso de descanso»).
- Affected code: `src/lib/types.ts` (descansoMin + constantes + clamp),
  `src/lib/settings.ts` (default), `src/lib/config-file.ts` (saneo + `_doc`),
  `src/components/reader/TeleprompterOverlay.tsx` (contador, armado, cortes
  naturales, píldora, velo, guardia de teclado),
  `src/components/reader/TeleprompterSettingsSheet.tsx`,
  `src/components/reader/ConfigPanel.tsx`, `src/app/globals.css`
  (`.tp-rest-card`, `.tp-rest-veil`), i18n es/en/pt.
- Tests: `config-file` (saneo de descansoMin), `settings` (migración con el
  campo nuevo).
- No toca motor, ventana ni cruce: es una capa encima del overlay.
