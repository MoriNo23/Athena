# Tasks

## 1. Borrar componentes shadcn vendidos sin usar

- [x] 1.1 Eliminar de `src/components/ui/`: accordion, alert, aspect-ratio, avatar, breadcrumb, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, form, hover-card, input-otp, menubar, navigation-menu, pagination, radio-group, resizable, sidebar, select, sonner (wrapper vendido), table, toggle, toggle-group. Verificar: `bunx tsc --noEmit` = 0 errores (ningún import vivo los menciona).
- [x] 1.2 Eliminar las dependencias que solo estos archivos consumían: `@radix-ui/react-accordion`, `-aspect-ratio`, `-avatar`, `-checkbox`, `-collapsible`, `-context-menu`, `-hover-card`, `-menubar`, `-navigation-menu`, `-radio-group`, `-select`, `-toggle`, `-toggle-group`, más `embla-carousel-react`, `vaul`, `input-otp`, `react-day-picker`, `recharts`, `react-hook-form`, `@hookform/resolvers`, `cmdk`. Verificar: grep literal de cada nombre en `src/` + `tailwind.config.ts` + `globals.css` = 0 coincidencias.
- [x] 1.3 Eliminar dependencias directas sin uso: `next-auth`, `@tanstack/react-query`, `@tanstack/react-table`, `@mdxeditor/editor`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `framer-motion`, `react-syntax-highlighter`, `uuid`, `@reactuses/core`, `z-ai-web-dev-sdk`, `date-fns`, `zod`, `sharp`. Verificar: mismo grep literal = 0 coincidencias.
- [x] 1.4 `bun install` + `bunx tsc --noEmit` + `bun run lint` + `bun run build`. Verificar: checklist completo en verde antes de pasar al siguiente grupo.

## 2. Config fix en next.config.ts

- [x] 2.1 Quitar `typescript.ignoreBuildErrors` de `next.config.ts`. Verificar: el bloque queda sin la clave y `bun run build` pasa (si revela errores de tipos, corregirlos es parte de esta tarea).
- [x] 2.2 Activar `reactStrictMode: true` y correr `bun run dev`: smoke test de biblioteca (subir PDF + EPUB al riel), teleprompter (auto-avance, pausa, retroceso) y panel de modos. Verificar: los flujos de `/api/books` y `/api/progress` responden 2xx en modo dev con doble render.
- [x] 2.3 (condicional — no aplicó) Solo si 2.2 rompe algún flujo: revertir a `false` con comentario `strict: <razón>, <cuándo reintentar>` en el config. Verificar: el comentario existe y 2.2 pasó con esa configuración.
  - Skip deliberado: el strict mode NO rompió ningún fluzo — smoke: biblioteca sin duplicados, PDF+EPUB vía API, sondas canonícas de la casa `probe-auto-cruce.js` 5/5 (cruce de página + pausa) y `probe-flechas-tp.js` 9/9 (retroceso, Shift, banda de lectura), 0 errores de consola/pageerror. La condición no se cumple; el config queda limpio sin comentario.

## 3. Lockfile único

- [x] 3.1 Regenerar `bun.lock` con el `package.json` depurado. Verificar: `bun install` no menciona paquetes eliminados y no crea `node_modules` con ellos.
- [x] 3.2 Eliminar `package-lock.json` del repositorio. Verificar: `ls package-lock.json` falla y `scripts/clean-install-test.sh` sigue en verde (instalación desde cero resuelve con `bun.lock`).
- [x] 3.3 Correr el release checklist completo en el estado final: `bunx tsc --noEmit`, `bun run lint`, `bun run crap` (en banda), `bun run build`, `scripts/clean-install-test.sh`. Verificar: todo en verde con una sola herramienta de paquetes (Bun).
- [x] 3.4 Re-auditar dependencias: grepear cada dependencia declarada en `package.json` contra `src/` + config activa. Verificar: 0 dependencias sin uso (requisito de `build-hygiene`).
  - Hallazgos absorbidos con evidencia: 4 deps muertas más entraron a borrado (`next-intl`, `react-markdown`, `react-resizable-panels`, `sonner` — solo consumidas por vendidos borrados). `eslint.config.mjs` ignorance `.opencode/**` y `openspec/**` (harness arrastrados por la skill impeccable, apareciaIntro a mitad del apply). `react-dom` queda declarado: peer explícito de next/react como en cualquier create-next-app — los audits por import son falsos negativos. `sharp` sigue en `bun.lock` por `optionalDependencies` de `next` — transitivo y legítimo, no es una declaration nuestra.
