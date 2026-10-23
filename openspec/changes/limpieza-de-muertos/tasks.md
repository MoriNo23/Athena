# Tasks

## 1. Auditoría con evidencia

- [x] 1.1 Tabla de referentes para los 36 de la kill list + candidatos a orbitado (`cdp-capture.mjs`, `cdp-eval.mjs`, `run-captures.sh`) + resto cero-referente (`db-audit.js`, `check-extras.mjs`, `inspect-sofia-epub.ts`, `verify-fixes*.sh`, `test-tp-refactor-smoke.mjs`, `VERIFICACION-TELEPROMPTER.md`): sweep completo repo (package.json, LEEME.md, docs/, src/, scripts/, .github/ si existe); classification por clase (a)-(c) o one-off del spec; lo vivo con referente **sale** de la lista con nota.
- [x] 1.2 Confirmar orbitados: bajo los purgados como conjunto, ¿algún candidato queda sin ningún referente en clase (a)-(c)? Decidir rm/queda con la tabla como evidencia.

## 2. Purga de scripts

- [x] 2.1 `git rm` grupo debug-dock: `test-debug-dock{.js,2.js,3.js,4.js}` + `test-dock-final.js` (5)
- [x] 2.2 `git rm` familia one-off: `diag-*` (5) + `diagnose-*` (4) + `shot-*` (3) + `capture-after-tinte.mjs` + `snap-and-detect.sh` + `scan-after-tinte.sh` + `repro-epub-contrast.js` (16 en total)
- [x] 2.3 `git rm` parches puntuales `i18n-tail-patch.py`, `patch-pdf-worker.py` (2) y migraciones BD `backup-state.mjs`, `restore-user-state.mjs`, `restore-user-state-v3.mjs`, `cleanup-dup-books.mjs`, `cleanup-task18.mjs`, `cleanup-task19.mjs`, `cleanup-e2e-sessions.mjs` (7)
- [x] 2.4 `git rm` modo muerto VN y dead keys: `test-vn-auto.js`, `test-vn-rebuild.js`, `test-vn-stress.js`, `test-dead-keys.js`, `probe-vn-speed.js`, `probe-vn-speed2.js` (6)
- [x] 2.5 `git rm` scripts graphify `run-graphify.sh`, `finish-graphify.sh`; quitar la línea `graphify-out/` de `LEEME.md` y CUALQUIER otra mención graphify en el repo (grep final en 4.1 lo re-verifica)
- [x] 2.6 Resolver orbitados decididos en 1.2 (`git rm` o conservan con nota en la tabla)

## 3. Minutería histórica fuera del repo

- [x] 3.1 `git rm -r` `docs/auditoria`, `docs/screenshots`, `docs/AUDITORIA-2026-10-19.md`, `docs/auditoria-impeccable.md` (antes de borrar: si el usuario pidió copia física, mover a su destino fuera del repo)
- [x] 3.2 `LEEME.md` y resto de doc viva: eliminar apuntadores rotos a lo purgado y re-verificar que `docs/` restante es solo doc viva

## 4. Reinventario y vuelo sano

- [x] 4.1 Re-auditoría (repetir 1.1): cero scripts one-off ni orbitados; sin menciones graphify; LEEME sin apuntadores rotos
- [x] 4.2 `bun run lint` y `bunx tsc --noEmit` en verde
- [x] 4.3 Sondas canónicas vigentes en verde: `probe-flechas-tp.js` (9/9) + suite unitaria `test-step-timer.ts` + `test-page-notice.tsx` — evidencia de que nada vivo dependía de lo purgado
- [ ] 4.4 Commit único de purga (diseño §6) con la tabla de evidencia de 1.1 en el mensaje
