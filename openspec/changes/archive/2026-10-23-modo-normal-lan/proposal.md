# Proposal: modo-normal-lan (modos de ejecución por comando + candado con contraseña autogenerada)

## Why

Hoy `next dev`/`next start` escuchan en **todas las interfaces** (0.0.0.0): cualquier
equipo del WiFi puede abrir la app, y la única protección posible era escribir
`ATENA_PASSWORD` a mano en `.env`. No hay forma de decir "ahora es privado (solo esta
máquina)" ni "ahora la comparto en LAN" sin editar archivos, y el candado opt-in
(auth-api) solo actúa si el usuario mantiene una contraseña en el `.env`.

## What Changes

- **Dos formas de arrancar por comando** (elegir el modo al lanzar, sin editar `.env`):
  - `bun run dev` / `bun run start` → **modo normal (default, no-LAN)**: escucha solo
    `127.0.0.1`; la red ni siquiera puede conectarse; sin candado de fábrica.
  - `bun run dev:lan` / `bun run start:lan` → **modo lan**: escucha en `0.0.0.0`
    (tablet, otro PC del WiFi) **con candado obligatorio**.
- **Candado en modo lan**: si `ATENA_PASSWORD` está en `.env`, se usa esa; si no,
  Atena **genera una contraseña aleatoria al primer arranque** (12 caracteres,
  la guarda en `db/atena-lock` —gitignorado—) y la **muestra por terminal**.
  La contraseña persiste entre reinicios (el cookie del navegador sigue válido).
- El candado pasa a resolver su contraseña efectiva en `src/lib/access.ts`
  (`contraseñaEfectiva()`): env fija > autogenerada (lan) > abierta (normal sin
  contraseña). `src/middleware.ts` y el login la consumen.
- El banner de arranque (`src/instrumentation.ts`) informa el modo y, en lan,
  la contraseña generada.
- **BREAKING** (comportamiento): el default de la app pasa de "todo abierto en la red"
  a "solo localhost". En modo normal, un `ATENA_PASSWORD` puesto también actúa.
- Sondas: `scripts/with-dev.sh` fuerza el modo normal/abierto para las pruebas.

## Capabilities

Ninguno — proyecto sin main specs (patrón `skip_specs`, igual que auth-api).

## Impact

- `package.json` (scripts `dev`/`start` + variantes `:lan`), `src/lib/access.ts`,
  `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `src/instrumentation.ts` (nuevo),
  `scripts/with-dev.sh`, `.env.example`, `LEEME.md`.
- Riesgo conectibilidad para usuarios LAN actuales: pasa de "cualquiera entra" a
  "entra con la contraseña del arranque" (mejora de seguridad pedida).
