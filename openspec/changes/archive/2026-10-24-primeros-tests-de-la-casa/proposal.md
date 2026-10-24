# Propuesta — primeros tests de la casa (puros + round-trip del config)

## Intención

Primera red de seguridad del repo (Fase 1 del roadmap, «Guardarraíles»): tests
que corren con `bun test`, sin servidor, sin mocks de más. Cubren las funciones
que *deciden* por la app y que hoy vuelan sin red: el saneo de ajustes
(`saneaAjustes`), el riel (`milestonePages`) y el round-trip real de
`db/config.json`. Con esto, cualquier cambio futuro en esas decisiones rompe un
test antes que la interfaz.

## Goals

- `saneaAjustes`: cada bloque validado contra su caso límite (valores fuera de
  rango, tipos equivocados, ausentes), migraciones tolerantes
  (`speedPreset` → `wps`, `instante`), `toggleKey` (1 letra, minúscula),
  `fondoRuta` (solo `/uploads/`), `extraKeys` raras conservadas al reescribir.
- `milestonePages(n, segments)`: tramos crecientes, último = total, segments
  clamped, totalPages 0/negativo sin explotar.
- Round-trip `leerAjustes`/`escribirAjustes` con sandbox (cwd temporal):
  `created` cuando falta, fichero inicial con defaults + `_doc`, JSON legible
  (2 espacios + salto final), claves raras de la raíz que sobreviven a la
  reescritura, config roto → renombrado a `.roto-*` y arranque con defaults.
- Todo con cwd restaurado en `afterEach` (lección de la revisión anterior)
  y `bun test` en verde por whole suite.

## Non-goals

- API de libros (subida/progreso/reset/cover): siguiente change, con andamio
  de BD y disco de mentira.
- Componentes React y hooks (happy-dom queda instalado para más adelante).
- Tocar código de producción salvo lo imprescindible para hacer testeable
  (hoy no se prevé nada).
- Nuevas dependencias.

## Anti-goals

- Tests que mockean tanto que no prueban nada.
- Cualquier cosa que dependa de un server vivo o de la red.
- Escribir el fichero real `db/config.json` de la dueña (sandbox siempre).

## Constraints

- `bun test`, patrón de sandbox ya usado en `src/lib/access.test.ts`
  (`tests/.sandbox` + `process.chdir`, nunca `db/` real).
- Sin dependencias nuevas; sin cambios de lint/tsc.
- Los tests se organizan por fichero fuente: `config-file.test.ts`,
  `reading.test.ts` (el riel nació en `reading.ts`).

## Enfoque (mi decisión, única vía razonable)

Tests directos a la función pura + round-trip con `process.chdir` a sandbox,
igual que el candado ya hace. Las alternativas (levantar server, mockear el
fs) rompen el «sin server vivo» sin aportar: las funciones puras no necesitan
server y el fs se cubre con el sandbox real.

## Lo que se deja al constructor

La enumeración exacta de casos por bloque, el orden RED→GREEN por bloque
(saneo → riel → round-trip) y el commit por cada bloque verde.
