# Design

## Context

Explore de performance del 2026-10-23: pdf.js ya es lazy, índices SQLite OK, i18n OK — solo sobreviven los tres levers promovidos a este change. Véase proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- (a) payload y trabajo de `GET /api/books` proporcional a *días de lectura*, no a *sesiones totales*.
- (b) tick del teleprompter que no re-pinta el árbol completo del overlay.
- (c) bundle inicial del lector sin pdf.js/epub hasta abrir el stage.
- Cada lever con número antes/después (no "se siente más rápido").

**Non-Goals:**
- Cambios de API observable (spreadshape, campos, códigos de error = intactos).
- Migraciones, índices nuevos (los existentes sirven), caché server, virtualización del stream, `next/dynamic` a medias en otros puntos (solo los 3 levers).
- Spec delta (skip_specs: true — zero-delta).

## Decisions

1. **(a) Agregación por día conservando el campo `sessions`.** Las sesiones se escriben **sin `date`** (el `@default(now())` deja timestamp completo), así que el agrupado real se hace en SQL con día truncado: `$queryRaw` `SELECT bookId, strftime('%Y-%m-%d', date, 'localtime') AS day, SUM(pagesRead), SUM(minutes) FROM ReadingSession GROUP BY bookId, day` — el día es el de la **máquina local** del servidor, que es el mismo dominio que hoy usa el cliente (`groupSessionsByDay(new Date(s.date))` en el navegador del mismo servidor self-host). Cada fila viaja en `sessions` con `date: "${day}T12:00:00"` (mediodía local sin zona): `new Date()` del cliente no desliza el día en ninguna TZ. La forma sigue compatible: `groupSessionsByDay(rows)` reduce por igual sobre filas ya agrupadas (pagesRead/minutes suman igual; día intacto). Alternativa descartada: cambiar la forma de la API (sessionsByDay como campo nuevo) — obligaría a tocar todos los consumidores por un beneficio que ya está en la agregación.
2. **(b) Costear el tick sin rediseñar el hook.** Opciones por perfil de render, la primera que salga limpia gana: (i) `React.memo` en los subárboles que no consumen `lit` (stream, chrome, notice si no la usa), dejando el re-render vivo solo en el token de progreso; (ii) mover `lit` de estado del hook a un componente mínimo (`TickPct`) suscrito por `ref` + `requestAnimationFrame`. El hook ya mantiene `litRef` espejo, así que (ii) no inventa estado. La decisión se toma con satisfactorio-perfile: contar renders/tick antes y después.
3. **(c) `next/dynamic(() => import("./ReaderStage"), { ssr: false })`** en `ReaderView`. El stage es la frontera correcta: pdf.js/epub engine viven adentro y no hay render server del lector que lo necesite. Medición (aplicada): en el runtime self-host (`bun run dev`) el boot de `/` ya no descarga pdf.js (0 peticiones) ni el resto del stage; una excepción queda documentada: **JSZip (~94 kB, 1 fetch) sí entra al boot** porque `use-epub-book` es import estático de `ReaderView` y arrastra `lib/epub.ts`; sacar el hook sería el boundary por-vista ya descartado. En el `next build` de Turbopack (Next 16) el HTML prerenderizado de `/` todavía lista los chunks del stage como `<script async>` (1228→1231 kB, sin bajar; el split físico sí ocurre, 602→511+94 kB) — limitación del prerender, no del boundary. Alternativa descartada: dynamic por vista (PdfTextView/EpubView) — más granular pero mismo ahorro; React.lazy+Suspense tuvo el mismo resultado que dynamic en build (1229 kB con lazy) y `next/dynamic` es la forma canonical del framework. Verificación funcional (task 4.2): abrir PDF = +4 fetches pdfjs post-boot; abrir EPUB = +3 fetches jszip/epub post-boot; 0 pageerror/console en ambas (visor epub reutiliza `data-viewport="pdf"` + `kind="epub"`).
4. **Commit por lever** (a/b/c independientes): cada uno con su medición; revert selectivo sin dragar los otros.

## Risks / Trade-offs

- [(a) rompe algún consumidor oculto] → task 2.1 grep maestro de `sessions` (`.cart.length` no existe hoy: verificado por ejemplo BookCard/use-library-books solo group-by-day); si aparece un uso unit-sesión, la palanca (a) se para y se re-aborda con shape nuevo y consumers actualizados en el mismo lever.
- [(b) memo congela algo que sí depende del tick] → satisfying-profile antes/después del reloj vivo de la sonda (camara-suave 8/8 + page-notice) obligatorio en task 5; si (b-i) congela, cae a (b-ii).
- [(c) ssr:false manteca hidratación] → ReaderStage no renderiza SSR hoy (cliente-only); verificación misma de la tarea.
- [Payload books sigue creciendo con días] → crecerá a ritmo de días (≤1/lectura/día),pared con el histórico infinito de sesiones.

## Migration Plan

Sin datos ni flags. Cada lever: commit + medición; SE puede revertir por lever.

## Open Questions

(ninguna que bloquee)
