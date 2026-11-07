# Tasks: nucleo-unico-core

## 1. Corte y movimiento

- [x] 1.1 Clasificar los módulos de `src/lib/`: reglas puras vs pegamento
      (criterio: sin Next.js/React/Prisma/PDF.js/zustand en runtime)
- [x] 1.2 `git mv` de 12 módulos + 10 tests a `src/core/` (historia preservada)
- [x] 1.3 `src/lib/` queda con el pegamento: `db`, `pdf-client`, `ocr`,
      `camera`, `settings`, `library-folder`, `teleprompter-images`,
      `cover-search`, `i18n`, `view-anim`, `utils`,
      `map-get-or-insert-polyfill`

## 2. Reescritura de imports

- [x] 2.1 Estáticos con comillas dobles y simples (`from "@/lib/X"` /
      `from '@/lib/X'`) en src/ y tests/
- [x] 2.2 Dinámicos (`import("@/lib/X")` en tipos inline y en
      `instrumentation.ts`) y el relativo `./step-timer` del test del
      teleprompter
- [x] 2.3 Byte NUL crudo del fixture de `siguienteSeguro` → escape `\x00`
      (el fuente vuelve a ser texto para ripgrep; mismo runtime)

## 3. Frontera y documentación

- [x] 3.1 Verificado: cero imports `core → lib` (`rg '@/lib/' src/core/`
      vacío); `lib → core` permitido (settings y hooks ya consumen el núcleo)
- [x] 3.2 `AGENTS.md`: balas de `src/core/` y `src/lib/` con la regla de
      dirección y referencias de `data-home` al día
- [x] 3.3 `bin/athena`, `.env.example` y `docs/SELFHOSTING.md` apuntan al
      núcleo; records históricos de `openspec/changes/**` intactos

## 4. Validación

- [x] 4.1 `bunx tsc --noEmit` en verde
- [x] 4.2 `bun run lint` en verde
- [x] 4.3 `bun test` en verde (131 tests, 0 fallos)
