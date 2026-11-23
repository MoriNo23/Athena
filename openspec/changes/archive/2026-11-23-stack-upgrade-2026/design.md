# Design

## Context

Ver `proposal.md` para el porqué. Lo que condiciona el cómo:

- Cada push a `main` publica un release y mueve el tag `v<versión>`; Android deriva el `versionCode` de `package.json`. Un solo PR con todo publicaría una versión y dejaría las demás sin existir.
- `bun.lock` es la fuente de verdad; no hay `package-lock.json`.
- El APK se construye con `bun run apk:sync` + `gradlew assembleDebug`, y el WebView del emulador de pruebas es Chrome 124 (Android 15), más viejo que pdf.js 6.4 y que ya obligó a cuatro polyfills.
- Los PRs #7, #8 y #9 de `honest-reading-teleprompter` aún no están mergeados; este change arranca después de ellos.
- Dependabot cubre `minor` y `patch`, no majors: el upgrade es manual por diseño.

## Goals / Non-Goals

**Goals:**

- Subir las dependencias a versiones soportadas sin romper la app de escritorio ni el APK.
- Mantener `bunx tsc --noEmit`, `bun run lint`, `bun test` y el build de producción en verde en cada PR.
- Confirmar en el APK que los PDF siguen abriendo y que el teleprompter sigue marcando páginas.
- Quitar polyfills que la versión nueva ya no necesite, y añadirlos si aparecen otros.

**Non-Goals:**

- Cambiar el contrato `{ ok, data?, error? }`, el esquema de `src/lib/db.ts` ni el motor offline.
- Meter dependencias nuevas de runtime.
- Cambiar el comportamiento del producto (sin features, sin rediseño).
- Tocar los workflows de release salvo que un upgrade lo exija.

## Decisions

### D1 · Tres PRs por capas, con tres parches

1. **2.1.9**: runtime no nativo (`pdfjs-dist` 6.5, `lucide-react` 1.x, `tailwind-merge`, parches menores) + auditoría de polyfills.
2. **2.1.10**: Capacitor 8 + `android/**` + `capacitor.config.ts` + smoke de APK.
3. **2.1.11**: toolchain (TypeScript 7, Vite 8, `@vitejs/plugin-react` 6, ESLint 10) + arreglos de config/tipos.

Alternativa descartada: un solo PR con todo. Un fallo en Capacitor 8 bloquearía también los arreglos de pdf.js y no se podría bisectar por release.

### D2 · `bun update` con `bun.lock` committeado

Se usan los comandos de la skill `dependency-updater` instalada en `~/.agents/skills/dependency-updater`, pero la fuente de verdad sigue siendo `bun.lock`. No se añade ni se quita ninguna dependencia de runtime.

Alternativa descartada: `npm audit fix --force` — este repo no usa npm y las guías npm de la skill de supply-chain no aplican al lockfile de Bun.

### D3 · Auditoría de polyfills con evidencia real, no por teoría

Tras subir `pdfjs-dist` a 6.5 se consulta por CDP qué APIs faltan en el WebView (`Promise.try`, `URL.parse`, `Uint8Array.toHex`/`toBase64`, `Promise.withResolvers`, `Map.getOrInsert`). Se conservan sólo las que sigan ausentes; se regenera `public/pdf.worker.min.mjs` con `node scripts/patch-pdf-worker.mjs`.

Alternativa descartada: bajar `pdfjs-dist` a 5.x para evitar polyfills. Cambiaría el visor y perdería correcciones de la rama 6.x sin necesidad.

### D4 · Capacitor 8 se valida en el emulador, no sólo con `tsc`

`bun run apk:sync` y `gradlew assembleDebug` son la compuerta; después se instala el APK en el AVD `athena-smoke` y se abre un PDF real de `/home/extra`. El `versionCode` sigue derivado de `package.json`, así que el parche del PR 2.1.10 es obligatorio.

Alternativa descartada: actualizar el proyecto Gradle a mano sin `cap sync`. Ya hubo un fallo en la casa por rutas de iconos desincronizadas; el generador manda.

### D5 · Toolchain al final

TypeScript 6.0.3, Vite 8 y ESLint 10 van en el último PR porque sus cambios de config no afectan al runtime del APK y dejarlos al final permite aislar cualquier error de tipos. Se ejecutan `tsc`, `lint`, `test` y `bun run build`.

TypeScript 7 queda fuera: `typescript-eslint` 8.73 declara `typescript <6.1` y con TS 7 el lint se cae antes de analizar nada. La única alternativa sería desactivar el lint tipado, que se descarta. Se revisitará cuando `typescript-eslint` soporte TS 7.

## Risks / Trade-offs

- **pdf.js 6.5 puede cambiar la API del worker** → regenerar el worker parcheado y repetir el humo en el APK; si aparece una API nueva, añadir el polyfill mínimo con su comentario `shortcut:`.
- **Capacitor 8 puede romper el WebView o el arranque** → mantener el PR aislado y revertirlo sin tocar los otros dos.
- **TypeScript 7 puede rechazar tipos que hoy compilan** → arreglos locales en el mismo PR; no se relaja `strict`.
- **Lucide 1.x puede renombrar iconos** → `tsc` detecta los imports rotos; se corrigen uno por uno.
- **Tres releases seguidas en poco tiempo** → es el coste de publicar en cada push a `main`; se documenta en las release notes.
- **El emulador da ANR de System UI por render por software** → no es un fallo de la app; se usa CDP para verificar el WebView cuando la UI nativa se atasca.

## Migration Plan

- Orden: merge de #7/#8/#9 → PR 2.1.9 → PR 2.1.10 → PR 2.1.11.
- Cada PR: `bunx tsc --noEmit`, `bun run lint`, `bun test`, `bun run build`; el de Capacitor añade `bun run apk:sync` + `assembleDebug` + humo en AVD.
- Rollback: revertir el PR; `bun.lock` y `package.json` vuelven al estado anterior y el siguiente push publica ese parche. No hay migración de datos.
- Si un PR falla en CI, no se mergea el siguiente.

## Open Questions

Ninguna que cambie el enfoque o las tareas. Los detalles de cada upgrade se resuelven dentro de su PR.
