# Proposal

## Why

Dos defectos de sensación en el teleprompter, ambos reportados por la persona lectora con su propio libro (EPUB «El mundo de Sofía») y que los arreglos anteriores no cerraron:

1. **Retroceder con `←` «rebota».** Al rebobinar, la vista «intenta bajar, sube, baja y luego sube bien» y las letras se apagan con la misma animación con la que se encienden al leer. No es un tirón puntual: es una causa estructural. El rebobinado **reutiliza la maquinaria del avance**:
   - **CSS no direccional.** `.tp-ch` declara `transition: opacity/color 130 ms` en su estado base, así que la transición corre igual al encender y al apagar. El título (`.tp-block-h`) tiene en reposo `transform: translateY(0.3em)` con transición de 900 ms: al rebobinar «baja» 0,3 em al apagarse y vuelve a subir al encenderse, moviendo justo el texto que sirve de referencia a la cámara.
   - **Cámara con easing.** La spec vigente pide que el rebobinado se acompañe «con transición breve» (`Vista con transición breve › Rebobinado`), así que cada `←` lanza una animación `easeOutCubic` de 90–400 ms. Con la tecla mantenida (repetición ≈30 Hz) se encadenan reinicios de la animación, cada uno arrancando a velocidad máxima: la vista nunca se asienta.
   - **Efecto colateral del cruce.** El fundido de página recién añadido también se dispara al retroceder de página.
2. **El cambio de página en Auto es brusco.** Con Auto, en cuanto se enciende la última letra el motor desliza la ventana a la página siguiente sin pausa: no hay tiempo de percibir que la página terminó.

## What Changes

- **Retroceso directo, sin herencia del avance.** Apagar es lo contrario de encender, no una animación inversa: las letras y los títulos se apagan al instante (sin transición ni desplazamiento en reposo), y la cámara acompaña el rebobinado sin animación de vista —posición directa derivada del layout— de modo que el resultado depende solo de qué letras están encendidas, nunca de animaciones en vuelo. La animación de aparición del título pasa a ser exclusiva del encendido (keyframes en `.on`), sin estado de reposo desplazado.
- **El fundido de página es solo hacia delante.** Al retroceder de página no se anima.
- **Pausa de 2 s antes de cambiar de página en Auto.** Al encenderse la última letra de la página, el Auto espera 2 s antes de pasar a la siguiente. Durante la espera el aviso «Pasando a la página N…» permanece visible con una barra de cuenta que se llena en esos 2 s. Gestos manuales (`Shift+→`) siguen siendo inmediatos.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `teleprompter`: el rebobinado es directo (sin transiciones heredadas del avance ni animación de cámara); el encadenado de páginas en Auto respeta una pausa de 2 s.

## Impact

- CSS: `src/app/globals.css` (`.tp-ch`, `.tp-block-h`, aviso de página).
- Hooks: `src/hooks/use-teleprompter-window.ts` (`scrollToChar` con modo directo), `src/hooks/use-teleprompter-player.ts` (`rewindOne`, pausa de cruce), `src/lib/teleprompter.ts` (constante de la pausa), `src/lib/step-timer.ts` (sin cambios de contrato).
- UI: `src/components/reader/TeleprompterOverlay.tsx` (no animar el fundido al retroceder) y `TeleprompterPageNotice.tsx` (el aviso se sostiene durante la pausa, con barra de cuenta).
- Spec: `openspec/specs/teleprompter` (3 requisitos modificados).
