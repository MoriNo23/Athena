# Candado completo y Athena — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el candado una páginas y API (página `/login` real + opción de
lan abierta), y que Atena pase a llamarse **Athena** en interfaz, códigos,
repo y capturas, sin romper ninguna instalación viva.

**Architecture:** La comprobación de candado vive en servidor: el middleware
redirige páginas sin cookie a `/login?next=…` y la API sigue 401; la lógica
pura (estricta) se concentra en `src/lib/access.ts` para poder probarla. El
renombrado toca ficheros, textos y códigos con *fallback de lectura* donde
hace falta (env, cookie, fichero de candado).

**Tech Stack:** Bun (y `bun test`, ya disponible — cero dependencias
nuevas), Next.js 16 middleware, TypeScript.

**Spec:** `openspec/changes/candado-completo-y-athena/proposal.md`

## Global Constraints

- Local-first: nada nuevo pide nube (demo de capturas se descarga a local, no
  se sube nada).
- Sin dependencias nuevas.
- Fallback de lectura: los códigos viejos (`ATENA_*`, `atena_session`,
  `db/atena-lock`) SIGUEN funcionando tras el cambio.
- Voz de la casa en español: *riel, insignias, estancias*. No se renombra la
  ciudad «Atenas» (ni sus usos en `types.ts`, `settings.ts` ni el libro
  «Cuaderno de Atenas»): solo la marca **Atena → Athena** con límite de
  palabra (`\bAtena\b`), jamás por subcadena.
- Historia congelada: `openspec/changes/archive/` no se toca.
- Los tests corren con `bun test` (ya instalado por Bun; *happy-dom* ya está
  como devDependency si hace falta).

## Review Focus

1. **Página con cookie expirada a mitad de sesión** → esperado: la siguiente
   petición redirige a `/login`, nunca una página a medio pintar. *Pinned por
   la sonda de la Tarea 7 + el redirect del middleware (Tarea 2).
2. **`?next=` malicioso** (`//evil.com`, `https://…`) → esperado: cae a `/`,
   jamás sale del dominio. *Pinned* por test de `siguienteSeguro` (Tarea 2).
3. **Matcher vs recursos estáticos** (`/favicon.ico`, `/uploads/x.png`,
   `/_next/...`) → esperado: nunca un redirect en recursos dot. *Pinned* por
   test de `esRecursoEstático` (Tarea 2).
4. **Instalación viva con `ATENA_PASSWORD`** → esperado: sigue con candado y
   su misma contraseña vía fallback. *Pinned* por test de
   `contraseñaEfectiva` (Tarea 1).
5. **Login loop** (`/login` con candado sin cookie sirviendo el formulario,
   nunca redirigiendo a sí mismo) → *Pinned* por la sonda de la Tarea 7.

---

### Task 1: `access.ts` — identidad del candado renombrada + lan abierta a elección

**Files:**
- Modify: `src/lib/access.ts`
- Test: `src/lib/access.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada nuevo (node:crypto, node:fs).
- Produces (para Tareas 2-4):
  - `contraseñaEfectiva(): string` (misma firma, nuevas reglas).
  - `COOKIE_SESION = "athena_session"`.
  - `ARCHIVO_CONTRASEÑA = "db/athena-lock"`.
  - `siguienteSeguro(v: string | null): string | null` — `/`-rutas relativas
    seguras, si no `null`.
  - `esRecursoEstático(pathname: string): boolean`.

**Reglas exactas de `contraseñaEfectiva()`** (en este orden):
1. `ATHENA_PASSWORD` no vacía → esa. Si no y `ATENA_PASSWORD` no vacía → esa
   (fallback legado). La contraseña explícita manda aunque haya `ABIERTO=1`.
2. modo (ATHENA_MODO ?? ATENA_MODO ?? "offline") === "lan":
   - `ATHENA_ABIERTO` o `ATENA_ABIERTO` === "1" → `""` (abierto).
   - resto → autogenerada persistida (como hoy).
3. resto → `""`.

**Reglas del fichero de candado:** leer `db/athena-lock`; si no existe pero sí
`db/atena-lock`, usar su contenido y escribirlo en `db/athena-lock` (solo en
creación, dentro de `garantizaContraseña()`).

- [ ] **Step 1: escribe el test que falla** — `src/lib/access.test.ts` con
  `bun test`: casos de arriba (guardar/limpiar `process.env` en cada test;
  para el fichero, `process.chdir` a un sandbox `tests/.sandbox/db` creado y
  limpio — jamás tocar el `db/` real).
- [ ] **Step 2: corre `bun test src/lib/access.test.ts`** — espera FAIL
  (helpers/rutas nuevas no existen).
- [ ] **Step 3: implementa** las reglas + renames en `access.ts`.
- [ ] **Step 4: `bun test src/lib/access.test.ts`** — PASS.
- [ ] **Step 5: commit** `candado: access renombra env/cookie/lock y gana ATHENA_ABIERTO`.

### Task 2: middleware protege páginas (no solo la API)

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/lib/access.ts` (solo si falta algún helper de la Tarea 1)

**Interfaces:**
- Consumes: `contraseñaEfectiva`, `COOKIE_SESION`, `igualEnTiempoConstante`,
  `esRecursoEstático`, `siguienteSeguro`.
- Produces: flujo de acceso con páginas protegidas (Nada más; la API igual
  que hoy).

**Reglas exactas del middleware** (con candado activo):
1. matcher: `{ matcher: ["/api/:path*", "/((?!_next/static|_next/image|api).*)"] }`
   (lo estático y `/favicon` se filtran EN CÓDIGO con
   `esRecursoEstático` — el matcher queda simple y testeable).
2. `/api/*` (salvo `/api` de salud y `/api/auth/login`): sin cookie → 401
   como hoy.
3. páginas: recurso estático → pasar; cookie válida → pasar (y si la ruta es
   `/login`, redirect `/`); sin cookie → redirect a
   `/login?next=<ruta+search>` (URL-encoded).
4. sin candado (sin contraseña efectiva): todo pasa, igual que hoy.

- [ ] **Step 1: test de `siguienteSeguro` y `esRecursoEstático` ya añadidos
  en la Tarea 1** — verifica cobertura (no dupliques casos aquí).
- [ ] **Step 2: implementa** el flujo en `src/middleware.ts`.
- [ ] **Step 3: `bun test src/lib/access.test.ts`** — PASS (helpers siguen
  verdes; el flujo de rutas se valida en la sonda de la Tarea 7).
- [ ] **Step 4: commit** `candado: el middleware protege también las páginas`.

### Task 3: página `/login` real + la puerta sale de la biblioteca

**Files:**
- Create: `src/app/login/page.tsx` (wrapper; metadatos mínimos), y
  `src/components/auth/LoginForm.tsx` (cliente: el cuerpo de `LockGate`).
- Delete: `src/components/library/LockGate.tsx`.
- Modify: `src/components/library/LibraryView.tsx` (fuera el gate incrustado
  y su `locked`), `src/hooks/use-library-books.ts` (fuera `locked`; en 401 →
  `window.location.assign("/login?next=" + encodeURIComponent(location.pathname))`).

**Interfaces:**
- Consumes: `siguienteSeguro` (validar `next`), textos i18n existentes sin
  claves nuevas (préstamo de los `lib.lock*`]: título, cuerpo, placeholder,
  botón, rate-limit, error: `lib.lockTitle`, `lib.lockBody`,
  `lib.lockPlaceholder`, `lib.lockButton`, `lib.lockRateLimit`,
  `lib.lockError`).Visual: pantalla completa centrada, sello de la casa,
  estilo `brutal-flat` del LockGate.
- Produces: `/login` navega al `next` validado tras login success.

- [ ] **Step 1: crea** la página y el formulario (move: no reescribas la
  lógica de `LockGate`).
- [ ] **Step 2: herramientas del hook y LibraryView**: elimina `locked` y el
  gate; añade el redirect-on-401.
- [ ] **Step 3: ver manual** con `bun run dev` + contraseña en `.env` (temp):
  `/` sin cookie redirige; `/login` válido entra; `?next=/` correcto; `//evil.com`
  cae a `/`; sesiones con `?next=//"evil.com"` nunca salen del host.
- [ ] **Step 4: commit** `candado: pagina /login y biblioteca sin gate incrustado`.

### Task 4: rebautizado Athena — visible, técnicos y assets

**Files (y sus límites):**
- `src/app/layout.tsx` (title "Athena — Termina tus libros", keywords),
  comentarios de marca en `src/lib/epub.ts`, `theme-provider.tsx`,
  `LibraryView.tsx` (`AtenaSeal → AthenaSeal`).
- ct *NO* renombrar* "Atenas" (ciudad/azul) en `types.ts`, `settings.ts`.
- `package.json`: `name: "atena" → "athena"`; scripts:
  `ATENA_MODO → ATHENA_MODO` (los cuatro).
- `src/instrumentation.ts`: lee `ATHENA_MODO`/`ATHENA_PASSWORD` (fallback
  `ATENA_*` — usar helpers de access.ts donde aplique) y mensajes
  ("db/athena-lock").
- `.env.example`: claves `ATHENA_*` + documentar `ATHENA_ABIERTO=1` (abierto
  en modo lan) y el fallback a las antiguas.
- `public/` renombrados con `git mv`: `atena-seal.svg → athena-seal.svg`,
  `brand/atena-wordmark.svg → brand/athena-wordmark.svg`,
  `atena-capa2-fachada.png → athena-capa2-fachada.png`,
  `atena-capa2-busto.png → athena-capa2-busto.png`; actualizar referencias
  en `src/app/layout.tsx`, `src/app/globals.css`, README/LEEME/docs.
- **Wordmark redibujado**: geometría exacta — mantener cabecera del fichero
  (aria-label "ATHENA", viewBox `0 0 408 120`); letras en pitch 68:
  A@10 (brand), T@78, **H@146** (`M146 20 L146 100 M190 20 L190 100
  M146 60 L190 60`, ink, miter), E@214, N@282, A@350 (los tres últimos
  reubicados sumando 68 a sus X actuales, tal cual está el estilo: grupos
  `brand`/`ink` intactos, N con bevel).
- Docs con `\bAtena\b → Athena`: README, LEEME, `docs/PRODUCT.md`,
  `docs/DESIGN.md`, `docs/ROADMAP.md`, prosa de `openspec/specs/`
  (`grep -rl` con límite de palabra; el archive fuera).

- [ ] **Step 1: renames de ficheros con `git mv`** y update de referencias
  (grep hasta que `grep -rn "atena-seal\|atena-wordmark\|atena-capa2" src` sea vacío).
- [ ] **Step 2: redibuja el wordmark** con la geometría de arriba.
- [ ] **Step 3: textos de marca** (límite de palabra) en src + docs + specs.
- [ ] **Step 4: env/scripts/package.json/instrumentation** con fallbacks.
- [ ] **Step 5: verificación**: `grep -rn "\bAtena\b" src docs *.md --exclude-dir=archive` vacío
  (salvo las válidas conservadas "Atenas"), `bun run lint` verde, `bun test` verde.
- [ ] **Step 6: commit** `athena: rebautizo visible, códigos con fallback y wordmark`.

### Task 5: renombrar el repo en GitHub

**Files:**
- Modify: `README.md` (solo el `git clone` URL).
- Remote GitHub: `MoriNo23/atena → MoriNo23/Athena`.

**Interfaces:**
- Consumes: sesión gh autenticada (`GITHUB_TOKEN`, scopes `repo`).
- Produces: URL canónica nueva; la vieja redirige (GitHub automático).

- [ ] **Step 1: `gh repo rename Athena -R MoriNo23/atena`** (solo cuando el
  árbol esté commiteado y limpio — renombrar con el change ya en history
  local evita pushes sobre un remote recién renombrado).
- [ ] **Step 2: `git remote set-url origin https://github.com/MoriNo23/Athena.git`**
  y editar el `git clone` del README.
- [ ] **Step 3: curl la URL nueva** (`https://api.github.com/repos/MoriNo23/Athena`)
  — 200, y `https://api.github.com/repos/MoriNo23/atena` → 301.
- [ ] **Step 4: commit** `athena: url de clon correcta tras el rename` + push de base.

### Task 6: capturas con libros en inglés (biblioteca demo desechable)

**Files:**
- Create (y luego borrar): `db/demo.db`, ficheros en `public/uploads/` de los
  libros demo, `tests/` propio de la sonda (si aplica).
- Replace: `.github/assets/library-dark.png`, `library-light.png`,
  `teleprompter-dark.png`, `teleprompter-light.png`.
- Modify: `README.md` (las 4 tablas de capturas ya apuntan a los mismos paths:
  no cambia el markdown, solo los PNG).

**Interfaces:**
- Consumes: API normal de la app corriendo con BD demo.
- Produces: 4 capturas nuevas que muestran Athena (marca visible) con libros
  en inglés junto a los de la casa.

**Decisión exacta de libros demo** (dominio público, EPUB desde Gutenberg):
1342 Pride and Prejudice, 84 Frankenstein, 2680 Meditations (En/George Long);
URLs `https://www.gutenberg.org/cache/epub/<id>/pg<id>.epub`. El marca/captura
oculta los datos de la dueña: los libros de su casa NO entran en esta
captura (la demo va sola).

- [ ] **Step 1: arranca instancia demo**: BD demo
  (`DATABASE_URL=file:../db/demo.db` + `bun run db:push`), modo normal (sin
  candado), puerto 3001 (`bunx next dev -p 3001`), `ATHENA_PASSWORD` sin
  definir.
- [ ] **Step 2: upload** de los tres EPUB con `curl` a
  `POST /api/books` (`src/app/api/books/route.ts`, el mismo endpoint del
  drag&drop, cuerpo multipart) y una entrada por fichero. Portadas: las
  resuelve el buscador de la casa sin pasos extra.
- [ ] **Step 3: capturas** con `npx playwright screenshot` (chromium: la
  primera vez instala `npx playwright install chromium`):
  library-dark (tema noche default), library-light (tema día),
  teleprompter-dark (página en curso por letra del libro inglés \a mate),
  teleprompter-light. Viewport 1280x800; espera carga completa (timeout 4000).
  OJO: si el download del browser fallara en este entorno, plan B: la dueña
  las saca en su máquina con este mismo checklist (marcarlo al reportar).
- [ ] **Step 4: reemplaza los 4 PNG** manteniendo nombres originales.
- [ ] **Step 5: limpia la demo**: paras el server, borras `db/demo.db` y los
  uploads demo (queda la BD de la dueña intacta).
- [ ] **Step 6: commit** `atena→athena: capturas nuevas con libros en inglés`.

### Task 7: verificación final (route matrix)

**Files:** working tree limpio; ninguna modificación de código  
(norma: las correcciones que salten aquí vuelven a su tarea correspondiente).

**Interfaces:** solo lo previsto por las Tareas 1-6.

**Matriz exacta (sonda con curl y dev-server corriendo):**

| Arranque | Ruta | Sin cookie | Cookie válida |
|---|---|---|---|
| modo normal (sin password) | cualquier | abre | abre |
| `ATHENA_PASSWORD=x` normal | `/` | 307 → `/login?next=%2F` | abre |
| idem | `/login` | sirve la puerta | 307 → `/` |
| idem | `/api/books` | 401 | 200 |
| idem | `/login?next=//evil.com` | sigue, login → destino `/` | — |
| `ATHENA_MODO=lan ATHENA_ABIERTO=1` | `/` y `/api/books` | abre (sin candado) | — |
| `ATENA_PASSWORD=x` legacy con ATHENA unset | `/` | 307 (candado legado) | abre |

- [ ] **Step 1: corre la matriz** con `curl -i` (cookies manuales) en cada
  arranque listado.
- [ ] **Step 2: `bun test`** — todo PASS.
- [ ] **Step 3: `bun run lint`** — sin errores.
- [ ] **Step 4: `bun run build`** — la app compila.
- [ ] **Step 5: commit final (si algo pendiente)** y push del branch.
