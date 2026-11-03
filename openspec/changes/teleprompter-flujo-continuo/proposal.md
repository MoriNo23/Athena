# Proposal: teleprompter-flujo-continuo

## Why

El teleprompter anuncia el cruce de página virtual como un evento: con Auto,
el motor se detiene 2 s en el borde (`TELEPROMPTER_PAGE_TURN_MS`), muestra el
aviso flotante «Pasando a la página N…» y encima lanza la animación de giro de
columna (450 ms, `animarGiroPagina`) en el `useLayoutEffect` del overlay. Para
una lectura a ritmo continuo eso es fricción de interacción: el cambio de
página se percibe como un suceso independiente y no como la continuación de la
misma lectura (pérdida momentánea del punto de lectura y del ritmo). El spec ya
exigía encadenado «sin corte visible»; el corte existe, solo que decorado.

## What Changes

- Nuevo ajuste `flujoContinuo` (bloque `teleprompter`, default **true** — la
  casa arranca en continuo; migración de persist v14 → v15 y saneo en
  `db/config.json`).
- **Lectura continua (activada)**: al agotarse la página virtual el flujo
  sigue a ritmo normal —sin la pausa de giro, sin animación de columna y sin
  aviso— y el cruce atómico con ancla conserva la posición: la columna nunca
  se interrumpe. La página virtual deja de ser un evento.
- **Modo clásico (desactivada)**: el comportamiento actual queda intacto
  (pausa de 2 s con aviso y barra de cuenta atrás, fundido de página de 450 ms
  en ambos sentidos). Ambas versiones conviven; la dueña decide con un
  interruptor (panel de configuración y sheet in-mode, tecla A).
- `plannedStepDelay` gana la opción `continuo`: en el borde de página con Auto
  devuelve el retardo normal del carácter en vez de `turnMs`. El motor no
  cambia de forma; el cruce sigue siendo el mismo `slide()` atómico.
- La pausa de 2 s del revelado **Instantáneo** (pageDone + Auto) se conserva
  incluso en continuo: ahí no hay ritmo de letras que proteger.
- El ajuste se aplica en caliente (cambiarlo dentro del modo no reconstruye la
  ventana ni toca el ancla; solo cambia el próximo cruce).

## Impact

- Affected specs: `teleprompter` (modifica «Encadenado de páginas»).
- Affected code: `src/lib/types.ts`, `src/lib/settings.ts` (v15),
  `src/lib/config-file.ts`, `src/lib/step-timer.ts`,
  `src/hooks/use-teleprompter-player.ts`,
  `src/components/reader/TeleprompterOverlay.tsx`,
  `src/components/reader/TeleprompterSettingsSheet.tsx`,
  `src/components/reader/ConfigPanel.tsx`, i18n es/en/pt.
- Tests: `step-timer` (cruce continuo sin pausa), `config-file` (saneo y
  defaults), `settings` (migración v14/v15 sin pérdida).
- Riesgos: ninguno estructural — el cruce atómico, la cámara, el rebobinado y
  el conteo de páginas no se tocan. En continuo desaparece la celebración de
  meta del aviso de página (es un evento de página); el conteo «hoy a/b» sigue
  en la cabecera del modo.
