# Tasks

## 1. Observación: línea de base del candado

- [x] 1.1 Matriz HTTP actual con curl (evidencia de cuánto está abierto): `GET /api/books`, `POST /api/progress/reset-all`, `PATCH /api/books/[id]/meta` con y sin cookie — hoy todo 200.
- [x] 1.2 Confirmar runtime del middleware en Next 16 con un middleware de prueba (edge vs Node): decidir comparación nativa con `crypto.timingSafeEqual` o el fallback manual constante (design §2) — antes de escribir el guard real.

## 2. (a) Núcleo del candado

- [x] 2.1 `src/middleware.ts`: matcher `/api/:path*` con exclusiones (`/api`, `/api/auth/login`); `ATENA_PASSWORD` vacío → abierto (comportamiento actual); seteado → exige cookie `atena_session` con el hash esperado (comparación timing-safe de digests; 401 JSON de error).
- [x] 2.2 `src/app/api/auth/login/route.ts`: POST JSON `{ password }` con rate limit mínimo en memoria (10/min por IP), set cookie 30 días httpOnly sameSite lax; `GET /api` (health) sigue abierto.
- [x] 2.3 Matriz HTTP con curl: sin env = la casa tal cual (regresión); con env: 401 sin cookie / 401 con cookie mala / 200 con cookie; login golpeado en bucle → el rate limit responde (429 o 401 rápido, según el Map).

## 3. (b) UX de desbloqueo en la biblioteca

- [x] 3.1 `useLibraryBooks.fetchBooks`: 401 → estado `locked: true` (no biblioteca vacía silenciosa); strings i18n `lib.lock*` (título/placeholder/botón) en el dictionary.
- [x] 3.2 Componente de lock mínimo en la vista de biblioteca (input + botón → `POST /api/auth/login` → éxito re-fetchea; fallo muestra el mensaje de error al usuario).
- [x] 3.3 Sonda de browser (dev con la env del candado seteada en un arranque aparte): el lock aparece al abrir, la contraseña desbloquea y las cards vuelven; 0 pageerror/console.

## 4. Sondas y documentación

- [x] 4.1 `scripts/with-dev.sh`: fuerza `ATENA_PASSWORD=""` en el servidor de sondas; las sondas existentes quedan verdes (regresión verificada con la matriz de 2.3).
- [x] 4.2 `.env.example` + LEEME: una línea de env con su riesgo LAN y la nota HTTPS/reverse proxy.

## 5. Cierre

- [x] 5.1 `bun run lint` + `bunx tsc --noEmit` en verde.
- [x] 5.2 Commits por palanca con la matriz antes/después (curl base + matriz del candado) y push.
