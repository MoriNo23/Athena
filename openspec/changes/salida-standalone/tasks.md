# Tasks: salida-standalone

## 1. Completar la salida standalone

- [x] 1.1 `scripts/complete-standalone.mjs`: `cierrePrisma` (BFS sobre
      node_modules plano desde `prisma`, `@prisma/client`, `.prisma/client`;
      sin @types, determinista) + `completarStandalone` (copia idempotente
      del cierre, esquema/migraciones y `start.sh` con mode 0755)
- [x] 1.2 `start.sh`: PORT/HOSTNAME/ATHENA_MODO con defaults honestos
      (offline · 127.0.0.1), BD por ATHENA_HOME → ATHENA_DB → junto al
      paquete, `db push --skip-generate` con degradación si ya hay BD

## 2. Artefacto desplegable

- [x] 2.1 `scripts/build-standalone-bundle.mjs`: whitelist `ENTRA` +
      estáticos del cliente + uploads/evidencia fuera + `INICIO.md` +
      tarball `dist/athena-standalone-<versión>.tar.gz`
- [x] 2.2 `bin/athena bundle [dest]`: valida build y Node, delega en el
      script; help del CLI actualizado (y rango del sed)

## 3. Docker alineado

- [x] 3.1 Dockerfile: builder ejecuta `complete-standalone.mjs`; runner
      sin copias manuales de Prisma; `CMD ["sh", "start.sh"]`

## 4. Tests y docs

- [x] 4.1 `tests/standalone-bundle.test.ts`: cierre con el hueco real
      (@prisma/config, @prisma/engines, @prisma/debug), paquetes existentes
      en disco, determinismo sin tipos; whitelist con imprescindibles y sin
      restos del repo
- [x] 4.2 `docs/SELFHOSTING.md` §3c (camino solo-Node) + `bin/athena bundle`
      en §3b; `AGENTS.md` (comandos y scripts)
- [x] 4.3 Gate: `bunx tsc --noEmit` · `bun run lint` · `bun test` (153, 0 fallos)
- [x] 4.4 Prueba real: `bin/athena bundle` → tar.gz → extraer fuera del repo
      → `sh start.sh` (db push crea db/ + config.json, server arriba) →
      `/` 200 y `/api/books` `{"books":[]}`; binding verificado en 127.0.0.1
      (HOSTNAME solo se fija si no viene del entorno: bash lo predefine y el
      default de localhost no se aplicaba — corregido con printenv)
- [ ] 4.5 Publicar el tar.gz junto al APK en la página de releases de la
      próxima versión (lo hace la dueña al cortar el release)
