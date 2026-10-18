# Proposal

## Why

`CRAPPER.md` fija el objetivo de complejidad para componentes de vista (CC ≤ 30, tope duro 50) y hoy hay dos que lo cruzan: `ReaderView` (CC **50**, justo en el tope) y `TeleprompterOverlay` (CC **33**). Son los 2 únicos warnings de lint del repo, están en la peor banda del medidor («30+ complejo») y viven en los dos archivos que cualquiera debe entender para tocar el lector.

## What Changes

- **`TeleprompterOverlay`**: extraer el control de reproducción (pausa/reanudar, rebobinado, cruce de página y encadenado) y el seguimiento de scroll a hooks; el componente queda como composición visual.
- **`ReaderView`**: extraer a hooks el estado/efectos por modo de visor y la persistencia asociada; guard clauses y mapas de objetos donde el CC se acumula.
- **Sin cambios de comportamiento**: la red es la suite existente (motor del teleprompter, estrés 21/21, hotkeys e2e) más `bun run lint` sin warnings.

## Capabilities

### New Capabilities

(Ninguna.)

### Modified Capabilities

(Ninguna: refactor puro sin cambio de comportamiento; el change se marca `skip_specs` en `.openspec.yaml`.)

## Impact

- `src/components/reader/ReaderView.tsx`, `src/components/reader/TeleprompterOverlay.tsx` y hooks/subcomponentes nuevos en `src/hooks/` y `src/components/reader/`.
- Sin cambios de UI, datos ni dependencias.
