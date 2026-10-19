# Tasks

## 1. Cámara del teleprompter sin rebote ni barridos

- [x] 1.1 Cruce atómico en `use-teleprompter-player.ts`: `slide()` publica la ventana nueva de inmediato con los bloques disponibles (`{ start: nextStart, pages: [first, null] }`) en el mismo render que el rebase del encendido, y la página siguiente se rellena después con un segundo `setWin` que conserva `start`. El motor espera el relleno en el hueco sin declarar fin de libro (`atWindowGap`) y `isAtEnd` lo respeta. Verificación: `node scripts/test-vn-auto.js` 18/18 en verde; sonda 1.5 (X1/X2) en verde.
- [x] 1.2 Anclaje atómico al cambiar de ventana en `use-teleprompter-window.ts`: antes del cambio el jugador publica el ancla con `stageViewAnchor()` (índice viejo/nuevo y posición visual medida sobre los spans reales) y un `useLayoutEffect` sobre `[win]` ajusta `scrollTop` sin animación antes del pintado; cubre el cruce (primer carácter sin encender de la página nueva) y el prepend del rebobinado (carácter activo + prevLen). `overflow-anchor: none` en `.tp-scroll` para que el anchoring nativo no pelee con la compensación. Verificación: sonda 1.5 — asentamiento atómico (531→0px en un tick, sin rampa) en cruce y sin reacomodo en el prepend.
- [x] 1.3 Título anclado a su inicio en el motor: la orden de vista usa `heading.start` en vez del último carácter. Verificación: sonda 1.5 (T1) — el bloque del título queda entero en pantalla (top=106px) y a media columna su inicio asienta en la zona cómoda; sin sumersión.
- [x] 1.4 Revelado completo sin orden de vista: completar la página de golpe (clic o espacio) no desplaza la columna. Verificación: sonda 1.5 (R1) — el final de la página queda encendido por debajo de la línea cómoda (último carácter a ~67% del alto) y la vista no viaja al fondo.
- [x] 1.5 Extender `scripts/probe-camara-suave.js` con los casos nuevos —cruce con la página siguiente ya en caché (X2), primer cruce sin caché (X1), llegada a título (T1) y revelado completo (R1)— exigiendo asentamiento atómico (≤2 valores intermedios: ancla + residual) y ausencia de vaivén (≤1 inversión >6% del alto en la ventana de asentamiento); independiente del libro (usa el primero con texto de la biblioteca y salta los sin capa de texto). Verificación: `node scripts/probe-camara-suave.js` 8/8 en verde (3 ejecuciones consecutivas) con Playwright.

## 2. Hoy del libro en la barra del teleprompter

- [x] 2.1 Pasar el par de hoy del libro (`todayPagesShown` + meta efectiva) de `ReaderView` a `TeleprompterOverlay` y pintarlo en la barra superior junto al estado, con el tooltip `reader.goalBookTitle` (`data-testid="tp-today"`). Verificación: el par fluye del mismo hook de sesión que la cabecera (`use-reading-session`); `node scripts/test-vn-auto.js` sigue en verde con el overlay montado.
- [x] 2.2 i18n del par si hace falta texto nuevo (es/en/pt); reutilizar las claves existentes de hábito cuando alcancen. Verificación: sin claves nuevas — el par es numérico y el tooltip reutiliza `reader.goalBookTitle` (existente en los tres idiomas); `bunx tsc --noEmit` pasa.

## 3. Recordatorio de teclas en pantalla completa

- [x] 3.1 Componente `ShortcutGhost` (señal de visibilidad, retiro solo a ~2.5 s, mínimo entre apariciones ~8 s, `pointer-events: none`, `aria-hidden`, `data-shown` para sondas) y estilos fantasma en `globals.css` (columna derecha, letras grandes y transparentes, solo opacidad — con movimiento reducido sin transición). Verificación: `scripts/diag-ghost-wakelock.js` (efímera) — aparece al ocultarse la UI, se retira solo y el throttle evita repeticiones.
- [x] 3.2 Teleprompter: disparar el recordatorio en cada transición de visibilidad de su interfaz (`uiHidden` como señal), con el mapa de teclas del modo (7 entradas). Verificación: diag — quietud > 3.5 s oculta la UI y despliega el fantasma (`data-shown=true`), retiro a ~2.5 s y despertar sin repetición (throttle).
- [x] 3.3 Lector en pantalla completa: el fantasma del lector solo existe con `isFullscreen` (`ReaderShortcutGhost`), con el mapa del lector incluida la tecla de inmersión configurada. Verificación: diag — montado con 7 filas en pantalla completa y ausente fuera de ella.
- [x] 3.4 i18n de las descripciones de teclas del recordatorio (es/en/pt) — claves `ghost.reader.*` y `ghost.tp.*`. Verificación: las 14 claves existen en los tres idiomas y `bun run lint` pasa (0 problemas).

## 4. Pantalla despierta

- [x] 4.1 Hook `useWakeLock(enabled)`: pide `navigator.wakeLock.request("screen")` con la pestaña visible, re-adquiere en `visibilitychange`, libera al deshabilitar o desmontar y calla sin soporte (tipado mínimo propio del sentinel). Verificación: headless Chromium expone la API y la lectura completa corre con cero errores de consola/pageerror.
- [x] 4.2 Enganchar el hook: `ReaderView` cuando `isFullscreen` y `TeleprompterOverlay` mientras está montado (sin F11 también impide la suspensión). Verificación: abrir/cerrar el teleprompter y entrar/salir de pantalla completa en las suites E2E sin errores; sin soporte la lectura sigue igual.

## 5. Verificación de integración

- [x] 5.1 `bunx tsc --noEmit`, `bun run lint` y `bun run crap:changed` en verde (lint 0 problemas; banda de complejidad ≤30 sin avisos; `crap:changed` sale 0).
- [x] 5.2 `node scripts/test-vn-stress.js` (21/21) y `node scripts/test-hotkeys-e2e.js` en verde con el servidor dev.
- [x] 5.3 `node scripts/probe-camara-suave.js` completo (casos viejos R/C/B adaptados y nuevos X1/X2/T1) en verde, 3 ejecuciones consecutivas.
- [x] 5.4 `openspec validate teleprompter-camara-y-pantalla-completa --strict` sin hallazgos.

## Notas de implementación

- Defecto preexistente corregido al pasar: si el overlay abría antes de que el `doc` del PDF estuviera listo, se construía una ventana vacía sin recuperación (early-return del efecto de reconstrucción). Ahora el jugador no construye ventana sin fuente de bloques (`hasSource`) y reintenta cuando `loadBlocks` cambia de identidad.
- `scripts/test-vn-auto.js` quedó obsoleto desde el rediseño del flujo continuo (buscaba `tp-card-box`, retirado): adaptado a la columna (`tp-stream`), con las mismas garantías (auto enciende solo, pausa congela, reanudar continúa, la página gira sola con Auto).
- El recordatorio de teclas usa filas `div` (no `p`) para no desplazar los selectores `p`/`p nth(1)` (título/estado) que las suites E2E llevan años usando.

## Workflow follow-up

- Archivar el change cuando la revisión del usuario esté satisfecha (`openspec archive`) y verificar el resultado archivado.
