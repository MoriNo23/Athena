# Proposal: teleprompter-camara-estable

## Why

El teleprompter rebota al reproducirse. La causa raíz es el motor de cámara actual
(`view-anim.ts` + `scrollToChar`): cada carácter crea una animación nueva que captura
`from`/`delta` al nacer y es cancelada a mitad de vuelo por el paso siguiente (retarget
destructivo). Además el objetivo de cámara (banda al 40 %) puede ser un `scrollTop`
inalcanzable al inicio y fin de página —no hay reserva de espacio por encima del primer
carácter— y el navegador clampea, produciendo el vaivén visible. El spec «Banda de lectura
estable» ya exigía reservar ese espacio; la implementación solo reserva abajo.

## What Changes

- Nuevo módulo `src/lib/camera.ts`: `CameraController`, un único bucle rAF persistente con
  seguimiento exponencial (lerp normalizado por tiempo, τ ≈ 90 ms) hacia la banda de lectura.
  Un retarget solo actualiza el objetivo; nunca reinicia una animación.
- `scrollToChar()` pasa a ser una orden de cámara (calcular objetivo y `retarget()`); el modo
  `instant` escribe directamente y fija el objetivo al valor escrito (rebobinado directo).
- Reserva de banda por layout: `--tp-band: 40vh` como padding-top del escenario y
  `padding-bottom: calc(40vh + 28px)`, para que el objetivo siempre exista (sin clamp).
- Yield automático: si el `scrollTop` real difiere de lo que la cámara escribió (rueda, ↑,
  arrastre), la cámara entra en `manual` y no vuelve a escribir hasta `resume()`.
- Retiro de `view-anim.ts` del teleprompter (la función pura puede sobrevivir si el modo
  texto la reutiliza). El step-timer, las pausas de puntuación, el cruce atómico con ancla y
  el fundido de página quedan intactos.

## Impact

- Affected specs: `teleprompter` (modifica «Vista con transición breve»; añade «Cámara como
  servidor de objetivos» y «Banda garantizada por layout»).
- Affected code: `src/lib/camera.ts` (nuevo), `src/hooks/use-teleprompter-window.ts`,
  `src/components/reader/TeleprompterOverlay.tsx`, `src/lib/view-anim.ts` (retiro del modo).
- Riesgos y presupuestos: ver SDD capítulo 8 (≤ 2 ms JS por frame; deadzone 0,5 px).
