# Tasks

## 1. Vista suave del teleprompter

- [ ] 1.1 Implementar el animador de vista en `use-teleprompter-window`: `scrollToChar` fija objetivo y un solo rAF lleva `scrollTop` con ease-out y duración escalada por distancia (≈90–400 ms), según D1/D2 del design. Verificación: `bunx tsc --noEmit` limpio y pasada manual en dev — título, cruce con Auto, revelado completo y rebobinado llegan sin salto en seco; con preset instantánea la vista salta como hoy.
- [ ] 1.2 Resincronizar en movimiento manual y recalcular objetivo tras cruce de página y rebobinado (rueda/`↑` cancelan la animación; el objetivo se recalcula contra el DOM real), según D1/D6. Verificación: pasada manual — desplazarse con rueda/`↑` a mitad de un salto no da tirón y al reanudar el seguimiento continúa desde la posición real; `node scripts/test-vn-stress.js` en verde (si la aserción del carácter al ~40 % lee a mitad de animación, esperar asentamiento en el script; el cambio del test se anota).

## 2. Datos de la meta por libro

- [ ] 2.1 Añadir `Book.dailyGoal Int?` al esquema (null = mínimo global, patrón `milestones`) y aplicar. Verificación: `bun run db:push` sin pérdida de datos y `sqlite3 db/custom.db "PRAGMA table_info(Book);"` muestra `dailyGoal`; `GET /api/books` responde con los libros intactos.
- [ ] 2.2 Aceptar `dailyGoal` en `PATCH /api/books/[id]` (null o entero limitado a 1–500) y añadirlo a la restauración de `POST /api/books/undo` y a `BookDTO`/`BookWithSessions`. Verificación: `bunx tsc --noEmit` limpio; con `curl` — PATCH con `dailyGoal: 30` y GET lo muestra, PATCH con `null` vuelve a heredar, valor 999 se limita a 500; borrar con papelera y deshacer un libro con meta propia la conserva.

## 3. Meta por libro en la interfaz

- [ ] 3.1 Añadir en `ConfigPanel` (sección Hábito) el switch «meta propia de este libro» y su input, espejo del control de hitos; textos nuevos en es/en/pt. Verificación: manual en dev — activar fija el valor, desactivar vuelve a heredar, cambiar el mínimo global mueve solo a los libros que heredan; `rg "config\..*bookGoal" src/lib/i18n` aparece en los tres idiomas con las mismas claves.
- [ ] 3.2 Añadir el campo de meta al `EditBookDialog` del inicio (vacío = heredar) y refrescar la tarjeta al guardar. Verificación: manual desde una tarjeta — fijar y retirar la meta persiste tras recargar y la tarjeta refleja la meta efectiva resultante.

## 4. Páginas de hoy del libro

- [ ] 4.1 En `use-reading-session`, exponer las páginas de hoy del libro (base de sesiones de hoy + contador monótono de la sesión, según D4) y corregir el tipo del lector a `BookWithSessions`. Verificación: `bunx tsc --noEmit` limpio; manual — con sesiones de hoy, el par inicial es el correcto; avanzar dos páginas lo sube sin recargar; un salto por el riel no lo mueve.
- [ ] 4.2 Cambiar en `ReaderHeader` el par `páginas/meta` al del libro con tooltip nuevo en es/en/pt, dejando racha global y minutos de sesión intactos. Verificación: manual a 1280×800 y 390×844 — el par del libro se lee y actualiza, racha y minutos no cambian; sin tokens nuevos de color (par de texto atenuado ya auditado).

## 5. Resumen de hoy en las tarjetas

- [ ] 5.1 Pintar en `BookCard` el resumen de actividad de hoy (páginas y minutos) junto al avance hacia la meta efectiva, sin resumen cuando no hay actividad de hoy; textos en es/en/pt. Verificación: manual con un libro con sesiones de hoy y otro sin ellas; en la pestaña Network, abrir el inicio no dispara peticiones nuevas de datos (solo el `/api/books` de siempre).

## 6. Cierre

- [ ] 6.1 Correr la verificación completa y anotar salidas en el change: `bunx tsc --noEmit`, `bun run lint`, `bun run crap` (objetivo CC ≤30 de `CRAPPER.md`), `node scripts/test-vn-stress.js` y `node scripts/test-hotkeys-e2e.js`. Verificación: todo en verde o con desviaciones justificadas por escrito; `openspec validate camara-suave-y-metas-por-libro --strict` sin hallazgos nuevos.
- [ ] 6.2 Pasada de contraste de los textos nuevos pequeños (resumen de tarjeta y tooltips) con el método de la auditoría del lector si tocan pares no auditados. Verificación: medición ≥4,5:1 o confirmación de que reutilizan pares ya auditados (`muted-foreground` sobre `card`).

## Workflow follow-up

- Archivar el change cuando la verificación cierre y las specs principales queden sincronizadas.
