# Design

## Diagnóstico (causa de raíz)

El avance y el retroceso comparten tres mecanismos que solo tienen sentido hacia delante:

| Mecanismo | Hacia delante (correcto) | Al retroceder (defecto) |
|---|---|---|
| `transition` en `.tp-ch` (estado base) | la letra se «enciende» con fundido de 130 ms | la letra se «apaga» también con fundido: el retroceso se ve arrastrado y desfasado de la cámara |
| `transform: translateY(0.3em)` en reposo de `.tp-block-h` + transición 900 ms | el título se asienta al encenderse | al apagarse **baja** 0,3 em durante 900 ms (el «intenta bajar»), y si se vuelve a encender **sube** |
| `animateScrollTopTo` (easeOutCubic 90–400 ms) | una animación por línea nueva, sin solaparse | con `←` mantenida se encadenan reinicios que arrancan siempre a velocidad máxima |

Una transición CSS toma la declaración del estado **de destino**. Por eso la dirección se puede codificar en el propio CSS: lo que se declara en `.on` solo corre al encender; lo declarado en el estado base corre al apagar.

## Decisiones

1. **CSS direccional, no un parche por contexto.**
   - `.tp-ch`: `transition: none` en la base y el fundido de 130 ms **solo** en `.tp-ch.on`. Encender anima; apagar es instantáneo.
   - `.tp-block-h`: sin `transform` ni `transition` en reposo (opacidad 0.55, quieto). La aparición pasa a una animación `@keyframes` declarada en `.tp-block-h.on` (opacidad 0.55→1 y asentamiento de 0,3 em), que por construcción solo existe al encender. Quitar `.on` es un cambio instantáneo sin desplazamiento.
   - Alternativa descartada: una clase `tp-rewinding` en el contenedor con `transition: none !important`. Es un parche temporal con estado que hay que limpiar (¿cuándo termina el retroceso?) y puede dejar la clase puesta.
2. **Cámara directa al rebobinar.** `scrollToChar(idx, { instant: true })` cancela cualquier animación en vuelo y escribe `scrollTop` una sola vez, derivado del layout real. El resultado es función pura de las letras encendidas: sin animaciones solapadas no puede rebotar. Coste: al cruzar de línea hacia arriba la vista salta una línea (≈1,7 em) en lugar de deslizarse; es un gesto de precisión letra a letra, no de lectura. El avance mantiene su transición breve.
   - Alternativa descartada: reducir la duración o amortiguar los reinicios (suavizado exponencial). Sigue habiendo animación en vuelo contra la que competir y se mantiene la causa estructural.
3. **Fundido de página solo hacia delante** (`curStart > anterior`). Al retroceder no se anima.
4. **Pausa de 2 s en Auto antes de cambiar de página.**
   - Constante `TELEPROMPTER_PAGE_TURN_MS = 2000` en `lib/teleprompter.ts`.
   - Motor: tras encender la última letra de la página con página siguiente y Auto activo, el siguiente paso se programa a 2000 ms en lugar del retardo de la primera letra de la página nueva. Se apoya en `step-timer` (la espera restante sobrevive a reinicios del efecto) con `planned = PAGE_TURN_MS` en ese paso.
   - Camino de revelado instantáneo (`pageDone` con Auto): el retardo del efecto Auto pasa a la misma constante.
   - El aviso (`TeleprompterPageNotice`) ya se muestra en las últimas 48 letras; ahora permanece durante la pausa y añade una barra de cuenta de 2 s (animación CSS, estática con movimiento reducido).
   - `Shift+→`, `forward()` y la señal manual **no** esperan: la pausa solo gobierna el cruce automático.
5. **Orden de cambios.** Primero el CSS direccional y la cámara directa (cierran el rebote), después la pausa (independiente), por último pruebas y spec.

## Riesgos

- Sin Chromium en este entorno no se puede medir el rebote en el navegador: la verificación es estática (CSS y lógica), con pruebas puras donde se puede, más el procedimiento de sondas (`scripts/VERIFICACION-TELEPROMPTER.md`) para confirmarlo en una máquina con navegador.
- El salto de una línea al retroceder es una decisión de diseño explícita (ver 2).
