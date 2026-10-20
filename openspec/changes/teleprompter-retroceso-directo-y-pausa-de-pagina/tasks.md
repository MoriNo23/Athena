# Tasks

## 1. Retroceso directo (causa de raíz del rebote)

- [x] 1.1 `.tp-ch`: transición solo en `.tp-ch.on`; estado base sin transición (apagar es instantáneo). Letras de un título sin fundido.
- [x] 1.2 `.tp-block-h`: sin `transform` ni `transition` en reposo; la aparición pasa a `@keyframes tp-heading-in` declarada en `.tp-block-h.on`.
- [x] 1.3 Movimiento reducido: anular transición de `.tp-ch.on` y animación de `.tp-block-h.on` (especificidad).
- [x] 1.4 `scrollToChar(idx, { instant })` y `rewindOne` con cámara directa (sin `animateScrollTopTo`).
- [x] 1.5 Fundido de página solo hacia delante (no al retroceder de página).
- [x] 1.6 `scripts/test-tp-css.ts`: contrato del CSS direccional (0/9 contra el CSS anterior, 9/9 ahora).

## 2. Pausa de 2 s antes de cambiar de página en Auto

- [x] 2.1 `TELEPROMPTER_PAGE_TURN_MS = 2000` y `plannedStepDelay` (lib pura) con la regla: cruce en Auto espera, la señal manual no.
- [x] 2.2 Motor: el paso que sigue a la última letra se programa con `plannedStepDelay`; la espera restante sobrevive a reinicios (`step-timer`).
- [x] 2.3 Camino de revelado instantáneo con Auto: el efecto Auto usa la misma constante.
- [x] 2.4 Aviso: permanece durante la pausa y muestra una barra de cuenta de 2 s (estática con movimiento reducido).
- [x] 2.5 Pruebas: `test-step-timer.ts` (14/14) y `test-page-notice.tsx` (7/7).

## 3. Verificación

- [x] 3.1 `eslint` limpio; `tsc` solo falla por `@prisma/client` sin generar (sin red en este entorno); `openspec validate --all --strict`.
- [ ] 3.2 Sonda en navegador: mantener `←` cruzando varias líneas y un título; registrar `scrollTop` por cuadro y comprobar que es monótono y sin animación en vuelo al soltar. Requiere Chromium (no disponible aquí).
- [ ] 3.3 Medir en navegador la pausa de 2 s (`probe-auto-cruce.js` adaptada: intervalo entre última letra y cambio de página ≈ 2000 ms).
- [ ] 3.4 Re-ejecutar `probe-camara-suave.js` (8/8) y `probe-flechas-tp.js` (9/9) tras el cambio de CSS (Turbopack no recompila `globals.css` en caliente: reiniciar el dev server).
