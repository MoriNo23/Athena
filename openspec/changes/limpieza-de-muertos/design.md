# Design

## Context

`scripts/` tiene ~80 archivos. La exploración previa y el grep de referentes confirman que la kill list concertada (~34 archivos) no aparece ni en `package.json`, ni en `LEEME.md`, ni en `src/`; su único referente es la documentación histórica (`docs/auditoria*`) que también sale del repo. Véase proposal.md para el porqué.

## Goals / Non-Goals

**Goals:**
- Repo sin tooling muerto: purgar la kill list concertada con evidencia por archivo, y resolver orbitados (scripts cuyo único referente era purgado).
- Dejar `docs/` y `LEEME.md` sin apuntadores rotos: solo doc viva del clon; graphify sin mención (tool externa del humano, se instala con `uv` aparte).
- Comprobar que nada vivo murió: lint + tsc + sondas canónicas en verde tras la purga.

**Non-Goals:**
- Quitar la mención genérica de LEEME:124 `scripts/ → utilidades y pruebas` (sigue siendo verdad; siguen quedando pruebas y utilidad).
- Volver a inventariar scripts NO concertados con cero referentes (`db-audit.js`, `check-extras.mjs`, `inspect-sofia-epub.ts`, `verify-fixes*.sh`, `test-tp-refactor-smoke.mjs`, `VERIFICACION-TELEPROMPTER.md`...): quedan listados en la auditoría (task 1.1) como "resto", fuera de alcance; los mata un change futuro si tocará.
- Purges en `src/`, cambios de producción, migraciones de datos.

## Decisions

1. **Lista cerrada = 36 archivos** (los 4 grupos concertados: debug-dock 5 + familia diag/diagnose/shot/capture/snap/scan/repro 16 + parches 2 + migraciones BD 7 + `test-vn-*`/`test-dead-keys` 4) **+ `probe-vn-speed.js` y `probe-vn-speed2.js`** (extensión menor: misma causa, VN muerto; el grupo concertado solo citaba `test-vn-*`). Alternativa descartada: inventariar todos los cero-referentes ahora — rompe lo concertado y mete Unit-tests en la duda.
2. **Regla de orbitados tras la purga**: se elimina todo archivo cuyo conjunto de referentes quede *solo* entre los purgados (p. ej. `cdp-capture.mjs`/`cdp-eval.mjs` si nadie fuera de `snap-and-detect.sh`/`run-captures.sh` los toca). Si un orbitado conserva referente en clase (a)-(c); se queda. La auditoría decide con la tabla de referentes.
3. **Minutería histórica: borrada, no "archivada" en el repo**. La historia de git es el archivo (recuperable con `git log --follow docs/<path>`). Alternativas descartadas: moverla a `openspec/changes/archive/` (mezcla artefactos de process con evidencia técnica) o destino fuera (`../atena-docs`) — recibido a petición del usuario al aplicar, pero el default es borrar con historia.
4. **graphify sale completo del repo** (2 scripts + mención en LEEME). La tool sigue siendo útil externamente; el repo no lleva el puente muerto.
5. **Verificación de vuelo sano post-purga**: `bun run lint`, `bunx tsc --noEmit`, y las sondas canónicas vigentes (`probe-flechas-tp.js` 9/9 y la suite unitaria de `test-step-timer.ts`/`test-page-notice.tsx`) — la casa verde demuestra que las herramientas vivas no dependían de nada purgado.
6. **Commit único** para toda la purga (revert directo).

## Risks / Trade-offs

- [Purgar algo vivo por dedo gordo] → task 1 produce tabla archivo→referentes con evidencia; cualquier archivo con referente vivo sale de la lista con nota.
- [Orbitado sobre-alcanzado: una sonda viva usaba un cdp-*] → la regla exige cero referentes fuera de lo purgado; la tabla lo demuestra antes de rm.
- [LEEME queda con apuntadores rotos] → task 2.5/3.2 limpian menciones y se re-escanea LEEME completo al final.
- [Doc histórica perdida si el repo no se conserva] → la historia de git la guarda; para clonares antiguos es local: hasta el usuario puede pedir copia fuera del repo al aplicar.

## Migration Plan

Un commit con `git rm` + ediciones de LEEME; verificación en el mismo commit; rollback = `git revert`. No hay datos ni runtime en juego.

## Open Questions

- Si el usuario quiere copia fsica de la doc histórica antes de borrarla (default: solo historia de git) → se pregunta en apply, no cambia artifacts.
