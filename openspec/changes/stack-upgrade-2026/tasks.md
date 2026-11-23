# Tasks

## 1. Precondición

- [x] 1.1 Verificar que los PRs #7, #8 y #9 de `honest-reading-teleprompter` están mergeados en `main` y que `main` está actualizada; confirmar con `git log -1` y `openspec list`.
- [x] 1.2 Confirmar que la skill `dependency-updater` está instalada en `~/.agents/skills/dependency-updater` y leer su flujo antes de tocar dependencias; verificar que `bun outdated` lista los majors del proposal.

## 2. PR 2.1.9 · Librerías de runtime y polyfills

- [x] 2.1 Actualizar `pdfjs-dist` a 6.5.x, `lucide-react` a 1.x y `tailwind-merge` a 3.7.1 con `bun update`; verificar que `bun.lock` queda committed y que `tsc`, `lint` y `bun test` pasan.
- [x] 2.2 Corregir los imports de iconos que lucide 1.x haya renombrado; verificar con `bunx tsc --noEmit` sin errores.
- [x] 2.3 Auditar por CDP qué APIs faltan en el WebView Chrome 124 tras el upgrade (`Promise.try`, `URL.parse`, `Uint8Array.toHex`/`toBase64`, `withResolvers`, `getOrInsert`); verificar con un JSON de `typeof` por API.
- [x] 2.4 Quitar los polyfills que ya no hagan falta y añadir los nuevos que aparezcan en `src/lib/pdfjs-webview-polyfills.ts` y `scripts/patch-pdf-worker.mjs`; regenerar `public/pdf.worker.min.mjs` con `node scripts/patch-pdf-worker.mjs` y verificar que el PDF real abre en el APK.
- [x] 2.5 Subir la versión a 2.1.9 y abrir el PR; verificar `bunx tsc --noEmit`, `bun run lint`, `bun test` y `bun run build`.

## 3. PR 2.1.10 · Capacitor 8 y APK

- [x] 3.1 Actualizar `@capacitor/core`, `@capacitor/android` y `@capacitor/cli` a 8.x con `bun update`; verificar que `bun.lock` refleja las tres versiones.
- [x] 3.2 Adaptar `capacitor.config.ts` y `android/**` a los cambios rotos de Capacitor 8; verificar `bun run apk:sync` sin errores.
- [x] 3.3 Compilar `gradlew assembleDebug` con JDK 21 y el SDK 35; verificar `BUILD SUCCESSFUL` y el APK resultante.
- [x] 3.4 Instalar el APK en el AVD `athena-smoke`, abrir un PDF real de `/home/extra` y el teleprompter con un EPUB; verificar que renderiza y que el aviso de página leída sigue apareciendo.
- [x] 3.5 Subir la versión a 2.1.10 y abrir el PR; verificar `tsc`, `lint`, `bun test` y el humo de APK del PR.

## 4. PR 2.1.11 · Toolchain

- [x] 4.1 Actualizar TypeScript 6.0.3 (7 bloqueado por `typescript-eslint`), Vite 8, `@vitejs/plugin-react` 6 y ESLint 10 con `bun update`; verificar `bun.lock` y que no hay dependencias nuevas de runtime.
- [x] 4.2 Adaptar `tsconfig.json`, `vite.config.ts` y `eslint.config.mjs` a las APIs nuevas; verificar `bunx tsc --noEmit` y `bun run lint` en verde sin relajar `strict`.
- [x] 4.3 Corregir los errores de tipos que TypeScript 7 detecte en `src/`; verificar `bun test` y `bun run build`.
- [ ] 4.4 Subir la versión a 2.1.11 y abrir el PR; verificar los cuatro comandos de calidad y que el diff no toca `server/api.ts` ni `public/athena-offline.js`.

## 5. Integración

- [ ] 5.1 Verificar que los tres PRs se mergean en orden y que cada tag `v2.1.9`, `v2.1.10` y `v2.1.11` apunta a su commit; comprobarlo en GitHub Releases.
- [ ] 5.2 Verificar que `bun install --frozen-lockfile` funciona desde cero con el `bun.lock` final y que `bun test` sigue en verde salvo el fallo viejo de `tests/archive/`.
- [ ] 5.3 Revisar las release notes: mencionar los tres parches, el cambio de Capacitor 8 y la auditoría de polyfills de pdf.js.

## Workflow follow-up

- Archivar este change cuando los tres PRs estén mergeados y el APK verificado.
- Confirmar que `honest-reading-teleprompter` y `stack-upgrade-2026` quedan como specs/archivos de referencia vigente.
