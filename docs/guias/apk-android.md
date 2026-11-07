# APK Android

Athena también vive en el teléfono como **app offline**: la misma app dentro
de un WebView con un motor que responde todo localmente — biblioteca,
progreso y ficheros viven en el teléfono (IndexedDB/OPFS). Sin servidor,
sin nube, sin cuentas.

## Qué hace el APK

- Biblioteca, lectura, riel, racha, insignias y teleprompter funcionan
  **100% offline**.
- El motor offline **espeja los contratos del API** del servidor: la misma
  interfaz, otra fuente de datos. Se testea en CI
  (`tests/offline-engine.test.ts`).
- Subir libros: desde el teléfono, con el selector de ficheros del sistema.

## Cómo se compila

**Opción recomendada — GitHub Actions:** cada push a `main` ejecuta el
workflow «Athena APK» y el APK firmado queda adjunto al
[release](https://github.com/MoriNo23/Athena/releases)
(`Athena-v<versión>.apk`). Descarga, instala, listo.

**Opción local:**

```bash
bun run apk:release     # apk:sync (web estática) + gradlew assembleRelease
```

El APK sale en `android/app/build/outputs/apk/release/`.

## Límites honestos

- El APK es la experiencia **offline**: no habla con un servidor Athena ni
  sincroniza con tu PC (todavía).
- PDF.js en WebView tiene sus caprichos: la guía completa, límites y una
  prueba de 15 minutos en el teléfono viven en
  [`docs/APK-OFFLINE.md`](../APK-OFFLINE.md).
- Firma del APK: el keystore vive en el repo — decisión documentada con sus
  mitigaciones en
  [`docs/SECURITY.md`](../SECURITY.md).
  Instala APKs solo del release oficial.
