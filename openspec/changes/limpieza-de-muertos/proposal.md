# Proposal

## Why

`scripts/` acumula ~80 archivos: sondas de un incidente, diagnósticos puntuales, parches ya aplicados y migraciones de BD para estados históricos que ya no existen. El modo VN está muerto en `src/` desde hace varios commits, y sus huérfanos de script siguen ahí (~36 archivos con **cero referentes vivos**). Además el repo carga documentación histórica (`docs/auditoria`, `docs/screenshots`, dos informes de auditoría fechados) y la mención de `graphify-out` en LEEME apunta a una herramienta externa cuyos scripts puente quedaron muertos. Ahora que los dos changes previos están archivados es el momento de dejar el repo como un clon limpio.

## What Changes

- **BREAKING** (solo para tooling interno): borrar los 36 scripts one-off de la kill list concertada (ver design.md §Decisions), cuyos únicos referentes son la documentación histórica que sale del repo.
- Borrar `scripts/run-graphify.sh` y `scripts/finish-graphify.sh` (graphify es tool externa del humano, no del repo; ya no se menciona en LEEME).
- Sacar del repo la minutería histórica: `docs/auditoria`, `docs/screenshots`, `docs/AUDITORIA-2026-10-19.md` y `docs/auditoria-impeccable.md` (recuperables por historia de git).
- Resolver "orbitados": scripts vivos cuyo único referente era un script purgado (p. ej. `cdp-*`, `run-captures.sh`) se purgan con la misma justificación.
- Ajustar `LEEME.md`: quitar la línea de graphify-out y cualquier apuntador roto tras la purga.
- **No toca** `src/`, `package.json` (la kill list no aparece en sus scripts), las sondas canónicas vigentes ni las pruebas unitarias del proyecto.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `build-hygiene`: añade 2 requisitos a la spec existente — solo herramientas vivas en `scripts/` (con regla para matar a los one-off y a los orbitados) y minutería histórica fuera del repo. La capability ya trata de un clon limpio sin peso muerto; esto extiende el alcance de deps/lockfile/build a archivos muertos y documentación histórica.

## Impact

- Ámbito: `scripts/` (~38 archivos menos), `docs/` (4 items menos), `LEEME.md` (1-2 líneas), `openspec/specs/build-hygiene/spec.md` (+2 requisitos). Ningún archivo de producción (`src/`) ni de configuración cambia.
- Riesgo: borrar algo vivo por error → mitigado con auditoría de referentes con evidencia pre-purga (task 1) y verificación post (`lint`, `tsc`, sondas canónicas, tasks 4).
- Rollback: la purga es un commit único git → `git revert` la restaura completa.
