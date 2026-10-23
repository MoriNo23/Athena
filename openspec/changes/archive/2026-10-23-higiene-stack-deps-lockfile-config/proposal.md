# Proposal

## Why

La auditoría del stack (2026-10-23) autoevaluó 14/18: el drenaje está en la higiene de dependencias (1/3) y la configuración (2/3). El repositorio declara 65+ dependencias de las cuales al menos 15 no producen una sola línea de código en `src/`, hay dos lockfiles en conflicto (`bun.lock` + `package-lock.json`), y `next.config.ts` desactiva la verificación de tipos en build, contradiciendo el release checklist del propio README. Para un app web desktop self-host, este es el único path con ROI real: entregar más confiabilidad sin migrar a otro framework.

## What Changes

- **Borrar dependencias sin uso** (15 directas): `next-auth`, `@mdxeditor/editor`, `@tanstack/react-table`, `@tanstack/react-query`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `framer-motion`, `react-syntax-highlighter`, `uuid`, `@reactuses/core`, `z-ai-web-dev-sdk`, `date-fns`, `zod`, `sharp` (sin `next/image` en el repo; `@hookform/resolvers` cae junto con `form.tsx`).
- **Borrar dependencias que solo alimentaban componentes shadcn vendidos sin usar**: `embla-carousel-react`, `vaul`, `input-otp`, `react-day-picker`, `recharts`, `react-hook-form`, `cmdk`.
- **Borrar componentes shadcn vendidos sin usar** (28 de 48): `accordion`, `alert`, `aspect-ratio`, `avatar`, `breadcrumb`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `drawer`, `form`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `radio-group`, `resizable`, `sidebar`, `select`, `sonner` (el wrapper vendido), `table`, `toggle`, `toggle-group` — y los paquetes Radix que solo ellos consumen (accordion, aspect-ratio, avatar, checkbox, collapsible, context-menu, hover-card, menubar, navigation-menu, radio-group, select, toggle, toggle-group).
- **Lockfile único**: eliminar `package-lock.json`; Bun es el runtime y gestor declarado en el README (quedando solo `bun.lock`).
- **Config fix en `next.config.ts`**: eliminar `typescript.ignoreBuildErrors: true` (el build vuelve a ser una red para errores de tipo); reactivar `reactStrictMode: true` y verificar el teleprompter en dev — si rompe, se documenta la decisión con comentario en el config.
- Los ~20 componentes shadcn en uso, las 11 API routes, `prisma`/Prisma client, `sonner`, `canvas-confetti`, `next-themes`, `zustand`, `jszip`, `pdfjs-dist` y ambos plugins de Tailwind (`tailwindcss-animate` y `tw-animate-css`) quedan intactos.

## Capabilities

### New Capabilities

- `build-hygiene`: que el repositorio declare solo dependencias que producen código, que exista un único lockfile (Bun), y que el build de Next no oculte errores de tipos. Duraderas: la próxima dependencia que se agregue hereda esta expectativa.

### Modified Capabilities

(ninguna — los specs existentes de lectura no cambian su comportamiento)

## Impact

- **`package.json`**: salida de ~22 dependencias directas; `bun.lock` regenerado.
- **`package-lock.json`**: eliminado.
- **`next.config.ts`**: `ignoreBuildErrors` eliminado; `reactStrictMode` activado (con verificación).
- **`src/components/ui/`**: 28 archivos vendidos eliminados.
- **Consecuencia operativa**: la verdadera ganancia es de mantenimiento y de tiempo de instalación en clones nuevos (self-host); ninguna ruta de usuario cambia su comportamiento observable.
- **Riesgo contenido**: si el teleprompter se rompe en dev con strict mode reactivo, la decisión se queda documentada y la verificación del checklist (tsc/lint/build/clean-install) no cambia.
