# Propuesta: salida standalone que vale por sí sola

## Por qué

El plan con la dueña llega a la fase 7: «salida standalone de Next.js».
La imagen Docker ya consumía `.next/standalone`, pero parcheándola a mano
(copiaba `prisma` + `.prisma` + `@prisma` al runner) y aun así quedaba rota
en arranque fresco: el CLI de Prisma necesita `@prisma/debug` y el resto de
su cierre, que no venía → `db push` del arranque se caía y el contenedor no
llegaba a levantarse. Y fuera de Docker no había camino solo-Node: o Bun con
repo completo (`next start`) o nada.

## Qué cambia

- `scripts/complete-standalone.mjs` — completa `.next/standalone` para que
  arranque por sí sola: cierre real de dependencias del CLI + cliente de
  Prisma (BFS sobre `node_modules` plano), esquema/migraciones y `start.sh`
  (BD: `ATHENA_HOME` manda, luego `ATHENA_DB`, luego junto al paquete; por
  defecto offline en 127.0.0.1; `db push` idempotente con degradación
  honesta si falla y ya hay BD).
- `scripts/build-standalone-bundle.mjs` — ensambla
  `dist/athena-standalone-<versión>.tar.gz` con lista blanca (server.js,
  node_modules, .next+static, public, prisma/, start.sh, LICENSE) e
  `INICIO.md`; la biblioteca personal NUNCA viaja (uploads vacío de
  fábrica, `evidencia/` fuera).
- `bin/athena bundle [dest]` — comando nuevo del CLI; help actualizado.
- `Dockerfile` — el builder ejecuta `complete-standalone.mjs` tras el build
  y el runner arranca con `start.sh` (mismo camino que el paquete); se
  quitan las 3 copias manuales de Prisma (insuficientes y ahora duplicadas).
- Tests: `tests/standalone-bundle.test.ts` (cierre de Prisma real,
  determinista, sin tipos ni dev; whitelist con lo imprescindible y sin
  restos del repo).
- Docs: `SELFHOSTING.md` §3c (camino solo-Node), `AGENTS.md` (comando y
  scripts).

## Que no se rompe nada

- El arranque con Bun del repo no cambia (`bun run start` / `bin/athena
  start` siguen con `next start`).
- La imagen Docker gana el arranque fresco que tenía roto (mismo CMD
  semántico, ahora con el cierre completo).
- Los datos: `start.sh` respeta `ATHENA_HOME` igual que `src/core/data-home.ts`
  (docker sigue fijando `DATABASE_URL` del volumen).
- `/dist/` ya estaba gitignoreada; el tarball no entra al repo.
