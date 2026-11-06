<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Athena — reglas de la casa (para agentes y humanos)

Fuente de producto: `docs/PRODUCT.md` (la constitución). Convenciones
técnicas: `openspec/project.md`. Si algo de aquí choca con PRODUCT.md,
gana PRODUCT.md y se corrige este archivo.

## Qué es Athena (30 segundos)

Lector local-first de PDF/EPUB: servidor en tu PC (Next.js) + APK Android
offline (Capacitor). Sin cuentas, sin nube, sin telemetría. El producto es
**la última página**: riel de progreso, racha y ETA honesta que te devuelven
a leer hoy.

## Comandos

- Dev PC: `bun run dev` (offline, 127.0.0.1) / `bun run dev:lan` (0.0.0.0)
- Producción: `bun run build` + `bun run start` (o `start:lan`)
- Calidad: `bunx tsc --noEmit` · `bun run lint` · `bun test`
- DB: `bun run db:migrate` · `bun run db:push` · `bun run db:generate`
- APK: `bun run apk:sync` y luego `android/gradlew assembleRelease`
  (o dejar que lo compile GitHub Actions: workflow «Athena APK»)
- Linux: `bash scripts/package-linux.sh` (workflow «Athena Linux», tags v*)

## Idioma

- Código, comentarios, tests, commits, PRs, issues y CI: **inglés**.
- `README.md`: inglés (puerta pública del repo). `LEEME.md`: español.
  Mismo contenido en dos idiomas: si tocas uno, sincroniza el otro.
- Documentación de la casa (`docs/`, este archivo, `openspec/`): **español**.
  Los términos propios de la casa (*riel*, *insignias*, «la última página»)
  nacen en español y se traducen después, nunca al revés (ver PRODUCT.md).

## Estructura de directorios

- `src/app/` — páginas Next.js (App Router) y rutas API en `src/app/api/**`
  (auth, books, dictionary, library, progress, settings, teleprompter, vocab).
  Handlers finos: validan y delegan; la lógica vive en `src/lib/`.
- `src/lib/` — lógica de negocio compartida (server-side). Sus tests viven
  al lado: `foo.ts` + `foo.test.ts`.
- `src/components/`, `src/hooks/` — UI reutilizable (shadcn/ui + Tailwind).
- `public/athena-offline.js` — **motor offline del APK**. Espeja los
  contratos de `src/app/api/**` sobre IndexedDB/OPFS. No tocar sin
  actualizar `tests/offline-engine.test.ts` en el mismo PR.
- `tests/` — tests de integración (motor offline, contratos de API).
- `prisma/schema.prisma` — única fuente de verdad de la DB (SQLite en `db/`).
- `db/` y `public/uploads/` — estado real de la biblioteca. Jamás se commitean.
- `scripts/` — recetas de build/empaquetado (`build-apk-web.mjs`,
  `package-linux.sh`). Sin lógica de negocio aquí.
- `android/` — proyecto Capacitor/Gradle del APK. `android/keystore/` —
  firma del APK (riesgo y mitigaciones en `docs/SECURITY.md`).
- `docs/` — documentación de la casa (PRODUCT es la constitución).
- `openspec/` — convenciones técnicas del proyecto.
- NO crear carpetas de primer nivel sin añadir un párrafo que las describa aquí.

## Convenciones técnicas (de openspec/project.md)

- TypeScript strict, Bun como runtime, Next.js App Router.
- Tailwind para estilos; **sin objetos de estilo inline**.
- El schema de Prisma manda sobre la DB; todo cambio lleva su migración.
- Toda respuesta API sigue `{ ok: boolean, data?: T, error?: string }`.
  El motor offline replica ESTE contrato: si cambias una ruta API, cambias
  su espejo en `public/athena-offline.js` y sus tests en el mismo PR.

## Commits

- Conventional Commits en inglés: `feat:`, `fix:`, `refactor:`, `docs:`,
  `chore:`, `ci:`, `test:`.
- Primera línea de ≤ 72 caracteres, en imperativo («add», no «added»).
- Un commit = un cambio lógico coherente.
- Sin ruido de IA ni firmas automáticas en el mensaje.

## Ramas y PRs

- `main` siempre desplegable y en verde.
- Ramas de trabajo: `feat/<nombre>`, `fix/<nombre>`, `refactor/<nombre>`,
  `docs/<nombre>`, `chore/<nombre>` — siempre desde `main` al día.
- Nada se pushea directo a `main` salvo cambios triviales de docs.
- El resto vía PR (usa la plantilla) con el workflow **CI** en verde antes
  del merge.

## Antes de dar una tarea por terminada

1. `bunx tsc --noEmit` pasa.
2. `bun run lint` pasa.
3. `bun test` pasa.
4. ¿Tocaste `prisma/schema.prisma`? → migración creada
   (`bunx prisma migrate dev`) y `bunx prisma generate` ejecutado.
5. ¿Tocaste una ruta `src/app/api/**`? → actualiza su espejo en
   `public/athena-offline.js` y `tests/offline-engine.test.ts`
   (mismo contrato, mismo PR).
6. ¿Tocaste UI de lectura? → prueba de humo en el APK (o emulador),
   no solo en el navegador del escritorio.
7. ¿Tocaste el empaquetado? → `bun run apk:sync` (web estática del APK) o
   `bash scripts/package-linux.sh` (tarball Linux) según el destino.

## Prohibido

- Commitear secretos: `.env*` (salvo `.env.example`), tokens, `*.pem`,
  contraseñas nuevas. Excepción documentada: `android/keystore/` →
  `docs/SECURITY.md`.
- Commitear estado: `*.db`, `db/*`, `public/uploads/*`, `dev.log`,
  `server.log`, snapshots de estado del usuario.
- Introducir dependencias sin justificarlo en la descripción del PR.
- Cambiar el contrato `{ ok, data?, error? }` en un solo lado.
- Añadir features que contradigan `docs/PRODUCT.md` sin enmendarlo antes
  (las enmiendas van como sección fechada al final de PRODUCT.md).
- Editar `prisma/migrations/*` a mano; usa `bunx prisma migrate dev`.
