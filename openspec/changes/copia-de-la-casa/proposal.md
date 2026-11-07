# Proposal: copia-de-la-casa

## Why

La dueña lee en dos aparatos: el ordenador (servidor con su biblioteca) y el
móvil (APK offline con su propia copia). Hoy ambas mitades son islas: el
progreso que nace en el teléfono no llega al riel del ordenador ni al revés.
La Enmienda 1 de PRODUCT.md (2026-11-06) abre la puerta con condiciones
vinculantes: copia directa entre dispositivos propios por LAN o fichero,
bidireccional bajo control de la dueña («elegir qué dispositivo manda»),
degradación en silencio y cero cuentas. Es la fase 6 del plan de trabajo.

## What Changes

- **Copia de la casa, siempre a mano**: dos botones en el APK («Traer del
  ordenador» / «Enviar al ordenador») + prueba de conexión. Nada automático
  ni en segundo plano. Nueva guía: `docs/guias/sincronizar.md`.
- **Servidor**: `POST /api/sync/book` (un libro: JSON + fichero + portada,
  empareja por id y luego fileName+totalPages — la convención anti-dup de la
  casa; el que manda gana en campos/sesiones/insignia; la copia NUNCA borra)
  y `POST /api/sync/meta` (ajustes saneados + vocabulario con dedupe y tope
  de 500). El pull NO necesita rutas nuevas: usa GET existentes.
- **Candado**: el proxy acepta sesión por cookie (como hoy) o cabecera
  `X-Athena-Token` (el mismo derivado, misma comparación en tiempo
  constante); `OPTIONS` pasa al preflight CORS; el login devuelve el token.
- **CORS acotado**: solo los orígenes del WebView del APK
  (`https://localhost`, `capacitor://localhost`, …) reciben cabeceras, y solo
  en las rutas que la copia usa (books/settings/vocab GET, file, cover,
  login, sync/*). Cualquier otra web sigue bloqueada.
- **Motor offline**: módulo `sync` en el núcleo (exportar/aplicar, serializado
  en la cola) + puente red en `install()` (traerDe/enviarA con fetchNativo y
  descarga de ficheros que falten con degradación en silencio) expuesto como
  `window.__athenaOffline`. NO es un contrato del API: es el puente APK ↔
  servidor; las reglas de fusión viven espejadas en `src/core/sync.ts`.
- **Android**: `allowMixedContent` en Capacitor + `usesCleartextTraffic` en
  el manifest — el esquema NO cambia (el origen https://localhost y la
  biblioteca instalada se quedan estables).
- **Reglas de fusión puras y testeadas en ambos lados**: `src/core/sync.ts`
  (servidor) y el módulo del motor (APK): emparejar por id → fileName+páginas,
  clamps idénticos a los del API, sesiones por día reemplazadas por el que
  manda, insignia upsert/queda/fuera, vocab dedupe palabra+idioma sin caja.
- **i18n**: sección `copia.*` en es/en/pt (el namespace `sync.*` ya estaba
  ocupado por el popover de «marcar por dónde vas»).

## Impact

- Affected specs: ninguno nuevo (la Enmienda 1 de PRODUCT.md ya define el
  comportamiento; lectura/riel/contratos existentes intactos).
- Affected code: `src/core/sync.ts` (nuevo) + tests; `src/lib/cors.ts`
  (nuevo); `src/proxy.ts`; `src/app/api/auth/login/route.ts`; rutas nuevas
  `src/app/api/sync/{book,meta}/route.ts`; CORS+OPTIONS en books/settings/
  vocab/file/cover GET; `public/athena-offline.js` (módulo sync + puente);
  `src/components/library/SyncDialog.tsx` (nuevo) y `HeroMenu.tsx`;
  `src/lib/i18n/{es,en,pt}.ts`; `capacitor.config.ts`; `AndroidManifest.xml`;
  docs (guía nueva, INDICE, README, APK-OFFLINE, AGENTS).
- Validación: tsc + lint + `bun test` (148 tests, 0 fallos) + `bun run build`
  en verde. Prueba en teléfono real: checklist ampliada en APK-OFFLINE.md
  (pasos 11-12).
