# Plan — primeros tests de la casa (puros + round-trip del config)

> **For agentic workers:** REQUIRED SUB-SKILL: usar ejecución nativa en sesión (equivalente a executing-plans). Pasos con checkbox para tracking.

**Goal:** Red de seguridad local con `bun test` (sin server, sin mocks): pina el saneo de ajustes, el riel y el round-trip real de `db/config.json`.

**Architecture:** Tests directos a funciones puras + round-trip con sandbox (cwd temporal bajo `tests/.sandbox`), mismo patrón que `src/lib/access.test.ts`. Nada de server vivo; nada de tocar el `db/` real de la dueña.

**Tech Stack:** bun 1.4.4 (`bun test`), TypeScript, node:fs.

**Spec:** `openspec/changes/primeros-tests-de-la-casa/proposal.md`

## Global Constraints

- Sandbox en `tests/.sandbox`: `mkdirSync("tests/.sandbox/db")`, `process.chdir` dentro, y `afterEach` restaura el cwd original ANTES de borrar (lección de la revisión del candado: restaurar cwd, no `chdir("/")`).
- Nunca escribir `db/config.json` real (los tests corren con cwd en sandbox).
- Los contratos afirmados son los del `src/lib/config-file.ts` y `src/lib/reading.ts` de HOY (comportamiento actual documentado en sus comentarios): si un test sale rojo, es un hallazgo — se arregla la raíz en producción SOLO si contradice el contrato (clamps/defaults documentados); si la expectativa estaba mal, se corrige el test.
- Sin dependencias nuevas; `bun test` corre la suite entera (no filtros por ruta salvo para depurar).

## Review Focus

1. Config gigante (>256 KB, `MAX_SIZE`): `leerAjustes` debe tratarlo como roto (renombra `.roto-*`, arranca con defaults, `created: true`) — Task 3, Step 4.
2. `db/` que no existe en el sandbox: `escribirAjustes` lo crea (`mkdir` recursive) — Task 3, Step 2.
3. Escritura atómica: después de `escribirAjustes` NO queda ningún `config.json.tmp-*` en disco — Task 3, Step 3.
4. `milestonePages` con `segments` raros (0, negativo, NaN, float): array vacío o acotado, nunca excepción — Task 2, Step 2.
5. `saneaAjustes(null)` o raíz no-objeto: todo a defaults, `created` no aplica (es pura) — Task 1, Step 2.

---

### Task 1: pinar el saneo de ajustes (`config-file.test.ts`)

**Files:**
- Create: `src/lib/config-file.test.ts`
- Consumes: `saneaAjustes` de `@/lib/config-file`; constantes de `@/lib/types` (`TELEPROMPTER_WPS_DEFAULT = 2.5`, `wpsDePresetAntiguo`).

**Interfaces:**
- Consumes: `saneaAjustes(raw: unknown): AppSettings & { modes: ModesFichero }`.
- Produces: nada (solo tests).

**Reglas exactas (valores del código actual, ya leídos):**
- Defaults: lang `"es"` · rail `{position:"left", segments:10, theme:"egeo", showLabels:true, celebrate:true}` · filters `{preset:"auto", brightness:100, contrast:100, sepia:0, saturate:100, warmth:0, invert:0}` · reading `{dailyGoal:20, scrollStepPct:40, wheelBoost:1, font:"literata"}` · immersion `{enabled:true, idleSeconds:4, toggleKey:"h"}` · teleprompter `{wps:2.5, instante:false, sound:true, auto:false, fontScale:1, fondo:"tema", fondoRuta:"", fondoFiltro:55, tarjetasPorFrase:true}` · modes `{toggles:{xray:true, naturalPauses:false, argumentSkeleton:false, lockedNotes:false, dualRead:false, outline:true, dictionary:true}, pauseMinutes:25}`.
- Clamps: `rail.segments` 2..40 · `filters.brightness/contrast` 0..200 · `filters.sepia/saturate/warmth/invert` 0..100 · `reading.dailyGoal` 1..500 · `scrollStepPct` 10..100 · `wheelBoost` 1..5 · `immersion.idleSeconds` 2..12 · `pauseMinutes` 5..120 · `teleprompter.wps` 0.8..4 (sin redondear) · `fontScale` 0.8..1.6 (sin redondear).
- Listas cerradas: `rail.position` bottom|top|left|right · `rail.theme` egeo|dynamic|amber|emerald|rose|violet|cyan · `filters.preset` auto|normal|papel|sepia|noche|calido|custom · `reading.font` literata|garamond|atkinson · `lang` es|en|pt · `fondo` tema|portada|imagen. Valor no listado → default.
- `toggleKey`: string → minúscula y UNA letra; no-string → `"h"`.
- `fondoRuta`: solo si empieza por `/uploads/`, truncado a 200; si no → `""`.
- Migraciones: `teleprompter.speedPreset` string → `wps = wpsDePresetAntiguo(id)` (`"0-8"`→0.8, `"1-5"`→1.5, `"2-5"`→2.5, `"4"`→4, otro→2.5); `speedPreset === "instant"` → `instante: true`. `wps` numérico válido manda sobre `speedPreset`.
- Tipos falseados (`"5"`, `null`, `true`, objeto) → default del bloque.

- [ ] **Step 1: escribe `src/lib/config-file.test.ts`** con tests `bun:test`:
  - `saneaAjustes(null)` y `saneaAjustes("no-soy-objeto")` devuelven el objeto de defaults EXACTO de arriba (comparar por bloque con `toEqual`).
  - saneo de tipos: `{ rail: { segments: "10", theme: 7, showLabels: "sí" }, reading: { dailyGoal: null }, immersion: { enabled: 1, toggleKey: 42 } }` → `{segments:10, theme:"egeo", showLabels:true, dailyGoal:20, enabled:true, toggleKey:"h"}`.
  - clamps: `{ rail:{segments:999}, reading:{dailyGoal:0}, immersion:{idleSeconds:99}, teleprompter:{wps:9, fontScale:9}, modes:{pauseMinutes:1} }` → `{segments:40, dailyGoal:1, idleSeconds:12, wps:4, fontScale:1.6, pauseMinutes:25}` (mínimos: segments 2, dailyGoal 1 con `-3`).
  - `toggleKey`: `{immersion:{toggleKey:"K"}}` → `"k"`; `"ab"` → `"a"`.
  - `fondoRuta`: `"/uploads/fondo.jpg"` se conserva (truncado a 200); `"/etc/passwd"` → `""`.
  - migración: `{teleprompter:{speedPreset:"1-5"}}` → `wps:1.5, instante:false`; `{speedPreset:"instant"}` → `instante:true`; `{speedPreset:"raro"}` → `wps:2.5`; `{wps:3, speedPreset:"0-8"}` → `wps:3` (wps manda).
- [ ] **Step 2: corre `bun test` entero** — esperado PASS (13 previos + nuevos). Si algo sale rojo: clasifica (contrato vs expectativa) antes de tocar código; corrige una sola cosa y repite.
- [ ] **Step 3: commit** `git add src/lib/config-file.test.ts src/lib/config-file.ts -A lo que toques && git commit -m "tests: saneaAjustes clavado con valores del contrato"`.

### Task 2: pinar el riel (`reading.test.ts`)

**Files:**
- Create: `src/lib/reading.test.ts`
- Consumes: `milestonePages`, `progressPct` de `@/lib/reading`; tipo `BookDTO`.

**Interfaces:**
- Consumes: `milestonePages(totalPages: number, segments: number): number[]` y `progressPct(book: BookDTO): number`.
- Produces: nada.

**Reglas exactas (código actual):**
- `milestonePages`: `for i=1..segments → round(i*totalPages/segments)`; último = `totalPages`; segments ≤ 0, NaN o no-entero → tantos tramos como enteros ≥ 1 (`i <= segments`); `totalPages ≤ 0` con segments > 0 → todos 0.
- `progressPct`: página 1 → 0 %; última página (o más) → 100 %; `totalPages ≤ 0` → 0; fórmula `round((currentPage-1)/totalPages*100)`.

- [ ] **Step 1: escribe `src/lib/reading.test.ts`**:
  - `milestonePages(280, 10)` → `[28,56,84,112,140,168,196,224,252,280]`.
  - `milestonePages(100, 4)` → `[25,50,75,100]`; `milestonePages(7, 3)` → `[2,5,7]` (redondeo `round`).
  - raros: `(280, 0)` → `[]`; `(280, -3)` → `[]`; `(280, NaN)` → `[]`; `(280, 2.9)` → 2 tramos (`[93,186]`... calcular: round(280/2.9)=round(96.55)=97, round(280*2/2.9)=round(193.1)=193 → `[97,193]`); `(0, 4)` → `[0,0,0,0]`.
  - `progressPct`: libro `{totalPages:280}` con `currentPage` 1/2/71/140/281 → `0/0/25/50/100`; `{totalPages:0}` → 0. Construye el mínimo: `{ totalPages: 280, currentPage: 1 } as BookDTO` (cast, solo esos dos campos importan).
- [ ] **Step 2: corre `bun test` entero** — esperado PASS. Igual que Task 1: rojo = hallazgo, clasifica antes de arreglar.
- [ ] **Step 3: commit** `tests: riel clavado (milestonePages + progressPct)`.

### Task 3: pinar el round-trip de `db/config.json` (sandbox)

**Files:**
- Modify: `src/lib/config-file.test.ts` (creado en Task 1): AÑADIR el bloque de round-trip, con su propio `beforeEach/afterEach` de sandbox separado del bloque puro.
- Consumes: `leerAjustes`, `escribirAjustes`, `docPorDefecto`, `saneaAjustes` de `@/lib/config-file`.

**Interfaces:**
- Consumes: `leerAjustes(): Promise<ConfigCompleto & { created: boolean }>`; `escribirAjustes(settings, biblioteca, doc): Promise<void>`.
- Produces: nada.

**Reglas exactas (código actual):**
- Sin fichero: escribe defaults + `docPorDefecto()`, `created: true`.
- Con fichero válido: `created: false`, valores saneados, `_doc` sólo claves string≠"_doc".
- Roto (JSON inválido) o >256 KB: renombra a `config.json.roto-<ms>`, escribe defaults, `created: true`.
- Escritura atómica vía tmp+rename; `db/` se crea si falta; raíces desconocidas se conservan (`extraKeys`).

- [ ] **Step 1: añade el bloque de round-trip** con sandbox (copiar el patrón de `access.test.ts`: `mkdirSync("tests/.sandbox/db")`, `process.chdir`, `afterEach` restaura cwd y borra):
  - sin fichero: `leerAjustes()` → `created:true`, `settings` = defaults, `_doc` = `docPorDefecto()`; el fichero existe, es JSON con 2 espacios y acaba en `\n`.
  - round-trip: `escribirAjustes({...defaults con rail.segments: 7}, {carpeta:"/home/bib"}, doc)` → `leerAjustes()` → `created:false`, `rail.segments:7`, `biblioteca.carpeta:"/home/bib"`, `_doc` = el doc escrito.
  - `_doc` no-string y `_doc.__doc`...: fichero a mano con `_doc:{ x: 5, _doc:"raro", lang:"vale" }` → leer devuelve `_doc === {lang:"vale"}`.
  - claves raras: fichero con `{ miClave: 42, rail:{segments:9} }` → leer → escribir de nuevo (con settings leídos) → el fichero sigue teniendo `miClave: 42`.
  - roto: fichero con `{roto` → `leerAjustes()` → `created:true` y existe `config.json.roto-*` (glob `config.json.roto-*`, 1 fichero).
  - MAX_SIZE: fichero de 257 KB de JSON válido → `created:true` + renombrado `.roto-*`.
  - `db/` ausente: borrar `tests/.sandbox/db` antes de `escribirAjustes` → se recrea (el fichero queda).
  - atomicidad: tras `escribirAjustes`, `readdirSync("db")` no contiene nada con `config.json.tmp-`.
- [ ] **Step 2: corre `bun test` entero** — esperado PASS (rojo = hallazgo real del round-trip: clasifica ANTES de arreglar; si el contrato se cumple pero un test esperaba otra cosa, corrige el test).
- [ ] **Step 3: commit** `tests: round-trip de config.json clavado (doc, claves raras, roto, atomico)`.

### Task 4: verificación final

**Files:** working tree limpio; ninguna modificación salvo hallazgos de Tasks 1-3.

- [ ] **Step 1: `bun test`** — suite entera en verde (número esperado: 13 + Task 1 + Task 2 + Task 3, anótalo).
- [ ] **Step 2: `bun run lint`** y `bunx tsc --noEmit` — sin errores (recordar: stale `.next/dev/types` puede ensuciar tsc; `rm -rf .next` y repetir antes de asumir bug).
- [ ] **Step 3: commit final si queda algo** y push del branch.
- [ ] **Step 4: cierre**: revisión de contexto limpio del branch (diff + specs) y arreglos RED→GREEN de Critical/Important; luego resumen a la dueña con verdict.
