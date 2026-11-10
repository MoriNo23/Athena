# Athena — reglas de la casa (para agentes y humanos)

## Qué es Athena (30 segundos)

Lector local-first de PDF/EPUB: servidor en tu PC (Vite + React + Express)
+ APK Android offline (Capacitor). Sin cuentas, sin nube, sin telemetría.
El producto es **la última página**: riel de progreso, racha y ETA honesta
que te devuelven a leer hoy.

## Comandos

- Dev: `bun run dev` (offline) / `bun run dev:lan` (lan) — API (Bun) en 3001
  + web (Vite) en 3000 que la proxya.
- Producción: `bun run build` (vite + esbuild → `dist/` + `server-dist/`)
  y `bun run start` / `start:lan` (Node sirve web + API en el 3000).
- CLI de la casa: `bun run athena init|start|doctor|backup|bundle|home|migrate-home`
  (o `./scripts/athena`); gestiona ATHENA_HOME — ver `src/core/data-home.ts`.
- Standalone solo-Node: tras el build, `./scripts/athena bundle` produce
  `release/athena-standalone-<versión>.tar.gz` (sin node_modules dentro).
- Calidad: `bunx tsc --noEmit` · `bun run lint` · `bun test`.
- APK: `bun run apk:sync` y luego `android/gradlew assembleRelease`
  (o dejar que lo compile GitHub Actions: workflow «Athena APK»).
- Linux: `bash scripts/package-linux.sh` (.tar.gz) y
  `bash scripts/package-deb.sh` (.deb) — workflow «Athena Linux» (tags v*).

## Idioma

- Código, comentarios, tests, commits, PRs, issues y CI: **inglés**.
- `README.md`: inglés (puerta pública del repo).
- Documentación de la casa (este archivo): **español**. Los términos propios
  (*riel*, *insignias*, «la última página») nacen en español y se traducen
  después, nunca al revés.

## Estructura de directorios

- `index.html` / `login.html` — entradas de Vite (app y puerta del candado).
- `vite.config.ts` — SPA React; en `--mode apk` compila sin login para el APK.
- `server/` — el servidor Express: `index.ts` (candado, estáticos, arranque)
  y `api.ts` (todas las rutas `/api/**`). Handlers finos: validan y delegan.
- `src/core/` — el núcleo único: reglas y contratos de la casa (tipos del
  dominio, riel/racha/ETA, candado, casa de datos, contrato `db/config.json`,
  papelera con deshacer, motores EPUB y PDF-texto, timing del teleprompter,
  gestos del dedo). Sin Express, React, SQLite, PDF.js ni zustand: eso es
  pegamento. Sus tests viven al lado: `foo.ts` + `foo.test.ts`.
- `src/lib/` — pegamento con terceros y estado de UI: SQLite (`db.ts`, la
  capa de datos sin ORM), PDF.js (`pdf-client.ts`), Tesseract (`ocr.ts`),
  cámara (`camera.ts`), i18n, store de ajustes (zustand), CORS de la copia
  (`cors.ts`).
- `src/components/`, `src/hooks/` — UI reutilizable (shadcn/ui + Tailwind).
- `public/athena-offline.js` — **motor offline del APK**. Espeja los
  contratos de `server/api.ts` sobre IndexedDB/OPFS. No tocar sin actualizar
  `tests/offline-engine.test.ts` en el mismo PR. Lleva además el módulo
  `sync` de la copia de la casa (Enmienda 1): sus reglas de fusión viven
  espejadas en `src/core/sync.ts`.
- `tests/` — tests de integración (motor offline, contratos de API).
- `scripts/` — recetas de build/empaquetado (dev, build-server, apk,
  standalone, tarball/.deb) y el CLI `scripts/athena`. Sin lógica de
  negocio aquí. `sync-pdfjs.mjs` deja los recursos de pdf.js en
  `public/pdfjs/` (gitignored: salen de node_modules).
- `android/` — proyecto Capacitor/Gradle del APK. `android/keystore/` —
  firma del APK (riesgo conocido y aceptado por la dueña).
- `db/` y `public/uploads/` — estado real de la biblioteca en modo legacy
  (dentro del repo). Jamás se commitean. Con `ATHENA_HOME` (default
  `~/.local/share/athena`) los datos viven FUERA del repo.

## Convenciones técnicas

- TypeScript strict, Bun como runtime de dev/tests, Node en producción.
- Tailwind para estilos; **sin objetos de estilo inline** (excepciones
  documentadas en el código).
- La BD es SQLite del propio runtime (node:sqlite en Node ≥ 23.4,
  bun:sqlite en Bun) — `src/lib/db.ts` la abre y crea el esquema solo.
  El esquema vive ahí embebido y respeta el formato en disco que dejaba
  Prisma (fechas como ms INTEGER, JSON como TEXT): una biblioteca vieja
  sigue funcionando tal cual. Cambios de esquema = tocar `ESQUEMA` en
  `db.ts` + su test, con cuidado de no romper bibliotecas existentes.
- Toda respuesta API sigue `{ ok: boolean, data?: T, error?: string }`.
  El motor offline replica ESTE contrato: si cambias una ruta API, cambias
  su espejo en `public/athena-offline.js` y sus tests en el mismo PR.

## Commits

- Conventional Commits en inglés: `feat:`, `fix:`, `refactor:`, `docs:`,
  `chore:`, `ci:`, `test:`.
- Primera línea de ≤ 72 caracteres, en imperativo («add», no «added»).
- Un commit = un cambio lógico coherente. Sin firmas automáticas.

## Antes de dar una tarea por terminada

1. `bunx tsc --noEmit` pasa.
2. `bun run lint` pasa.
3. `bun test` pasa.
4. ¿Tocaste el esquema de `src/lib/db.ts`? → sus tests (formato en disco
   incluido) actualizados en el mismo PR.
5. ¿Tocaste una ruta de `server/api.ts`? → actualiza su espejo en
   `public/athena-offline.js` y `tests/offline-engine.test.ts`
   (mismo contrato, mismo PR).
6. ¿Tocaste UI de lectura? → prueba de humo en el APK (o emulador), no solo
   en el navegador del escritorio.
7. ¿Tocaste el empaquetado? → `bun run apk:sync` o
   `bash scripts/package-linux.sh` según el destino.

## Prohibido

- Commitear secretos: `.env*`, tokens, `*.pem`.
- Commitear estado: `*.db`, `db/*`, `public/uploads/*`, `public/pdfjs/`
  (se sincroniza desde node_modules), logs, snapshots.
- Introducir dependencias sin justificarlo en la descripción del PR.
- Cambiar el contrato `{ ok, data?, error? }` en un solo lado.
- Volver a meter un ORM o un paso técnico de BD: la BD nace sola.
