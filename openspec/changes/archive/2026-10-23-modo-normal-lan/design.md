# Design: modo-normal-lan

## §1 — El modo lo decide el comando, no una variable nueva

Tres estados posibles del servidor y su origen:

| Comando | Bind | Candado | Cómo se fija |
|---|---|---|---|
| `bun run dev` / `start` | `127.0.0.1` | abierto (salvo `ATENA_PASSWORD` puesta) | script fija `ATENA_MODO=offline` + `-H 127.0.0.1` |
| `bun run dev:lan` / `start:lan` | `0.0.0.0` | `ATENA_PASSWORD` o autogenerada | script fija `ATENA_MODO=lan` + `-H 0.0.0.0` |

- El script de marcos (`package.json`) pone en la misma línea el `-H` y el
  `ATENA_MODO` (shell de npm/bun admite `VAR=x cmd`). Verificación en apply (task 1.2)
  antes de escribir los definitivos: confirmar que el env-prefix sobrevive al runner.
- Sin `ATENA_MODO` (alguien lanza `next dev` a mano), el helper del candado
  asume **offline** (safe-by-default). El bind queda como venga — solo la lógica
  del candado lee el env.
- Sin introducir `ATENA_PASSWORD=""` como señal de "abierto" (se elimina
  esa sutileza de auth-api): abierto = modo normal sin contraseña puesta.

## §2 — `contraseñaEfectiva(): string` en `src/lib/access.ts`

Semántica final (middleware y login consumen la misma función):

1. `ATENA_PASSWORD` no vacía → esa contraseña (candado, cualquier modo).
2. Si no, `ATENA_MODO=lan` → **autogenerada**: `randomBytes(9).toString("base64url")`
   (12 chars), persistida en `db/atena-lock` con creación `wx` (race-free) y
   `mode 0o600`. Si el archivo ya existe, se reutiliza (el cookie de 30 días del
   navegador sigue válido tras reinicios; no se regenera cada boot).
3. Cualquier otro caso (`offline` sin password, `""`, unset) → `""` = abierto.

`igualEnTiempoConstante` y `cookieDe` quedan igual (contraseña generada entra
por el mismo camino).

## §3 — Banner de arranque: `src/instrumentation.ts`

`export async function register()` (Next 16, estable):
- lee el modo; si lan sin contraseña fija → garantiza el archivo (`garantizaContraseña()`
  reutilizado por el helper) y **imprime la contraseña por terminal**:
  `🔒 Modo lan · contraseña de la biblioteca: <pw> (guardada en db/atena-lock · fija la tuya con ATENA_PASSWORD en .env)`.
- lan con contraseña fija → `🔒 Modo lan · usando ATENA_PASSWORD del .env` (sin
  imprimirla).
- normal → `🏠 Modo normal · solo localhost` (y una nota si hay ATENA_PASSWORD
  actuando en local).
- El banner es informativo; el candado no depende de él (si instrumentation no
  corre, el helper del §2 garantiza el archivo bajo demanda en request).

## §4 — Migra/semántica del login existente

- El 400 "No hay candado configurado" pasa a responder solo en modo normal
  abierto; mensaje: "Sin candado: este arranque solo es accesible desde este equipo".
- El 401 del guard y el flujo del LockGate (UX del change auth-api) no cambian.

## §5 — Riesgos y notas

- **HTTP plano en LAN**: igual que auth-api documentó — la cookie viaja sin cifrar;
  a internet con HTTPS por reverse proxy. Se actualiza la nota del LEEME.
- **Archivo de contraseña en texto plano** (`db/atena-lock`, chmod 600, gitignorado):
  asumido para self-host local (como lo es el `.env` en esta casa; no pretendemos
  un gestor de secretos).
- **Borrado del archivo** = contraseña nueva al siguiente arranque lan (comportamiento
  esperable; cookies antiguas quedan inválidas).
- **Sondas**: `with-dev.sh` fuerza modo normal (export de `ATENA_MODO=offline`),
  que abre el candado de fábrica — sustituye el forcing `ATENA_PASSWORD=""` de
  auth-api (se elimina, ya no tiene sentido).
- **Bare `next dev`** (sin scripts) escucha 0.0.0.0 como hoy pero el candado
  predice offline-abierto: quedará abierto… excepto si alguien elige `-H` lan a
  mano. Nota en LEEME: "usa siempre `bun run dev[:lan]`".

## §6 — Descartado

- `ATENA_MODO` editable por .env como fuente de modo (el comando es la fuente;
  el env queda como detalle interno del script).
- Prompt interactivo al arrancar (duplicaría el valor del comando `:lan`).
- Cambio de contraseña desde la UI, multiusuario, hashing de la contraseña del
  archivo (el archivo es local y chmod 600; fuera de alcance).
