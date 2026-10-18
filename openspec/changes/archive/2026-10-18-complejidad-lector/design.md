# Design

## Context

Ver `proposal.md`. `ReaderView` concentra modo de visor (EPUB/PDF página/PDF texto), montaje del stage, inmersión y persistencia de progreso; `TeleprompterOverlay` concentra motor del player, rebobinado, scroll de seguimiento, ventana de DOM y encadenado. El CC cuenta también `&&`/`||`/`??` dentro del JSX (config de ESLint del repo; spec `CRAPPER.md`).

## Goals / Non-Goals

**Goals:**

- `ReaderView` y `TeleprompterOverlay` con CC ≤ 30 y `bun run lint` sin warnings de complejidad.
- Comportamiento idéntico: mismos atajos, mismos tiempos, mismo scroll, misma UI.

**Non-Goals:**

- Tocar `src/components/ui/` (exento por CRAPPER.md).
- Perseguir la métrica en el resto del repo.
- Cambiar la estructura de datos o la persistencia.

## Decisions

### D1 — Extraer por preocupaciones ya presentes, no por tamaño

Se extraen las unidades que ya existen como concepto dentro del componente (reglas 3–4 de CRAPPER.md), no cortes arbitrarios:

- `TeleprompterOverlay`: control del player (play/pausa/rebobinado/encadenado) a un hook; seguimiento de scroll y ventana de DOM a otro si siguen dentro del componente.
- `ReaderView`: modo de visor y su persistencia a hook; los bloques de render repetido a subcomponentes solo si el CC o la duplicación lo piden.

- **Por qué**: los hooks existentes (`use-reader-hotkeys`, `use-immersive-wake`) ya marcan el patrón de la casa; extraer por concepto mantiene el diff legible.
- **Alternativas descartadas**: subir el umbral del lint — contradice `CRAPPER.md`; trocear por número de líneas — indirección sin valor.

### D2 — Palancas de CC, en orden

1. Guard clauses antes que anidación.
2. Un nivel de abstracción por función.
3. Mapas de objetos en vez de `switch`/cadenas de condiciones que solo eligen valores.
4. Condiciones largas del JSX (cuentan para el CC) a helpers nombrados.

- **Por qué**: son las reglas del propio spec; mismo resultado, sin reescritura de lógica.

## Risks / Trade-offs

- **Regresión sutil en atajos/scroll/encadenado** → correr la suite existente (motor del teleprompter, estrés 21/21, hotkeys e2e) y corrida manual guiada por cada grupo.
- **Sobre-extracción (hooks de un solo uso sin valor)** → extraer solo donde el CRAPPER lo pide; si un hook queda trivial, volver a inline.
- **Los conteos de CC dependen de la versión de ESLint** → verificar con el `bun run lint` del repo, que es la fuente de verdad.

## Migration Plan

Sin datos ni estado persistido. Rollback: revertir el refactor.

## Open Questions

Ninguna.
