# Proposal: biblioteca-feedback-hoy

## Why

El feedback del hábito en el inicio es confuso: cuatro StatCard con el mismo peso visual,
«páginas de hoy» expresado dos veces con formatos distintos (franja global y párrafo plano en
cada tarjeta), sin estados visuales («sin empezar / en curso / meta cumplida» solo se
insinúan con texto pequeño) y con la meta global y la de libro mezcladas en el mismo plano.
La dueña lo resume: «debería aportar claridad; algunos avisos se ven simples, como una
revista». El spec `reading-habit` ya exige señalar el cumplimiento y no inventar progreso;
falta el lenguaje visual.

## What Changes

- Lenguaje canónico de 3 estados (sin empezar / en curso / meta cumplida) con color, icono y
  microcopy fijos en es/en/pt, compartido por franja, tarjetas y cabecera del lector.
- Nuevo componente `TodayRing` (SVG, stroke-dasharray, sin librerías): anillo de progreso con
  el par `n/goal` en cifras tabulares al centro y `aria-label` descriptivo.
- Franja de hábitos rediseñada: una tarjeta protagonista «HOY» (anillo + estado + contexto:
  minutos y racha) y tres tarjetas compactas secundarias (racha, minutos, libros terminados).
- Nuevo `TodayPill` en cada `BookCard`: estado de hoy de ESE libro contra su meta efectiva,
  fijo bajo el mini-riel (visible sin hover a 320 px). Sin lectura hoy la píldora declara
  «SIN LECTURA HOY» en gris —nunca progreso inventado. La tarjeta del libro con lectura hoy
  lleva el borde con offset azul (tratamiento brutal del design system).
- Selector memoizado `useTodaySummary()` compartido (una sola agregación por render).
- Mejora barata de paint: `content-visibility: auto` + `contain-intrinsic-size` en tarjetas.

## Impact

- Affected specs: `reading-habit` (añade «Lenguaje de estados de hábito»; modifica «Mínimo
  diario de lectura» y «Resumen de hoy en las tarjetas del inicio»).
- Affected code: `src/components/library/LibraryView.tsx`, `src/components/library/BookCard.tsx`,
  `src/components/library/TodayRing.tsx` (nuevo), `src/hooks/use-library-books.ts`,
  `src/lib/i18n/{es,en,pt}.ts`.
- Sin API nueva: los datos ya viajan en `BookWithSessions.sessions` y en `stats`.
