# Proposal: nucleo-unico-core

## Why

Las reglas de la casa viven mezcladas en `src/lib/` con el pegamento de
terceros (Prisma, PDF.js, Tesseract, zustand). Sin una frontera clara, cada
cambio nuevo puede acoplar reglas a infraestructura, y el sync LAN planeado
necesita un núcleo único al que llamar sin arrastrar dependencias de UI ni
de framework. Es la fase 5 del plan de trabajo acordado con la dueña:
«núcleo único src/core».

## What Changes

- Nuevo directorio `src/core/`: reglas y contratos de la casa SIN Next.js,
  React, Prisma, PDF.js ni zustand en runtime (JSZip cabe: parseo sin I/O;
  las referencias de tipo de pdfjs-dist también: se evaporan al compilar).
- Se mueven 12 módulos con sus tests (`git mv`, cero cambios de lógica):
  `types`, `reading`, `access`, `data-home`, `config-file`, `undo-store`,
  `pdf-text`, `pdf-text-index`, `epub`, `teleprompter`, `touch-gestures`,
  `step-timer`.
- `src/lib/` queda como pegamento con terceros y estado de UI: `db`,
  `pdf-client`, `ocr`, `camera`, `settings` (zustand), `library-folder`
  (Prisma), `teleprompter-images` (depende en runtime de `pdf-client`),
  `cover-search`, `i18n`, `view-anim`, `utils`, `map-get-or-insert-polyfill`.
- Regla de dirección: `lib → core` permitido; `core → lib` prohibido.
- Fixture del test de `siguienteSeguro` reescrito como escape `\x00`:
  antes viajaba un byte NUL crudo incrustado en el fuente, que hacía que
  ripgrep (y otras herramientas) trataran el fichero como binario y lo
  saltaran. Mismo valor en runtime, fuente text-clean.
- Referencias vivas actualizadas: `AGENTS.md` (estructura y regla de
  dirección), `bin/athena` (comentario), `.env.example`,
  `docs/SELFHOSTING.md`. Los records de changes anteriores en
  `openspec/changes/**` no se tocan: son historia, no mapa vivo.

## Impact

- Affected specs: ninguno (refactor puro: cero cambios de comportamiento,
  mismo contrato `{ ok, data?, error? }`, mismo motor offline del APK).
- Affected code: 12 módulos + 10 tests movidos; los ficheros que consumen
  esos módulos con imports reescritos (`@/lib/X` → `@/core/X` en formas
  estáticas, dinámicas `import(...)` y con comillas simples o dobles);
  `AGENTS.md`, `bin/athena`, `.env.example`, `docs/SELFHOSTING.md`.
- Validación: `bunx tsc --noEmit`, `bun run lint` y `bun test` en verde
  (131 tests, 0 fallos).
