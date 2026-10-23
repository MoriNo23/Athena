# Design

## Context

See proposal.md — Why: la API entera queda abierta en LAN. Estado actual: 11 route files bajo `src/app/api`, **cero** middleware/token/cookie; el único middleware del proyecto `src/middleware.ts` **no existe aún**. El UI consume vía hooks (`use-library-books`, `use-reading-session`, …) con `fetch()` directo — `fetchBooks` trata el 401 como biblioteca vacía (`data.books ?? []`), así que el 401 sin UX sería un silencio corrupto. Las sondas (`scripts/probe-*.cjs`, `perf-*.cjs`) golpean la API con `fetch` plano y dependen del servidor de `with-dev.sh`. `.env` hoy solo tiene `DATABASE_URL`; LEEME documenta el setup como `cp .env.example .env`.

## Goals / Non-Goals

**Goals:**
- Un candado de un solo bolígrafo: `ATENA_PASSWORD` en `.env` protege todo `/api/*` (menos el health `GET /api` raíz y el propio login).
- Sobre el mismo cambio: UX mínima de desbloqueo en la biblioteca, soporte de sondas, doc en LEEME.
- Verificación por matriz HTTP (401/200 con y sin cookie, con y sin env) — el mismo estándar medido de la casa.

**Non-Goals:**
- Cuentas de usuario, roles, sesiones en BD, OAuth, reset de contraseña, logout (la cookie expira sola a 30 días; quitar el candado = borrar la env).
- HTTPS: queda al reverse proxy de quien norte; la contraseña viaja en HTTP plano en LAN (decision explícita).
- Proteger la página `/`: sin la API no entrega libros (los datos son todos vía API); el HTML prerenderizado no contiene biblioteca.
- Cambiar ningún handler existente: el candado vive en middleware, no en los 11 route files.

## Decisions

1. **(a) Opt-in por env + middleware raíza.** `src/middleware.ts` con matcher `/api/:path*` (excluye `/api` y `/api/auth/login`): si `process.env.ATENA_PASSWORD` está vacío → `next()` (comportamiento hoy); si está seteado → exige cookie `atena_session` cuyo valor sea el hash esperado. El valor de la cookie = `sha256(ATENA_PASSWORD + "atena-cookie-v1")` — sin tabla de sesiones, la expiración la porta la cookie (`maxAge` 30 días, httpOnly, sameSite lax, `secure:false` por LAN HTTP). Comparativa timing-safe entre los dos digests. Alternativas descartadas: (i) NextAuth/better-auth — tres dependencias y un modelo de usuario para un self-host de una persona; (ii) Basic Auth — re-centra el password en cada request y mata el UX del SPA; (iii) token en localStorage — XSS-able y los fetch de la casa no lo llevan hoy.

2. **Comparación en tiempo constante vía digest.** `sha256` de ambos lados y comparo los 32 bytes — evita `timingSafeEqual` sobre longitudes distintas. Runtime: middleware Node (`crypto.timingSafeEqual` nativo); si el runtime Edge del middleware en Next 16 obliga a WebCrypto, fallbackppers con comparación manual en tiempo constante (mismo contracto, ~10 líneas) — se fija en apply, es un detalle de runtime.

3. **Login como route handler propio:** `POST /api/auth/login` — cuerpo JSON `{ password }`; acierto setea cookie y devuelve 200; fallo 401. **Rate limit mínimo en memoria** (Map módulo-scope por IP: 10 intentos/minuto) — suficiente para LAN, sin store. Alternativa descartada: rate limit persistente (SQLite) — gravedad injustificada.

4. **(b) UX del desbloqueo casa-fork:** `useLibraryBooks.fetchBooks` distinguía 401 (`res.status === 401` → estado `locked: true` en vez de biblioteca vacía); el listado renderiza el estado de lock (title + input + botón, strings nuevos i18n `lib.lock*`) que POSTea y re-carga. El lector no es alcanzable sin cards, así el resto de hooks no necesitan manejar 401 (defensivo: consume la matriz de verificación del middleware).

5. **Sondas sin candado:** `with-dev.sh` fuerza `ATENA_PASSWORD=""` al levantar el servidor de sondeo — laboratorio siempre abierto. El despliegue real (`bun run dev` del usuario) lee su propia `.env`. Nota honesta en design: si algún día las sondas deben correr contra un server con candado, el helper de sondas hace login una vez y porta cookie (fuera de scope).

## Risks / Trade-offs

- [La contraseña en HTTP plano en LAN] → decisión explícita; HTTPS es del reverse proxy (Non-Goal). No amateur: alternativo TLS local desduplica esfuerzo por máquina.
- [Cookie ≠ sesión en BD]: quitar la env invalida todas las cookies de una (el hash esperado desaparece) — aceptable en self-host (no hay sesiones que preservar).
- [`secure:false`]: el cookie por HTTP leve la filtración por sniffing de LAN — trivial aceptado para self-host LAN; en HTTPS (si llega) un flag env `ATENA_SECURE_COOKIES` haría el cambio (no varied, una línea futura).
- [Brute-force] → rate limit en memoria + contraseña elegida por el propio dueño (el riesgo real es LAN-compartido, no internet).
- [CSP del fetch del lock]: el login es same-origin; sameSite=lax + no CORS headers mitigan CSRF write — suficiente para esta superficie.

## Migration Plan

1. Deploy = este repo self-host: workstation aligera la env (`ATENA_PASSWORD=...` en `.env`) y reinicia el dev server. Sin nada de BD, sin migración.
2. Rollback: borra la env y reinicia — estado exacto de hoy.

## Open Questions

(ninguno — el runtime del middleware Node-vs-Edge se resuelve en apply con el fallback ya definido en la decisión 2)
