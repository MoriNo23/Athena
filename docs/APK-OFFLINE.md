# Athena APK — la app en tu bolsillo, sin servidor

> Cómo convertir Athena en una **app Android** que lee tus libros **100 %
> offline** (sin ordenador encendido, sin servidor, sin nube) y cómo probarla
> sin morir en el intento.

## Qué es esto

Athena es una web app: para usarla hacia falta un servidor (Next.js + base de
datos) corriendo en algún sitio. La APK elimina esa dependencia con un motor
offline que vive DENTRO de la app:

```
┌───────────────────────────── EL APK ─────────────────────────────┐
│                                                                   │
│  ┌─── WebView (Chrome embebido) ──────────────────────────────┐   │
│  │  La interfaz de Athena EXACTAMENTE igual (mismo código)    │   │
│  │  sigue llamando a /api/... como siempre                    │   │
│  └──────────────────────┬─────────────────────────────────────┘   │
│                         │ fetch / XHR interceptados               │
│  ┌──────────────────────▼─────────────────────────────────────┐   │
│  │  Motor offline (public/athena-offline.js)                  │   │
│  │  responde TODO localmente:                                 │   │
│  │   · datos (biblioteca, progreso, vocabulario, insignias,   │   │
│  │     ajustes, papelera) → IndexedDB                         │   │
│  │   · ficheros (PDF/EPUB, portadas, fondos) → OPFS (disco    │   │
│  │     privado de la app), con soporte de Range para pdf.js   │   │
│  └────────────────────────────────────────────────────────────┘   │
│  Envoltorio: Capacitor (com.morino23.athena), Android 7.0+        │
└───────────────────────────────────────────────────────────────────┘
```

Ni una línea de la interfaz cambia: la misma Athena que ya conoces, pero la
«base de datos» y «el disco del servidor» son ahora privados de tu teléfono.

**Regla de la casa:** el motor espeja los contratos de `src/app/api/**` con
la misma forma de respuesta `{ ok, data?, error? }`. Cambiar un contrato
significa cambiar los DOS lados y sus tests (`tests/offline-engine.test.ts`)
en el MISMO PR. Las reglas completas viven en `AGENTS.md`.

## Conseguir el APK (sin instalar nada en tu máquina)

GitHub lo compila solo:

1. Aplica el patch y haz push (ver más abajo).
2. Abre tu repo en GitHub → pestaña **Actions** → workflow **«Athena APK»**.
3. Espera el run (5-10 min la primera vez). Si sale verde, entra y baja hasta
   **Artifacts** → descarga **`Athena-apk`**.
4. Descomprime el zip, pasa el `app-release.apk` al teléfono (Drive, cable,
   lo que sea) y ábrelo.

El workflow corre **los tests antes de compilar**: si algo está roto, no se
genera APK ninguno y ves el error en el run.

## Instalar en el teléfono (Android 14)

1. Abre el `.apk` → Android preguntará si confías en instalar de esa fuente →
   **Permitir** (es tu propia app, firmada por ti).
2. Si tenía una versión anterior instalada: se instala ENCIMA y tu
   biblioteca se conserva (la firma es estable; la base de datos vive en el
   almacenamiento privado de la app).
3. Abre Athena. Sin cuentas, sin candado, sin configuración.

## Compilar en tu máquina (opcional)

Necesitas Bun y (solo para el paso final) el SDK de Android — si no lo
tienes, usa el workflow de GitHub:

```bash
bun install
bun run apk:web      # build web estática en out/
bunx cap sync android
cd android && ./gradlew assembleRelease   # requiere SDK Android
# → android/app/build/outputs/apk/release/app-release.apk
```

## Qué funciona sin internet y qué no

| Función | Sin internet |
|---|---|
| Leer PDF y EPUB (páginas, texto, teleprompter, modos) | ✅ perfecta |
| Añadir libros (subir ficheros) | ✅ perfecta |
| Progreso, riel, sesiones, racha, hitos | ✅ perfecta |
| Insignias, «terminado», reinicios | ✅ perfecta |
| Vocabulario guardado | ✅ perfecta |
| Ajustes, filtros, fuentes, inmersión | ✅ perfecta |
| Portadas que vienen dentro del PDF/EPUB | ✅ perfecta |
| **Copiar con el ordenador** (biblioteca y progreso por la red de casa) | ✅ por LAN: ambos aparatos en tu WiFi, sin internet — la app degrada en silencio si no hay pareja de copia |
| **Diccionario** (RAE/Wiktionary) | ❌ necesita internet (consulta APIs externas) |
| **Búsqueda de portada automática** (Open Library/Google) | ❌ necesita internet |
| **OCR** de libros escaneados | internet SOLO la primera vez (descarga los datos del idioma, ~1-2 MB, luego quedan en caché) |
| Carpeta de biblioteca del PC (`Carpeta → Escanear`) | N/A: no hay sistema de ficheros compartido; los libros viven dentro de la app |

Los libros ocupan lo que ocupen (hasta 200 MB cada uno) dentro del
almacenamiento privado de la app; el WebView de Android 14 aguanta esa
escala sin despeinarse.

## Cómo se prueba esto (para NO probarlo todo a mano)

### 1. Automatizado (corre solo, antes de cada APK)

- **148 tests** (`bun test`): los de la casa + **29 del motor offline**
  (`tests/offline-engine.test.ts`) que verifican UNO A UNO los contratos de
  la API replicada: subida, duplicados, progreso y sesiones agregadas por día,
  clamp de páginas, hitos 2-40 y meta 1-500, insignias y sus tiers, la
  guardia anti-doble-registro de 2 min, la papelera de 30 s con deshacer,
  reseteos, portadas, compañero dual, ajustes con `_doc`, vocabulario con
  dedupe, diccionario sin conexión, los errores de las rutas que no aplican
  en móvil y **la copia de la casa** (aplicar el estado del servidor, emparejar
  libros por id o nombre+páginas, exportar el estado del móvil) — el lado
  servidor de esas reglas vive en `src/core/sync.ts` con sus propios tests.
- El **workflow de GitHub** corre `bun test` ANTES de compilar: un APK no se
  genera con tests rojos. Desde la gobernanza de 2026-11, además, el
  workflow **CI** corre tipos + lint + tests en cada PR.

### 2. Prueba de humo ya hecha (navegador real, sin servidor, sin red)

Antes de entregarte este patch se verificó en navegador real con la web
estática (el mismo HTML que lleva el APK) y la red CORTADA:

- la biblioteca carga y lista libros;
- un PDF subido por la UI (probe de pdf.js → ficha → confirmar) queda
  guardado y aparece en el riel;
- el lector renderiza el PDF (peticiones con Range, respuestas 206);
- avanzar página offline registra la sesión y el progreso;
- recargar la página conserva todo (IndexedDB/OPFS);
- cero errores en consola.

Se descubrió y corrigió en ese humo un fallo real: pdf.js v6 pasa objetos
`URL` a `fetch` y el motor los despachaba al servidor estático (404). Si
alguna vez añades otra librería que lea ficheros, pasa por el mismo tipo de
prueba.

### 3. Tu checklist de 15 minutos (una sola vez, en el teléfono)

Los únicos caminos que un test automatizado no puede pisar son los
específicos del teléfono (almacenamiento real, gestos, ciclo de vida). Con
esto basta — si los 10 puntos pasan, la app está sana:

| # | Prueba (3 min c/u aprox.) | Debe pasar |
|---|---|---|
| 1 | Instalar el APK y abrir | Arranca sin pedir cuenta ni candado |
| 2 | **Activar modo avión** y usar la app | Nada pide red; lectura normal |
| 3 | Añadir un PDF pequeño con «Añadir libro» | Aparece en el riel con sus páginas |
| 4 | Añadir un EPUB pequeño | Igual (con título/autor del EPUB si trae) |
| 5 | Abrir el PDF, pasar 3 páginas, cerrar y reabrir | Continúa donde dejaste |
| 6 | Volver a la biblioteca | Racha/«hoy» reflejan la lectura |
| 7 | Editar ficha (título+autor) y terminar el libro | Insignia Bronce + confeti |
| 8 | En modo avión: seleccionar una palabra | Mensaje de «sin resultados» (no error raro) |
| 9 | Borrar un libro → Deshacer (30 s) | Vuelve con su progreso |
| 10 | Reiniciar el teléfono y abrir Athena | La biblioteca SIGUE ahí (persistencia) |
| 11 | Con el servidor en modo lan y ambos en tu WiFi: menú «⋯» → «Copiar con el ordenador» → Probar conexión | Dice cuántos libros hay al otro lado |
| 12 | «Traer del ordenador» (o «Enviar») | Los libros y el progreso llegan; la biblioteca se recarga sola (guía completa: `docs/guias/sincronizar.md`) |

Si algo de esto falla: manda captura + los pasos exactos, y miro el flujo del
motor correspondiente (cada punto mapea a un handler del motor, no es
«la app falla» a lo loco).

### 4. Qué NO hace falta probar

- Nada del servidor/lock/carpetas: en la APK no existen.
- Los caminos ya cubiertos por los 116 tests (contratos de API completos).
- Regresiones del build self-host: sigue habiendo build de control, y el
  modo APK no toca nada de ese camino (el motor solo se activa con el flag
  de la build estática).

## Preguntas rápidas

- **¿Mis libros se van a la nube?** No. Nada sale del teléfono: no hay
  servidor, no hay telemetría, no hay nube.
- **¿Actualizo la app y pierdo la biblioteca?** No: los datos viven en el
  almacenamiento privado de la app y la firma es estable (`android/keystore/`).
- **¿Y si pierdo el teléfono?** La biblioteca vive en el teléfono. Para
  respaldar, copia los PDF/EPUB originales de donde los sacaste (la app
  guarda copias; tus ficheros fuente siguen siendo la fuente de la verdad).
- **¿Quito el candado/multas del modo lan?** La APK no tiene candado ni
  contraseñas: es tu dispositivo.
- **¿Dónde está la llave de firma?** `android/keystore/athena.keystore`
  (contraseñas en `athena.properties`, al lado). Está en el repo a propósito
  para que GitHub Actions firme sin secretos añadidos; el riesgo exacto y
  las mitigaciones están escritos en `docs/SECURITY.md`.
