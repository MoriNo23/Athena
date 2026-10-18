# Tasks

## 1. Cámara del teleprompter sin rebote ni barridos

- [ ] 1.1 Cruce atómico en `use-teleprompter-player.ts`: `slide()` publica la ventana nueva de inmediato con los bloques disponibles (`{ start: nextStart, pages: [first, null] }`) en el mismo render que el rebase del encendido, y la página siguiente se rellena después con un segundo `setWin` que conserva `start`. Verificación: `node scripts/test-vn-auto.js` en verde y, con el servidor dev, el primer cruce de un PDF no muestra el vaivén (sonda 1.5).
- [ ] 1.2 Anclaje atómico al cambiar de ventana en `use-teleprompter-window.ts`: antes del cambio el jugador guarda en un ref el ancla (índice en la ventana vieja y en la nueva, con su posición visual) y un `useLayoutEffect` sobre `[win]` ajusta `scrollTop` sin animación para dejarla en el mismo sitio; cubre el cruce y el prepend del rebobinado. Verificación: cruzar y rebobinar con prepend no reacomoda la columna (casos de la sonda 1.5).
- [ ] 1.3 Título anclado a su inicio en el motor: la orden de vista usa `heading.start` en vez del último carácter. Verificación: llegar a un título con velocidad Lenta asienta el inicio del bloque en la zona cómoda sin sumergirse (caso de sonda 1.5).
- [ ] 1.4 Revelado completo sin orden de vista: completar la página de golpe (clic o espacio) no desplaza la columna. Verificación: el texto restante se enciende sin movimiento de vista (caso de sonda 1.5).
- [ ] 1.5 Extender `scripts/probe-camara-suave.js` con los casos nuevos —cruce con la página siguiente ya en caché, primer cruce sin caché, llegada a título y revelado completo— exigiendo ausencia de reversiones de `scrollTop` (sin vaivén) y desplazamiento nulo en cruce/revelado; hacerla independiente del libro (usar el primero con texto de la biblioteca, no «Don Quijote»). Verificación: `node scripts/probe-camara-suave.js` en verde con Playwright disponible.

## 2. Hoy del libro en la barra del teleprompter

- [ ] 2.1 Pasar el par de hoy del libro (`todayPagesShown` + meta efectiva) de `ReaderView` a `TeleprompterOverlay` y pintarlo en la barra superior junto al estado, con el tooltip `reader.goalBookTitle`. Verificación: con el teleprompter abierto, avanzar páginas sube el par sin recargar (observable con el servidor dev) y `node scripts/test-vn-auto.js` sigue en verde.
- [ ] 2.2 i18n del par si hace falta texto nuevo (es/en/pt); reutilizar las claves existentes de hábito cuando alcancen. Verificación: las claves nuevas existen en los tres idiomas (búsqueda en `src/lib/i18n`) y `bunx tsc --noEmit` pasa.

## 3. Recordatorio de teclas en pantalla completa

- [ ] 3.1 Componente `ShortcutGhost` (lista tecla→efecto, bandera de visibilidad, retiro solo a ~2.5 s, mínimo entre apariciones ~8 s, `pointer-events: none`, `aria-hidden`, sin desplazamiento con movimiento reducido) y estilos fantasma en `globals.css` (columna derecha, letras grandes y transparentes). Verificación: con el servidor dev, abrir/cerrar dispara y retira el recordatorio y con movimiento reducido aparece sin animación.
- [ ] 3.2 Teleprompter: disparar el recordatorio en cada transición de visibilidad de su interfaz (`uiHidden`), con el mapa de teclas del modo. Verificación: ocultar por inactividad y despertar muestra el recordatorio con las teclas del teleprompter (comprobable con `data-testid`).
- [ ] 3.3 Lector en pantalla completa: disparar el recordatorio en cada transición del chrome (`chromeHidden`) cuando el lector está en pantalla completa, con el mapa del lector (incluida la tecla de inmersión configurada). Verificación: en pantalla completa la tecla de inmersión muestra el recordatorio; sin pantalla completa no aparece.
- [ ] 3.4 i18n de las descripciones de teclas del recordatorio (es/en/pt). Verificación: las claves existen en los tres idiomas y `bun run lint` pasa.

## 4. Pantalla despierta

- [ ] 4.1 Hook `useWakeLock(enabled)`: pide `navigator.wakeLock.request("screen")` con la pestaña visible, re-adquiere en `visibilitychange`, libera al deshabilitar o desmontar y calla sin soporte. Verificación: en dev puede comprobarse que el centinela existe con el modo activo y se libera al salir (evaluación por consola/CDP).
- [ ] 4.2 Enganchar el hook: `ReaderView` cuando `isFullscreen` y `TeleprompterOverlay` mientras está montado. Verificación: entrar y salir de pantalla completa y abrir/cerrar el teleprompter adquiere y libera el bloqueo; sin soporte la lectura sigue sin errores.

## 5. Verificación de integración

- [ ] 5.1 `bunx tsc --noEmit`, `bun run lint` y `bun run crap:changed` en verde (banda de complejidad del repo).
- [ ] 5.2 `node scripts/test-vn-stress.js` y `node scripts/test-hotkeys-e2e.js` en verde con el servidor dev.
- [ ] 5.3 `node scripts/probe-camara-suave.js` completo (casos viejos y nuevos) en verde.
- [ ] 5.4 `openspec validate teleprompter-camara-y-pantalla-completa --strict` sin hallazgos.

## Workflow follow-up

- Archivar el change cuando la revisión del usuario esté satisfecha (`openspec archive`) y verificar el resultado archivado.
