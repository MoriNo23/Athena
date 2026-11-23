# Design

## Context

Ver `proposal.md` para el porqué. Lo que condiciona el cómo:

- `pagesRead` nace hoy del delta de `currentPage` en `use-reading-session.ts`; el teleprompter anuncia la página que empieza (`use-teleprompter-player.ts`) y el modo texto mapea página virtual → real (`use-pdf-text-mode.ts`).
- El motor del teleprompter es puro y testeado (`src/core/teleprompter.ts`), pero el player y el overlay no tienen tests.
- El servidor no alcanza OpenLibrary ni Google Books; el navegador sí (`src/lib/cover-search.ts`). `extras` ya se persiste en `Book` y se espeja en `public/athena-offline.js`.
- Cada push a `main` publica release: el cambio se parte en tres PRs con subida de parche.
- Casa: sin dependencias nuevas, sin ORM, contrato `{ ok, data?, error? }` intacto y UI de lectura probada en APK.

## Goals / Non-Goals

**Goals:**

- Un único evento «página leída», idempotente y separado de la posición.
- Pausas españolas correctas sin meter una librería de NLP.
- Aviso de página leída reutilizando el CSS existente y visible en móvil.
- Sinopsis cacheada en `extras`, sin migración y sin nube.
- Cambios pequeños, reversibles y con tests en `src/core/`.

**Non-Goals:**

- Unificar la unidad de página entre PDF, texto y EPUB (riel, ETA, metas e insignias): se documenta la diferencia y se decide en otro change.
- Sincronizar la sinopsis entre dispositivos o guardarla en el servidor.
- Reescribir el overlay en componentes más pequeños.
- Cambiar el contrato de la API o el motor offline.

## Decisions

### D1 · `markPageRead(page)` explícito, no derivado de `currentPage`

`use-reading-session` gana un `markPageRead(page)` con un `Set` de páginas marcadas por sesión. `turn()` deja de sumar páginas: solo actualiza posición, guarda y arma la pausa. El ticker de un segundo comprueba el dwell (pestaña visible) y marca la página actual; el teleprompter llama al mismo método al llegar a la última línea.

- **Dwell:** `PAGE_READ_MIN_MS = 15_000` en `src/core/reading.ts`, con test puro. 15 s es el mínimo que separa «he mirado» de «he hojeado» sin castigar a quien lee rápido una página corta.
- **Alternativas descartadas:** seguir contando por giro (es el bug); porcentaje de scroll (el visor PDF no expone progreso dentro de la página); contar palabras (cambio de producto mayor).

### D2 · Última línea medida en el DOM, no un porcentaje fijo

El player ya tiene los spans reales. Al avanzar, mide la `top` del último span de la página y retrocede mientras la línea sea la misma (tolerancia ~1 px); cuando el encendido alcanza el primer span de esa última línea, llama a `onPageRead(page)`. Si la página es de una sola línea o no hay medida, marca al llegar a `pageDone`.

- **Por qué no un 90 %:** con un párrafo final largo, el 90 % cae varias líneas antes; con una página corta, después. La línea visible es lo que la lectora ve.
- **Coste:** una medición por paso, ya dentro del bucle que pinta; no añade rAF.

### D3 · La unidad contada es la que se muestra

- PDF página: hoja real.
- PDF texto: página virtual del reflujo.
- EPUB: página virtual.

`markPageRead` recibe la página del flujo (no la real) y no toca `currentPage`. Así el modo texto deja de contar cero y el contador coincide con lo que la lectora ve. La diferencia de tamaño entre formatos se documenta en el README de la casa y se deja para el change de unificación.

### D4 · Un helper de corte, dos consumidores

`src/core/teleprompter.ts` gana `corteTras(texto, i)` (o equivalente) que decide si el carácter `i` cierra frase y si añade pausa:

- Punto entre dígitos → no corta, no pausa (miles).
- Coma entre dígitos → no pausa (decimal).
- Abreviatura conocida seguida de espacio → no corta, no pausa.
- `¿` `¡` → respiro breve antes (unidades al propio signo).
- `—` `–` → pausa antes y después.
- Fin de bloque de cuerpo → pausa de párrafo (`TELEPROMPTER_PARAGRAPH_PAUSE_LETTERS = 6`) al primer carácter del bloque siguiente, nunca entre tarjetas del mismo bloque.

Lo usan `buildTeleprompterStream` y `partirEnFrases`, para que el corte visual y la pausa no se contradigan. Tests con una muestra española: `El Sr. Pérez llegó a las 3,14. —Hola —dijo. ¿Vienes?`.

- **Alternativa descartada:** regex por carácter en cada sitio (se desincronizan); librería de segmentación (dependencia nueva para un problema acotado).

### D5 · Aviso reutilizando `.tp-notice-flash`

El overlay escucha el aumento de `todayPages` y muestra una píldora «Página leída · hoy N/meta» con `role="status"`, `aria-live="polite"`, `pointer-events: none` y 2,6 s. Se reutilizan `.tp-notice` y `.tp-notice-flash` (hoy huérfanas) y se añade `key={page}` para que la animación reinicie. Si el aviso de descanso está visible, el de página espera; nunca dos píldoras a la vez.

### D6 · Offsets de interfaz con safe-area, sin medir en JS

`globals.css` define `--tp-chrome-top: calc(<alto de cabecera> + env(safe-area-inset-top))`. La barra de progreso y los avisos usan esa variable en lugar de `top-[52px]` / `4.25rem`. En puntero grueso, `.tp-notice` pierde `backdrop-filter`, igual que cabecera y pie.

### D7 · Sinopsis en `extras`, búsqueda en cliente

`BookExtras` gana `synopsis?: { text: string; source: "googlebooks" | "openlibrary" | "manual" }`. Nuevo `src/lib/book-metadata.ts`, con el mismo patrón que `cover-search.ts`:

1. Google Books por título (y autor si existe) → `volumeInfo.description`.
2. Si no hay, OpenLibrary `search.json` → `key` → `works/<key>.json` → `description` (string u objeto).
3. Timeout de ~9 s, sin reintentos, error silencioso.

Se dispara al guardar título/autor en `EditBookDialog` si no hay sinopsis, y al abrir un libro sin sinopsis y con título. La UI: textarea en `EditBookDialog` con botón «Buscar sinopsis» (acción explícita) y `line-clamp-2` en `BookCard`. `source: "manual"` protege la edición: la búsqueda automática no la pisa.

- **Por qué en `extras`:** ya viaja por `PATCH`, ya se espeja offline y no exige migración. Una columna nueva obligaría a tocar esquema, API, motor offline y snapshots de papelera.
- **Alternativa descartada:** buscar en el servidor (no tiene salida a esas fuentes).

### D8 · Tres PRs, tres parches

- 2.1.6: D1 + D2 + D5 (conteo + aviso).
- 2.1.7: D4 + D6 + limpieza de CSS huérfano, plantilla de PR y Dependabot.
- 2.1.8: D7.

Cada PR: `tsc`, `lint`, `test`, humo en APK si toca UI de lectura. Sin cambios en `server/api.ts` ni en el motor offline.

## Risks / Trade-offs

- **El dwell infravalora a lectores rápidos en páginas muy cortas** → 15 s es conservador; se puede bajar a 10 s con una constante y un test, sin tocar la spec.
- **La última línea medida en DOM depende del tamaño de letra** → se mide en cada paso sobre los spans reales; al cambiar A−/A+ el motor se reanuda y vuelve a medir.
- **Sinopsis de baja calidad o duplicada** → se muestra recortada, es editable, y la edición manual queda protegida; la búsqueda es silenciosa.
- **Privacidad:** la petición sale con título y autor. No hay cuentas ni telemetría, pero conviene decirlo en el PR y en la release note.
- **El aviso puede coincidir con el de descanso** → prioridad explícita y una sola píldora.
- **Sin tests del overlay/player:** el PR 1 añade tests de la regla pura y del helper de última línea; el humo en APK cubre el resto.
- **Release por push:** un PR con un fallo publica versión; el humo en APK y el CI son la red.

## Migration Plan

- Sin migración de base de datos: `extras` es JSON y admite el campo nuevo; los libros viejos siguen sin sinopsis y sin romperse.
- Sin migración de API ni del motor offline.
- Rollback: revertir el PR. Las sesiones ya guardadas son inmutables y no se recalculan; no hay datos que reparar.
- Orden de despliegue: PR 1 (conteo) → PR 2 (teleprompter) → PR 3 (sinopsis). El aviso depende del conteo; la sinopsis es independiente.
