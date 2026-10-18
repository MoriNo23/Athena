# Tasks

## 1. Vista suave del teleprompter

- [x] 1.1 Implementar el animador de vista en `use-teleprompter-window`: `scrollToChar` fija objetivo y un solo rAF lleva `scrollTop` con ease-out y duración escalada por distancia (≈90–400 ms), según D1/D2 del design. Verificación: `bunx tsc --noEmit` limpio y pasada manual en dev — título, cruce con Auto, revelado completo y rebobinado llegan sin salto en seco; con preset instantánea la vista salta como hoy.
  - `use-teleprompter-window.ts`: animador con UN rAF activo (`viewAnimRef`), `easeOutCubic`, `viewAnimDuration` (90 ms base → 400 ms a ~600 px), objetivo SIEMPRE recalculado contra rects frescos del DOM. Sin animación con `prefers-reduced-motion` o preset instantáneo (`viewInstantRef`); la transición se cancela al cambiar la ventana (cruce/rebobinado/reconstrucción).
  - Sonda e2e nueva `scripts/probe-camara-suave.js` **4/4 PASS**: revelado completo con valores intermedios ordenados (no salto en seco), rueda sin pelea (deriva 0.0 px), instantánea en 1 valor (salta como hoy), 0 errores de consola. En headless los BeginFrame llegan agrupados: la sonda usa `setInterval` y exige intermedio real, no fps.
- [x] 1.2 Resincronizar en movimiento manual y recalcular objetivo tras cruce de página y rebobinado (rueda/`↑` cancelan la animación; el objetivo se recalcula contra el DOM real), según D1/D6. Verificación: pasada manual — desplazarse con rueda/`↑` a mitad de un salto no da tirón y al reanudar el seguimiento continúa desde la posición real; `node scripts/test-vn-stress.js` en verde (si la aserción del carácter al ~40 % lee a mitad de animación, esperar asentamiento en el script; el cambio del test se anota).
  - `TeleprompterOverlay`: `onWheel` y `↑` llaman `cancelViewAnim()` (el desplazamiento manual manda; el motor re-ancla con el primer `scrollToChar` contra el DOM vivo). La aserción de ~40 % de `test-vn-stress.js` NO necesitó cambio: **21/21 PASS** sin tocar el script (la animación asienta antes de las lecturas del arnés).

## 2. Datos de la meta por libro

- [x] 2.1 Añadir `Book.dailyGoal Int?` al esquema (null = mínimo global, patrón `milestones`) y aplicar. Verificación: `bun run db:push` sin pérdida de datos y `sqlite3 db/custom.db "PRAGMA table_info(Book);"` muestra `dailyGoal`; `GET /api/books` responde con los libros intactos.
  - Columna verificada vía `PRAGMA table_info(Book)` (python sqlite3; el CLI sqlite3 no está en este entorno). `db:push` OK; los 3 libros de semilla intactos tras el push.
- [x] 2.2 Aceptar `dailyGoal` en `PATCH /api/books/[id]` (null o entero limitado a 1–500) y añadirlo a la restauración de `POST /api/books/undo` y a `BookDTO`/`BookWithSessions`. Verificación: `bunx tsc --noEmit` limpio; con `curl` — PATCH con `dailyGoal: 30` y GET lo muestra, PATCH con `null` vuelve a heredar, valor 999 se limita a 500; borrar con papelera y deshacer un libro con meta propia la conserva.
  - Verificado por curl contra dev: `30→30`, `999→500`, `null→null (hereda)`; `PATCH /meta` también acepta `dailyGoal` (25→25) para el diálogo del inicio. DELETE + undo de «Meditations» restauró `dailyGoal: 25` (la instantánea ya guarda la fila completa; campo añadido a la whitelist). `tsc` 0.

## 3. Meta por libro en la interfaz

- [x] 3.1 Añadir en `ConfigPanel` (sección Hábito) el switch «meta propia de este libro» y su input, espejo del control de hitos; textos nuevos en es/en/pt. Verificación: manual en dev — activar fija el valor, desactivar vuelve a heredar, cambiar el mínimo global mueve solo a los libros que heredan; `rg "config\..*bookGoal" src/lib/i18n` aparece en los tres idiomas con las mismas claves.
  - Tarjeta `BookGoalCard` (subcomponente en `ConfigPanel.tsx`, espejo del control de hitos): switch fija el global como punto de partida, retirar vuelve a heredar; input con tope 1–500 y borrador null-while-editing (sin setState en efectos). `rg "config\..*bookGoal"` → mismas 4 claves en es/en/pt + `config.goalInheritHint`.
- [x] 3.2 Añadir el campo de meta al `EditBookDialog` del inicio (vacío = heredar) y refrescar la tarjeta al guardar. Verificación: manual desde una tarjeta — fijar y retirar la meta persiste tras recargar y la tarjeta refleja la meta efectiva resultante.
  - `GoalField` (subcomponente) + helper puro `parseGoalDraft` (vacío = heredar; 1–500). La tarjeta refresca vía `updateBook` con `dailyGoal` del `PATCH /meta`. Sonda `scripts/probe-habito-libro.js` C1: fijar 40 desde la tarjeta → «meta 15/40» en la tarjeta al volver.

## 4. Páginas de hoy del libro

- [x] 4.1 En `use-reading-session`, exponer las páginas de hoy del libro (base de sesiones de hoy + contador monótono de la sesión, según D4) y corregir el tipo del lector a `BookWithSessions`. Verificación: `bunx tsc --noEmit` limpio; manual — con sesiones de hoy, el par inicial es el correcto; avanzar dos páginas lo sube sin recargar; un salto por el riel no lo mueve.
  - `bookPagesToday` = base inmutable leída al montar (sesiones de hoy del libro en `/api/books`) + contador monótono en `turn()`. Tipos corregidos: `ReaderView.book: BookWithSessions`, `LibraryView.onOpen`/`BadgeShelf` con el libro y sus sesiones; `page.tsx` preserva `sessions` en los merges (los PATCH no la incluyen).
  - Hallazgo y arreglo durante la verificación: `turn()` solo avanzaba la marca alta en el volcado con debounce (700 ms), así que dos giros rápidos contaban el delta acumulado (2 páginas → +3). La marca alta ahora avanza en el giro contable mismo: el par sube exactamente lo girado (sonda B2: +2 con dos flechas seguidas). Afecta igual al `pagesRead` del servidor (mismo delta), sin tocar la semántica asentada: giro normal cuenta, salto silencioso no.
- [x] 4.2 Cambiar en `ReaderHeader` el par `páginas/meta` al del libro con tooltip nuevo en es/en/pt, dejando racha global y minutos de sesión intactos. Verificación: manual a 1280×800 y 390×844 — el par del libro se lee y actualiza, racha y minutos no cambian; sin tokens nuevos de color (par de texto atenuado ya auditado).
  - Par alimentado con `bookPagesToday` y `book.dailyGoal ?? settings.reading.dailyGoal`; tooltip `reader.goalBookTitle` en los tres idiomas. Racha (`todayStats.streak`) y minutos (`sessionMinutes`) sin cambios. Sin tokens nuevos: mismo par `text-muted-foreground` de la cabecera.

## 5. Resumen de hoy en las tarjetas

- [x] 5.1 Pintar en `BookCard` el resumen de actividad de hoy (páginas y minutos) junto al avance hacia la meta efectiva, sin resumen cuando no hay actividad de hoy; textos en es/en/pt. Verificación: manual con un libro con sesiones de hoy y otro sin ellas; en la pestaña Network, abrir el inicio no dispara peticiones nuevas de datos (solo el `/api/books` de siempre).
  - `card-today-summary` («hoy: {p} pág · {m} min · meta {gp}/{g}») desde `book.sessions` del payload, con meta efectiva (`book.dailyGoal ?? global`); sin actividad hoy no se pinta nada (sonda A3). Una sola petición `/api/books` al abrir el inicio (sonda A1/A2, C1).

## 6. Cierre

- [x] 6.1 Correr la verificación completa y anotar salidas en el change: `bunx tsc --noEmit`, `bun run lint`, `bun run crap` (objetivo CC ≤30 de `CRAPPER.md`), `node scripts/test-vn-stress.js` y `node scripts/test-hotkeys-e2e.js`. Verificación: todo en verde o con desviaciones justificadas por escrito; `openspec validate camara-suave-y-metas-por-libro --strict` sin hallazgos nuevos.
  - `bunx tsc --noEmit` → 0 · `bun run lint` → 0 errores · `bun run crap` → unidades tocadas dentro de banda: `ConfigPanel` 30 (era 30; la tarjeta nueva vive en `BookGoalCard` CC 9), `EditBookDialog` 29 (era 28; campo en `GoalField` CC 4 + helper puro), `BookCard` 20 (era 16), `useTeleprompterWindow` 22 (era 15, hook), `useReadingSession` 27 (era 24, hook). `TeleprompterOverlay` 56 **preexistente** (sin ramas añadidas por este change; queda fuera del alcance de este change).
  - `node scripts/test-vn-stress.js` → **21/21** · `node scripts/test-hotkeys-e2e.js` → verde, 0 errores de consola · sondas nuevas: `probe-camara-suave.js` **4/4**, `probe-habito-libro.js` **8/8**.
  - `bunx @fission-ai/openspec validate camara-suave-y-metas-por-libro --strict` → **"Change 'camara-suave-y-metas-por-libro' is valid"**.
- [x] 6.2 Pasada de contraste de los textos nuevos pequeños (resumen de tarjeta y tooltips) con el método de la auditoría del lector si tocan pares no auditados. Verificación: medición ≥4,5:1 o confirmación de que reutilizan pares ya auditados (`muted-foreground` sobre `card`).
  - Confirmación de reutilización, sin medición nueva: resumen de tarjeta, pista del campo de meta, tarjeta de hábito del panel y tooltip del par usan `text-muted-foreground` sobre `bg-card`/`bg-card/40` (pares ya auditados en la auditoría del lector). Ningún token de color nuevo en el change.

## Workflow follow-up

- [x] Archivar el change cuando la verificación cierre y las specs principales queden sincronizadas.
  - Specs principales sincronizadas: `reading-habit` creada (5 requirements) y `teleprompter` con los 2 requirements añadidos; change movido a `openspec/changes/archive/2026-10-19-camara-suave-y-metas-por-libro/`.
