# Tasks: copia-de-la-casa

## 1. Reglas de fusión (puras)

- [x] 1.1 `src/core/sync.ts`: identidad id → fileName+totalPages, clamps
      (página, hitos 2-40, meta 1-500, extras ≤512 KB), sesiones por día
      sanas, insignia (viene/upsert · null/fuera · no viene/tal cual),
      vocab dedupe palabra+idioma sin caja y tope 500
- [x] 1.2 `src/core/sync.test.ts`: 12 tests del lado servidor
- [x] 1.3 Motor offline: `exportarEstado`/`aplicarEntrante` espejan las
      mismas reglas en el APK (módulo `sync` dentro de `createCore`)

## 2. Candado y CORS

- [x] 2.1 `src/proxy.ts`: sesión por cookie O `X-Athena-Token`; `OPTIONS`
      pasa al preflight (sin datos)
- [x] 2.2 `src/lib/cors.ts`: cabeceras SOLO para los orígenes del WebView
      del APK; `preflightSync` 204
- [x] 2.3 `POST /api/auth/login` devuelve `{ ok, token }` (el derivado de la
      cookie) con CORS de la copia

## 3. Rutas y motor

- [x] 3.1 `POST /api/sync/book`: multipart book+file+cover; empareja,
      actualiza o crea; sesiones reemplazadas; insignia según venga; fichero
      ausente → `fileMissingAt` (degradación en silencio)
- [x] 3.2 `POST /api/sync/meta`: settings saneados (biblioteca y `_doc`
      locales se quedan) + vocabulario reemplazado
- [x] 3.3 CORS+OPTIONS en las rutas del pull: GET books/settings/vocab,
      GET file y cover
- [x] 3.4 Motor: `traerDe` (GETs + aplicar + descarga de ficheros que
      falten) y `enviarA` (exportar + sync/book por libro + sync/meta), todo
      por `fetchNativo` con `X-Athena-Token`; expuesto como
      `window.__athenaOffline`

## 4. Interfaz y APK

- [x] 4.1 `SyncDialog` (solo en la build del APK): dirección, contraseña
      opcional (no se guarda), probar conexión, traer y enviar con progreso
- [x] 4.2 Entrada en `HeroMenu` (menú «⋯» de la biblioteca), i18n es/en/pt
      en el namespace `copia.*` (el `sync.*` ya era del popover de progreso)
- [x] 4.3 Capacitor `allowMixedContent` + manifest `usesCleartextTraffic`
      (esquema https://localhost intacto: la biblioteca instalada no se toca)

## 5. Documentación y validación

- [x] 5.1 `docs/guias/sincronizar.md` (paso a paso, qué viaja, límites
      honestos) + INDICE + README + APK-OFFLINE (tabla, tests 148, checklist
      11-12) + AGENTS (grupos del API, nota del módulo sync)
- [x] 5.2 `bunx tsc --noEmit` · `bun run lint` · `bun test` (148, 0 fallos)
- [x] 5.3 `bun run build` en verde (rutas sync registradas)
- [ ] 5.4 Prueba real en teléfono contra el servidor de la dueña (checklist
      11-12 de APK-OFFLINE.md) — requiere el APK del próximo release
