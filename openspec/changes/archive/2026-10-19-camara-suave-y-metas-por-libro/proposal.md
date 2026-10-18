# Proposal

## Why

Tres molestias reales de uso diario. La vista del teleprompter da saltos en seco —al aparecer un título, al cruzar de página, al revelar de golpe o al rebobinar— y el texto «aparece de golpe». La cabecera del lector solo muestra las páginas de hoy de **todos** los libros, congeladas al entrar, cuando lo útil al leer es saber cuánto llevas hoy en **este** libro contra su meta. Y la meta diaria es una sola para toda la biblioteca: un libro de consulta no se mide igual que una novela, así que hace falta una meta propia por libro (heredando el mínimo global), visible y ajustable desde el inicio.

La meta global no desaparece: queda como **mínimo diario del lector** y como valor por defecto de cada libro.

## What Changes

- **Vista suave del teleprompter**: los movimientos de vista del flujo (línea, título, cruce de página, revelado completo y rebobinado) se acompañan con una transición breve y continua en lugar de saltos en seco. La relectura manual manda: el seguimiento se resincroniza sin pelearse con la rueda ni con `↑`. Con movimiento reducido o preset instantáneo no hay animación, como hoy.
- **Meta propia por libro (heredable)**: `Book.dailyGoal` opcional; `null` = usar el mínimo global de ajustes, con el mismo patrón ya probado de los hitos (`milestones`). Se edita en el lector (ConfigPanel, sección Hábito, junto a «hitos de este libro») y también desde el inicio, en el diálogo de edición que abren las tarjetas.
- **Páginas de hoy del libro en la cabecera del lector**: el par `páginas/meta` de la cabecera pasa a ser **del libro** (hoy: 12/30), vivo durante la sesión; la racha sigue global y los minutos de sesión quedan igual. La franja de hábitos del inicio sigue mostrando el mínimo global.
- **Resumen de hoy en las tarjetas del inicio**: cada tarjeta muestra el resumen de actividad de hoy —páginas y minutos («hoy: 12 pág · 25 min»)— junto al avance hacia la meta efectiva del libro. El dato ya viene en el payload de la biblioteca (`sessions`); no hay viaje extra al servidor.

## Capabilities

### New Capabilities

- `reading-habit`: el hábito de lectura visible y configurable — mínimo diario global, meta propia por libro heredable, páginas de hoy del libro en la cabecera del lector y resumen de hoy en las tarjetas del inicio.

### Modified Capabilities

- `teleprompter`: se añade el requisito de vista sin saltos en seco (transición breve en los movimientos de la columna, respetando movimiento reducido e instantánea).

## Impact

- Lector: `use-teleprompter-window.ts` (seguimiento de vista), `TeleprompterOverlay.tsx` (resincronización con scroll manual), `ReaderHeader.tsx` (par del libro), `ReaderView.tsx` (pasar páginas de hoy del libro), `use-reading-session.ts` (contador vivo por libro), `ConfigPanel.tsx` (meta propia por libro).
- Inicio: `BookCard.tsx` (resumen de hoy y meta), `EditBookDialog.tsx` (meta por libro), `LibraryView.tsx` (franja sin cambios salvo lo que ya muestra).
- Datos: `prisma/schema.prisma` (`Book.dailyGoal Int?`), `PATCH /api/books/[id]` (campo nuevo con tope 1–500), `POST /api/books/undo` (restauración de la instantánea), `src/lib/types.ts` (`BookDTO`).
- i18n es/en/pt: textos nuevos del hábito por libro.
- Límites declarados: sin migración de datos (SQLite con `db push`); la meta no se toca al reiniciar progreso; sin cambios en el motor de encendido ni en la herencia de hitos.
