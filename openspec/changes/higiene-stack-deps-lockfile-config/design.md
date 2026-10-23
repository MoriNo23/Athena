# Design

## Context

Scaffolds previos dejaron un inventario inflado: 15 dependencias directas sin un solo import y 28 de 48 componentes shadcn vendidos sin usar (que arrastran otras 7 dependencias y 13 paquetes Radix exclusivos de ellos). El repo convive con dos lockfiles. Y `next.config.ts` tiene `typescript.ignoreBuildErrors: true` + `reactStrictMode: false`. Baseline verificada en la auditoría del 2026-10-23 con `grep` literal sobre `src/`: 20 componentes en uso (`button`, `input`, `textarea`, `tooltip`, `scroll-area`, `popover`, `label`, `dropdown-menu`, `dialog`, `toast`, `toaster`, `switch`, `slider`, `sheet`, `tabs`, `skeleton`, `separator`, `progress`, `badge`, `alert-dialog`), y `next/image` ausente del repo (probante para retirar `sharp`).

## Goals / Non-Goals

**Goals:**
- `package.json` y `src/components/ui/` en sincronía exacta con lo que el código importa.
- Un solo lockfile (`bun.lock`) y clon fresco determinista.
- `next build` vuelve a fallar ante errores de tipos; strict mode activo o decisión documentada.

**Non-Goals:**
- No migrar de framework ni de gestor (Next 16 + Bun se quedan; ver propuesta de stack en la conversación del 2026-10-23).
- No touch el código de `src/` fuera de `components/ui/` (ningún ajuste de imports es necesario: los eliminados no son importados por nada vivo).
- No tocar `tailwindcss-animate` vs `tw-animate-css` (ambos están cableados: `tailwind.config.ts` y `globals.css`; deducir cuál sobra toca el pipeline visual).
- No empezar a introducir discriminación de dependencias dev vs prod más allá del borrado puro.

## Decisions

1. **Criterio de uso por evidencia, no por recuerdo**: cada dependencia entra a la lista de borrado solo si un grep literal sobre `src/` + config activa da cero coincidencias o si su único consumidor es un archivo vendido eliminado en el mismo change. Alternativa descartada: depurar "por nombre" (ej. confundir el wrapper vendido `ui/sonner.tsx` — se elimina — con la librería `sonner` — en uso y se queda).
2. **Los componentes shadcn se borran como archivos, no se "marcan"**: son vendidos, sin lógica propia conectada; y CRAPPER los declara exentos justamente porque se toca el mínimo. Borrarlos restaura el estado natural del scaffold. Alternativa descartada: whitelisting de la carpeta entera "por si el año que viene se usan" — es exactamente la deuda que este change corta.
3. **Lockfile: se queda `bun.lock`** porque el README y `scripts/clean-install-test.sh` caminan por Bun. Se borra `package-lock.json` al final del change, tras validar el build, para tener un punto de retorno trivial (`bun install` nunca lo consultó).
4. **`ignoreBuildErrors`**: se elimina sin reemplazo — el release checklist ya corre `bunx tsc --noEmit` de forma independiente, así que el único efecto del flag era esconder desviaciones a mitad del build. Se espera que el build siga limpio (el checklist pasa en HEAD); si no, el error revelado es información, no un new bug del change.
5. **`reactStrictMode` → `true`, con puerta de salida**: la hipótesis de trabajo es que se desactivó por prudencia, no por necesidad. Si el teleprompter se rompe en dev (debounce/cámara/pausas usan efectos sensibles), se documenta el porqué con comentario `strict: <razón>, <cuándo reintentar>` en el config y se mantiene `false`. El spec `build-hygiene` cubre ambas salidas.

## Risks / Trade-offs

- [Eliminar `checkbox`, `select` o algún componente "obvio" que la librería interna de hotkeys/mockups use al vuelo] → verificación de build `tsc` + `next build` + smoke test de biblioteca/teleprompter antes de cerrar; la lista de uso ya tiene 20 componentes vivos mapeados.
- [`zod` útil pronto (validación de uploads)] → se re-agrega cuando exista el import real; --no-muerte-de-nuevo.
- [`sharp` requerido por Next si se activa optimización de imágenes] → no hay `next/image` ni `images` en config; si se activa, `sharp` regresa con su import.
- [Strict mode somete el teleprompter a dobles efectos] → smoke test de teleprompter en dev (incluido en tasks); fallback documentado en config.
- [`prisma` CLI (dev) y `@prisma/client` (prod) se quedan] — no son candidatas aquí: activos vía `postinstall` y las API routes.

## Migration Plan

1. Borrar los 28 archivos vendidos + sus dependencias + Radix huérfanos del `package.json`.
2. Regenerar lockfile: `bun install` (elimina entradas fantasma) y correr el checklist completo (tsc, lint, crap, build, clean-install).
3. Config fix (`ignoreBuildErrors` fuera, strict mode activo) + smoke dev del teleprompter.
4. Borrar `package-lock.json` como paso final, commit único.
5. Rollback: revertir el commit; nada de datos ni API cambia.

## Open Questions

- Ninguna que afecte specs o tareas. (¿`next-auth`/`z-ai-web-dev-sdk` podrían volver con una feature? Sí — y con su import real la higiene las re-admite.)
