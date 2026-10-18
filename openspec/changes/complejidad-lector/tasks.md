# Tasks

## 1. TeleprompterOverlay

- [ ] 1.1 Extraer el control de reproducción (pausa/reanudar, rebobinado, cruce de página y encadenado) a un hook dedicado. Verificación: `bun scripts/test-teleprompter-engine.ts` verde y `node scripts/test-vn-stress.js` 21/21.
- [ ] 1.2 Extraer el seguimiento de scroll y la ventana de DOM si siguen dentro; guard clauses y mapas en los puntos que el lint señala. Verificación: lectura e2e manual de un EPUB largo sin jank y `bun run lint` sin warning de complejidad para el archivo.
- [ ] 1.3 Confirmar CC ≤ 30 en el componente. Verificación: `bun run lint` sin `complexity` para `TeleprompterOverlay.tsx`.

## 2. ReaderView

- [ ] 2.1 Extraer a hooks el estado/efectos por modo de visor (EPUB/PDF página/PDF texto) y la persistencia asociada. Verificación: alternar modos, saltar por el riel y reabrir conserva modo y posición (checklist e2e del lector).
- [ ] 2.2 Simplificar las condiciones que suman CC (incluidas `&&`/`||`/`??` en JSX) con guard clauses y mapas de objetos. Verificación: `bunx tsc --noEmit` limpio y `bun run lint` sin `complexity` para `ReaderView.tsx`.
- [ ] 2.3 Comprobar que la superficie no cambió. Verificación: captura rápida claro/oscuro del lector antes/después sin diferencias no intencionadas.

## 3. Regresión integrada

- [ ] 3.1 Corrida completa: `bunx tsc --noEmit`, `bun run lint` (0 warnings), `bun run crap` dentro de banda, `scripts/test-vn-stress.js` 21/21 y hotkeys e2e verdes. Verificación: salidas verdes anotadas en el change.

## Workflow follow-up

- Archivar el change cuando la métrica quede en banda y la suite verde.
