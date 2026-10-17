# CRAPPER — Spec de calidad de código (Uncle Bob) para Riel

Herramienta vendida en `tools/crapper/` (clone de [unclebob/crapper](https://github.com/unclebob/crapper)).
Mide la métrica CRAP sobre el código de `src/` y sirve como **spec que todo código generado
por IA en este proyecto debe respetar**.

## La métrica

```text
CRAP = CC² × (1 − cobertura)³ + CC
```

- `CC` = complejidad ciclomática de la función (decisiones: `if`, bucles, `catch`, `?:`,
  etiquetas de `switch`, `&&`, `||`, `??`, `?.` — incluidos `&&` dentro de JSX).
- `cobertura` = fracción de la función ejercida por tests. Sin tests = 0% = el peor caso.
- Bandas oficiales: **1–5 riesgo bajo · 5–30 merece mirada · 30+ complejo y sin tests**.

## Cómo correrlo aquí

```bash
bun run crap            # tabla ordenada peor-primero + snapshot .metrics/crap.edn
bun run crap:changed    # solo archivos cambiados (requiere git)
```

Exit codes: `0` OK · `1` uso inválido · `2` umbral excedido (`--threshold N`).

## Presupuestos (las reglas que sigo al generar código)

| Tipo de unidad                                      | CC objetivo | CC tope duro |
| --------------------------------------------------- | ----------- | ------------ |
| Función pura / helper / handler suelto              | ≤ 8         | 15           |
| Función de API route (GET/POST/PATCH/DELETE)        | ≤ 10        | 15           |
| Componente React de vista (página completa)         | ≤ 30        | 50           |
| Componente UI primitivo (shadcn vendido, no tocar)  | exento      | exento       |

Reglas de higiene que bajan CC sin tocar comportamiento:

1. **Guard clauses antes que anidación** — salir temprano, nunca pirámides de `if`.
2. **Un nivel de abstracción por función** — si un `if` esconde un flujo completo, extraer.
3. **Extraer hook antes que crecer** — lógica de efecto/atajos/suscripciones vive en
   `src/hooks/`, no dentro del componente (ver `use-reader-hotkeys.ts`, `use-immersive-wake.ts`).
4. **Extraer subcomponente antes que crecer** — JSX repetido o un bloque visual autocontenido
   se va a su propio archivo.
5. **Switch → mapa de objetos** cuando los casos solo eligen valores.
6. **Nada de lógica con > 3 niveles de ternarios** — es un `if` disfrazado.

## Estado y trayectoria

- Línea base 2026-10-13 (344 funciones): los monstruos históricos eran
  `ReaderView` (167), `PdfViewport` (131), `DictionaryPopover` (72),
  `LibraryView` (66), `EditBookDialog` (63), `RailBar` (52).
- **Dieta completa (Task 16, sin cambio de comportamiento):** los seis monstruos
  quedaron dentro del presupuesto de vista (≤30):
  `ReaderView` 29 · `PdfViewport` 26 · `LibraryView` 26 · `EditBookDialog` 28 ·
  `RailBar` 26 · `DictionaryPopover` fuera del top. La lógica vive en hooks
  propios (`src/hooks/`: use-pdf-render, use-ocr-page, use-ocr-lang,
  use-copy-text, use-reading-session, use-book-extras, use-book-milestones,
  use-finish-badge, use-milestone-celebration, use-peek-gesture,
  use-zoom-preset, use-rail-scrub, use-dictionary-popover, use-word-selection,
  use-library-books, use-book-upload, use-book-actions, use-cover-manager) y en
  subcomponentes presentacionales (OcrOverlay, ReaderHeader, ReaderStage,
  SyncProgressPopover, ZoomControls, PauseDialog, DictionaryCard,
  DictionaryEntries, BookCard, LibraryConfirmDialogs, RailTrack).
- El snapshot vive en `.metrics/crap.edn`; se regenera en cada corrida.
- **Código nuevo: nace dentro de presupuesto.** Los monstruos ya dietados no
  vuelven a engordar: si un toque los crece, se extrae pieza en el mismo cambio.
- Cuando el proyecto tenga suite de tests con cobertura (LCOV), correr crapper SIN
  `--no-coverage` y fijar `--threshold 30` como puerta de CI: ahí CRAP mide riesgo real.
