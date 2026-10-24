# Proposal — candado completo y Athena

## Why

El 24-10 la dueña decidió la dirección del roadmap (**otros montan su casa**)
y pidió tres cosas para ya:

1. **La puerta solo bloquea los libros.** El candado vive en `src/middleware.ts`
   con matcher `/api/:path*` — las páginas renderizan enteras: cabecera, cardi,
   estilos, riel vacío. El visitante LAN/túnel ve la interfaz muerta por dentro.
   Como ella misma lo dijo: «algo muy regular».
2. **Modo lan sin contraseña a elección.** Hoy `contraseñaEfectiva()` genera
   una aleatoria obligatoria en lan (`db/atena-lock`); quien quiera su lan
   abierta no tiene camino.
3. **La marca pasa a Athena.** La dueña quiere la grafía griega completa
   (Atena → **Athena**) en todo lo que se ve y en los códigos técnicos, y
   capturas realmente nuevas con libros en inglés en las demos públicas.

## What Changes

### 1. Candado: la interfaz entera se pausa (enfoque A, aprobado)

- Página real **`/login`**: el `LockGate` se promueve a pantalla completa
  (reusa sus textos i18n y estilo). Formulario cómodo: foco al campo,
  Enter envía, error visible, misma pastilla de error de rate-limit.
- **Middleware protege también las páginas**: matcher extendido a todo path
  salvo `/_next*`, ficheros de extensión (`.*\.\w+$`), `/favicon*` y la propia
  `/login`. Con candado y sin cookie válida → redirect a
  `/login?next=<ruta>`. La API sigue como hoy (401 en `/api/*`, abiertas
  `/api` de salud y `/api/auth/login`).
- **`next` validado**: solo rutas relativas que empiezan por `/` (sin `//`),
  para no fabricar una redirección abierta.
- `/login` con cookie válida → redirect a `/` (no se enseña el formulario
  a quien ya entró).
- **La sesión no cambia**: cookie `httpOnly` de 30 días que ya recuerda el
  navegador.

### 2. Modo lan abierta a elección

- Nueva variable **`ATHENA_ABIERTO=1`** en el `.env`: modo lan **sin candado**
  (contrae lo que hoy es obligatorio). La decisión explícita de la dueña.
- Orden de decisión de `contraseñaEfectiva()`:
  1. `ATHENA_PASSWORD` (o antiguo `ATENA_PASSWORD`) no vacía → esa manda,
     aunque haya `ATHENA_ABIERTO=1` (la contraseña explícita gana).
  2. modo lan + `ATHENA_ABIERTO=1` → abierto, sin contraseña.
  3. modo lan sin lo anterior → autogenerada persistida (como hoy).
  4. modo normal sin password → abierto (como hoy).
- LEEME actualizado: los dos modos (normal/lan) y las tres salidas posibles
  del candado (abierta / contraseña / autogenerada).

### 3. Renombrado completo Atena → Athena (opción A de la dueña)

- **Visible**: cabecera/sello de la interfaz, título de la página, capturas y
  `public/`: `atena-seal.svg → athena-seal.svg`,
  `atena-wordmark.svg → athena-wordmark.svg`, `atena-capa2-*.png → athena-*`.
- **Wordmark redibujado**: hoy deletrea A-T-E-N-A en trazo monoline dibujado a
  mano (no es texto). Se redibuja como **A-T-H-E-N-A** insertando la H en el
  mismo estilo (grosor y capas idénticos, re-espaciando las seis letras),
  `aria-label` incluida. El sello no lleva letras: solo se renombra el fichero.
- **Técnicos con fallback de lectura** (ninguna instalación viva se rompe):
  - env: se leen `ATHENA_PASSWORD` / `ATHENA_ABIERTO` / `ATHENA_MODO`; si no
    existen, rige el antiguo `ATENA_*`. `.env.example` ya nace en Athena.
  - cookie: `atena_session → athena_session` (la sesión vieja simplemente
    pide login una vez).
  - fichero de candado: `db/athena-lock`; si no existe pero sí el antiguo
    `db/atena-lock`, se lee y se transcribe.
- `package.json`: `name: "atena" → "athena"` (la descripción ya habla de la
  casa).
- **Repo renombrado**: `github.com/MoriNo23/atena` →
  `github.com/MoriNo23/Athena` con `gh repo rename` (sesión de la dueña ya
  autenticada); se actualiza el remoto local y el `git clone` del README.
  GitHub mantiene redirección automática desde la URL antigua: los clones
  existentes siguen funcionando.
- **Historia congelada**: `openspec/changes/archive/` no se toca. Lo que se
  edita: README, LEEME, `docs/` (PRODUCT, DESIGN, ROADMAP), spec actual que
  mencione el nombre y textos de interfaz.
- La voz de la casa sigue en español: *riel*, *insignias*, estancias. Solo
  cambia el nombre propio.

### 4. Capturas nuevas con libros en inglés

- Biblioteca de demo en **BD desechable** (nada entra a `db/custom.db`):
  2-3 clásicos de dominio público en inglés puestos al lado de los libros de
  la casa en las cuatro capturas (biblioteca y teleprompter, noche y día).
- Se reemplazan `README.md / .github/assets/library-{dark,light}.png` y
  `teleprompter-{dark,light}.png` con el nombre Athena bien puesto.
- Ficheros de la demo se borran al terminar; las capturas viven solo en
  `.github/assets/`.

## What already exists (no se repite trabajo)

- Contraseña efectiva, cookie derivada, comparación en tiempo constante
  (`src/lib/access.ts`), route `/api/auth/login` con cookie de 30 días,
  rate-limit del login, textos i18n del candado en es/en/pt,
  `LockGate.tsx` funcionando.

## Impact

- Ámbito: `src/middleware.ts`, `src/app/api/auth/login/`, nueva
  `src/app/login/page.tsx`, `src/lib/access.ts`, `LibraryView.tsx`
  (fuera el gate incrustado), textos de marca en `src/app` y
  `src/components`, recursos `public/`, `.env.example`, `package.json`,
  README/LEEME/docs, y scrípt de demo para las capturas.
- **Riesgo de rutas**: el matcher nuevo debe dejar pasar los recursos
  estáticos y `/login`; se comprueba con la app andando (noche real:
  login → biblioteca → lector → teleprompter).
- Sin dependencias nuevas.
