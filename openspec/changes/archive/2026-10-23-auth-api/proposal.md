# Proposal

## Why

La API de Atena está **abierta por completo**: 11 route files bajo `src/app/api` sin ningún control de acceso (grep maestro: 0 middleware, 0 token/API-key, 0 cookie — las únicas menciones "auth" son el campo `author`). En el self-host en LAN, **cualquier cliente de la red** puede subir libros, borrarlos (`DELETE /api/books/[id]`), corromper progreso (`PATCH /api/books/[id]/meta`, `/reset`) y, el más grave, **borrar TODAS las sesiones de lectura** con un solo `POST /api/progress/reset-all`. Los reads (`GET /api/books`) exponen la biblioteca y los hábitos de lectura. El servicio corre `next dev` expuesto a la red; le toca un candadocito mínimo.

## What Changes

- **Candado opt-in por contraseña**: cuando `ATENA_PASSWORD` esté seteada en `.env`, TODO `/api/*` exige autenticación (cookie httpOnly); sin la env, la API queda exactamente como hoy (dev, sondas y despliegues aislados no rompen). Se verifica con arreglo timing-safe.
- **Middleware `src/middleware.ts`**: guard único de `/api/*` → 401 JSON sin cookie válida. La sesión es un hash derivado de la contraseña (Sin tabla de sesiones ni dependencias nuevas).
- **`POST /api/auth/login`** (sin protección, con rate limit en memoria): recibe la contraseña y setea la cookie; la raíza `GET /api` (health) queda abierta.
- **Estado de acceso en la biblioteca**: si los fetch de la casa devuelven 401, la biblioteca muestra un candado mínimo con un input de contraseña (→ login → recarga de datos). Sin UI de login no hay UX completa: la página cargaría vacía.
- **Integración de probes/dev**: `scripts/with-dev.sh` fuerza `ATENA_PASSWORD` vacío para el servidor de sondas; nota en LEEME sobre la env (una línea).
- **No cambia** nada observable cuando la env no está seteada; specs sin cambio (skip_specs ya que el contrato de comportamiento nuevo es interno al despliegue self-host). **BREAKING** solo para quien ya publica el API con la env seteada (clientes sin cookie reciben 401 — comportamiento nuevo y deseado).

## Capabilities

### New Capabilities

(ninguna — skip_specs: true, patrón de la casa: contrato registrado en design/tasks de este change)

### Modified Capabilities

(ninguno)

## Impact

- Ámbito: `src/middleware.ts` (nuevo), `src/app/api/auth/login/route.ts` (nuevo), `src/hooks/use-library-books.ts` + un pequeño estado de lock en la biblioteca, `scripts/with-dev.sh`, `.env.example` + LEEME (una línea). **Sin** dependencias nuevas (crypto nativo), **sin** BD/sesiones/usuarios.
- Riesgo: (i) la contraseña viaja por HTTP plano en LAN — HTTPS queda a un reverse proxy, fuera de scope; (ii) cookies por-dispositivo: login por cliente; (iii) brute-force en LAN mitigado con rate limit mínimo en memoria, no con cuentas; (iv) la página `/` abre aunque la API esté cerrada (los datos son todos vía API — la página sin datos no filtra biblioteca).
- Rollback: quitar la env y volver al estado abierto; palancas independientes, una por commit.
