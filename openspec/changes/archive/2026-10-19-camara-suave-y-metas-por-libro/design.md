# Design

## Context

Ver `proposal.md`. Estado actual que condiciona el cómo:

- La vista del teleprompter la mueve `scrollToChar` (`src/hooks/use-teleprompter-window.ts:68`) con `scrollTop` imperativo tras cada paso del motor (`use-teleprompter-player.ts:214`). Los saltos visibles nacen en: título (bloque que se enciende entero y mueve la cámara), cruce de página (la ventana de dos páginas cambia el DOM y la posición se reacomoda), revelado completo e instantánea (salto al final) y rebobinado. `globals.css` tiene una REGLA DE ORO para este modo: sobre el texto solo se animan `opacity` y `color`, nunca `transform` ni `filter`.
- El hábito vive hoy en `settings.reading.dailyGoal` (global, 1–500), pintado en la franja del inicio (`LibraryView`), en la cabecera del lector (`ReaderHeader:303`) y editado en `ConfigPanel` (sección Hábito). El dato «hoy» sale de `sessions` por libro (`date`, `pagesRead`, `minutes`), ya presentes en `/api/books`; `use-reading-session` tiene el contador de la sesión activa y stats globales congeladas al entrar (comentario admitido en `ReaderView:391`).
- Precedente exacto para la meta por libro: `milestones` (`Int?`, null = global) con switch en `ConfigPanel`, validación en `PATCH /api/books/[id]` y restauración en `POST /api/books/undo`.
- El conteo de páginas tiene semántica asentada: gira página normal = cuenta; salto silencioso (riel, saltador, sincronización) = no cuenta.

## Goals / Non-Goals

**Goals:**

- Matar los saltos en seco de la vista con una transición breve por orden de cámara, sin dependencias nuevas y sin violar la regla de oro del modo.
- La relectura manual manda; el seguimiento se resincroniza sin tirones.
- Meta por libro heredable del mínimo global, persistida en la base (viaja en el respaldo), editable en lector e inicio.
- «Hoy del libro» en la cabecera, vivo durante la sesión, con la misma semántica de conteo que ya existe.
- Resumen de hoy por tarjeta sin viaje extra al servidor.

**Non-Goals:**

- Deslizamiento continuo estilo «créditos» ni follow por frame permanente (decidido: solo suavizar los saltos).
- Cambiar el motor de encendido, la pausa de títulos, el instantáneo o la herencia de hitos.
- Metas por período (semanal), estadísticas históricas nuevas o rediseño de la franja del inicio.
- Tocar la racha global, los minutos de sesión o el ETA.

## Decisions

### D1. Transición de vista por orden de cámara, no follow continuo

Se anima cada movimiento: `scrollToChar` pasa a fijar un objetivo y un pequeño animador (un solo `requestAnimationFrame` activo a la vez) lleva `scrollTop` desde la posición actual al objetivo con duración escalada por distancia (≈90 ms para pasos de línea, hasta ≈400 ms para saltos grandes), con ease-out. Alternativas: `scroll-behavior: smooth` de CSS (rechazada: cada reasignación por carácter reinicia la animación y se apila) y follow por frame con easing permanente (rechazada por el usuario: quiere los saltos suavizados, no un flujo continuo).

Detalle que evita el «peor caso»: al reanudar tras un movimiento manual no se anima desde una posición vieja; el objetivo se recalcula contra el DOM real antes de animar.

### D2. Movimiento reducido e instantánea: sin animación

Si `prefers-reduced-motion` o el preset es instantáneo, el animador no se activa: la vista salta como hoy. Es la lectura coherente de la spec existente («Instantánea o movimiento reducido») y del bloque `@media (prefers-reduced-motion)` de `globals.css`.

### D3. Meta por libro en la base, patrón hitos

Campo `Book.dailyGoal Int?` (null = mínimo global). Alternativa rechazada: mapa `{bookId: meta}` en ajustes/localStorage — no viaja en el respaldo documentado (db + uploads) y se desincroniza si el libro se reimporta. `db push` (SQLite, sin migraciones en el repo), PATCH con tope 1–500, campo añadido a la whitelist de restauración de `undo` (la instantánea ya guarda la fila completa) y a `BookDTO`.

Resolución de la meta efectiva en cliente: `book.dailyGoal ?? settings.reading.dailyGoal`. No se duplica el valor global dentro de cada libro.

### D4. «Hoy del libro» = base de servidor + contador vivo monótono

Base: sesiones de hoy del libro (misma `groupSessionsByDay`/`dayKey` de `lib/reading.ts`). Vivo: un contador que sube con cada página que `turn()` registra. Se usa este contador y no `pending.pages` porque `pending` se vacía con cada volcado al servidor (el contador bajaría al guardar). La base se lee al montar y no se recalcula dentro de la sesión; el servidor sigue guardando igual que hoy.

La cabecera cambia su par `páginas/meta` al del libro; racha y minutos no se tocan. El lector ya recibe el objeto con `sessions` en runtime (el tipo lo ocultaba): se corrige el tipo a `BookWithSessions` en vez de leer una propiedad escondida.

### D5. Resumen de hoy en la tarjeta desde `sessions`

Páginas y minutos de hoy se suman de `book.sessions` (ya en el payload). La tarjeta muestra el resumen junto al avance hacia la meta efectiva; sin sesiones de hoy, no pinta progreso falso. La meta se edita desde `EditBookDialog` (vacío = heredar), espejo del control del lector. Textos nuevos en es/en/pt; tipografía y colores según `DESIGN.md` (texto pequeño atenuado ya usado por el ETA, mismo par de contraste auditado).

### D6. Dónde vive cada pieza

- Animador: junto al dueño del scroll (`use-teleprompter-window`), consumido por el motor; la resincronización manual se conecta en `TeleprompterOverlay` (rueda y `↑` ya tienen handler).
- Todo el hábito por libro: sin API nueva, sobre PATCH y `/api/books` existentes.

## Risks / Trade-offs

- [La animación compite con el cambio de DOM del cruce de página] → el objetivo se recalcula tras actualizar la ventana; si el contenido cambió, se anima desde la posición actual hasta el objetivo nuevo (nunca desde un valor obsoleto).
- [Rueda/`↑` a mitad de animación] → cualquier scroll manual cancela la animación y sincroniza el objetivo; el handler de relectura ya pausa el avance.
- [Contador de hoy doble o menguante] → base inmutable de montaje + contador monótono de sesión; nada cuenta dos veces porque el volcado no participa del cálculo visual.
- [Restauración de undo sin el campo] → añadirlo a la whitelist; si un libro viejo vuelve sin meta, hereda el global (inofensivo).
- [Scripts de timing del teleprompter (`audit_teleprompter_timing.py`) sensibles al movimiento] → correrlos tras el cambio y, si miden scroll, ajustar el criterio solo si el nuevo comportamiento es el correcto.
- [Contraste de textos nuevos pequeños] → usar pares ya auditados (`muted-foreground` sobre `card`); sin tokens nuevos.
- Trade-off aceptado: los pasos de línea pequeños también se animan (corto), aunque no sean «bruscos»; es lo que garantiza que nada aparezca de golpe.

## Migration Plan

1. `bun run db:push` (columna nullable; sin pérdida de datos). Libros existentes quedan con `dailyGoal = null` → mínimo global.
2. Rollback: revertir el commit; la columna extra no rompe nada (el código viejo la ignora).
3. Verificación mínima: `bunx tsc --noEmit`, `bun run lint`, `bun run crap` (CRAPPER.md: CC ≤30 objetivo), script de timing del teleprompter y pasada manual de cámara/actualización viva.

## Open Questions

- Copy y formato exactos del resumen de tarjeta («hoy: 12 pág · 25 min») y su lugar fino dentro de la tarjeta: se decide en la revisión visual; no cambia specs ni enfoque.
