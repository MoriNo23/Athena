---
name: Athena
description: Casa de lectura local-first que termina libros — neobrutalismo de tinta y mármol cálido
colors:
  ink: "oklch(0.08 0.012 70)"
  ink-day: "oklch(0.24 0.02 70)"
  night-umber: "oklch(0.16 0.012 75)"
  morning-warm-marble: "oklch(0.968 0.008 85)"
  card-night: "oklch(0.2 0.014 75)"
  card-day: "oklch(0.995 0.004 85)"
  focus-bronze: "oklch(0.77 0.11 80)"
  focus-bronze-day: "oklch(0.55 0.13 65)"
  focus-bronze-contrast: "oklch(0.17 0.02 75)"
  focus-bronze-contrast-day: "oklch(0.985 0.005 85)"
  focus-bronze-on-tint: "oklch(0.82 0.09 82)"
  focus-bronze-on-tint-day: "oklch(0.44 0.13 65)"
  panel-night: "oklch(0.27 0.015 75)"
  panel-day: "oklch(0.93 0.015 85)"
  text-hi: "oklch(0.93 0.008 85)"
  text-hi-day: "oklch(0.25 0.02 70)"
  text-soft: "oklch(0.7 0.015 80)"
  text-soft-day: "oklch(0.46 0.025 75)"
  hairline: "oklch(0.87 0.012 85 / 16%)"
  hairline-day: "oklch(0.3 0.025 70 / 65%)"
  reader-page: "oklch(0.19 0.014 75)"
  reader-page-day: "oklch(0.987 0.005 85)"
  reader-ink: "oklch(0.92 0.01 85)"
  reader-ink-day: "oklch(0.27 0.02 70)"
  reader-title: "oklch(0.96 0.012 85)"
  reader-title-day: "oklch(0.22 0.025 70)"
  reader-rule: "oklch(0.5 0.02 75)"
  reader-rule-day: "oklch(0.6 0.03 80)"
  alert-red: "oklch(0.65 0.19 25)"
  alert-red-day: "oklch(0.55 0.19 25)"
typography:
  display:
    fontFamily: "var(--font-fraunces), Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-fraunces), Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  teleprompter:
    fontFamily: "var(--reader-font)"
    fontSize: "clamp(1.35rem, 1.05rem + 0.9vw, 1.78rem)"
    fontWeight: 400
    lineHeight: 1.9
rounded:
  none: "0px"
components:
  button-primary:
    backgroundColor: "{colors.focus-bronze}"
    textColor: "{colors.focus-bronze-contrast}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "36px"
  button-primary-day:
    backgroundColor: "{colors.focus-bronze-day}"
    textColor: "{colors.focus-bronze-contrast-day}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.night-umber}"
    textColor: "{colors.text-hi}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-hi}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "36px"
  rail-fill:
    backgroundColor: "{colors.focus-bronze}"
    height: "8px"
  book-card:
    backgroundColor: "{colors.card-night}"
    textColor: "{colors.text-hi}"
    rounded: "{rounded.none}"
    padding: "16px"
---

# Design System: Athena

## Overview

**Creative North Star: "La Casa de Tinta y Mármol Cálido"**

Athena es una casa de lectura brutalista: tinta sólida, bronce de enfoque y cero
curvas. La letra manda — Fraunces para los títulos, Literata para el libro — y
todo lo demás se aparta: sin degradados decorativos, sin sombras de humo, sin
esquinas que invitan a descansar. La calma no viene de la blandura sino de la
piedra cálida: una sala de lectura con sol de mañana que sostiene el foco.
(La casa vistió azul hasta la versión 1.1: la dueña pidió menos azul y el
tema vistió mármol cálido con acento bronce.)

El mundo es editorial, no de aplicación: los botones y las tarjetas se comportan
como piezas de un cartel bien impreso — borde de tinta de 2px, sombra offset
dura, tipografía con voz — y el libro vive encima de una superficie propia
(`--reader-*`), separada del ruido de la interfaz. La piedra de Atenas
(fachada y busto en `public/athena-capa2-*`) existe como capa ambiental fija,
casi fantasma, nunca como motivo decorativo de componentes.

**Key Characteristics:**
- Cero radio en todo (`--radius: 0`); las esquinas son siempre rectas.
- Tinta única para bordes y sombras (`--ink`), nunca grises genéricos.
- Bronce de enfoque escaso y estructural: interacción, progreso, riel.
- Dos caras del mismo mármol cálido: noche de bronce (default) y mañana cálida.
- Superficie de lectura con tokens propios (`--reader-*`), impermeable al tema.

## Colors

Paleta de un solo matiz con oficio: bronces cálidos que sostienen el foco,
una tinta casi negra que dibuja, y rojo solo para destruir. Los valores son
oklch — el formato canónico del proyecto — y cada rol tiene su cara nocturna
(default) y su cara `-day`.

### Primary
- **Focus Bronze** (`oklch(0.77 0.11 80)`; día `oklch(0.55 0.13 65)`): el
  bronce de la interacción — botones primarios, riel, progreso, ring de foco.
  Escaso a propósito: donde aparece, es una invitación a actuar.
- **Focus Bronze on Tint** (`oklch(0.82 0.09 82)`; día `oklch(0.44 0.13 65)`):
  la pareja «bronce sobre tinte» — el texto bronce de enfoque que vive ENCIMA
  de un tinte del mismo bronce (botón «Pantalla completa», badges y chips
  activos sobre `primary/10–20%`). El bronce global no llega a AA contra su
  propio tinte; esta cara medida sube cada combinación sobre 4.5:1 sin mover
  `--primary` (riel, progreso y focos quedan intactos). (contraste medido a
  mano al tocar tokens).

### Secondary
- **Panel** (`oklch(0.27 0.015 75)`; día `oklch(0.93 0.015 85)`): superficie
  secundaria para chips, estados y contenedores quietos que no piden clic.

### Tertiary
- **Alert Red** (`oklch(0.65 0.19 25)`; día `oklch(0.55 0.19 25)`): reservado a
  acciones destructivas. Nunca decorativo.

### Neutral
- **Ink** (`oklch(0.08 0.012 70)`; día `oklch(0.24 0.02 70)`): la tinta del
  brutalismo — bordes de 2px y sombras offset. Más negra que el texto.
- **Night Umber** (`oklch(0.16 0.012 75)`): fondo de la app de noche (default).
- **Morning Warm Marble** (`oklch(0.968 0.008 85)`): fondo de la app de día.
- **Card** (`oklch(0.2 0.014 75)`; día `oklch(0.995 0.004 85)`): tarjeta y
  popover, un paso por encima del fondo.
- **Text Hi / Text Soft** (`oklch(0.93 0.008 85)` / `oklch(0.7 0.015 80)`;
  día `oklch(0.25 0.02 70)` / `oklch(0.46 0.025 75)`): texto principal y
  secundario de la interfaz.
- **Hairline** (`oklch(0.87 0.012 85 / 16%)`; día `oklch(0.3 0.025 70 / 65%)`):
  separadores y bordes sin peso.
- **Reader Page** (`oklch(0.19 0.014 75)`; día `oklch(0.987 0.005 85)`): el
  papel donde vive el libro — noche cálida de lámpara de noche, mármol cálido
  de día.
- **Reader Ink / Title / Rule** (`oklch(0.92 0.01 85)`, `oklch(0.96 0.012 85)`,
  `oklch(0.5 0.02 75)`; día `oklch(0.27 0.02 70)`, `oklch(0.22 0.025 70)`,
  `oklch(0.6 0.03 80)`): cuerpo, títulos y filetes del libro. Contrastes AA+
  medidos a mano.

### Named Rules
**The Focus-Bronze Rule.** El bronce es foco, no decoración: aparece solo donde
hay una acción o progreso real (botón primario, riel, ring, eslabón activo) y
su rareza es el punto. Si una pantalla necesita más bronce, el problema es de
jerarquía, no de paleta.

**The Ink Rule.** Bordes y sombras se dibujan siempre con `--ink`; jamás con
grises de la paleta. La tinta es más oscura que el texto y eso la hace estructura.

## Typography

**Display Font:** Fraunces (variable, ejes `opsz` `SOFT` `WONK`; fallback Georgia)
**Body Font:** Geist (UI; fallback system-ui)
**Label/Mono Font:** Geist Mono (cifras tabulares, fechas técnicas)
**Reader Font:** Literata (default), EB Garamond y Atkinson Hyperlegible —
elegidas por la lectora vía `--reader-font` con fallback Georgia.

**Character:** Un editorial que se lee de noche: Fraunces pone la voz con
carácter (tiene ejes de expresión activados a propósito) y Geist mantiene la
interfaz callada y precisa. El libro se tipografía aparte, con serif de lectura
real y línea generosa.

### Hierarchy
- **Display** (600, 2.25rem, 1.15, tracking -0.02em): el título «Athena» y
  momentos solemnes de la biblioteca.
- **Headline** (500, 1.5rem, 1.3): títulos de sección y paneles.
- **Title** (600, 1.25rem): valores de estadísticas y títulos de tarjetas.
- **Body** (400, 0.875rem, 1.5): interfaz. El libro no usa esta escala: el
  texto reflow corre a ~320 palabras/página con la fuente del lector.
- **Teleprompter** (400, `clamp(1.35rem, 1.05rem + 0.9vw, 1.78rem)`, 1.9): el
  flujo encendido letra a letra; escala 0.8×–1.6× con A−/A+.
- **Label** (500, 0.75rem): controles compactos, chips, meta de tarjetas.

### Named Rules
**The Serif-Divide Rule.** Fraunces es la voz de la casa (títulos, display);
la serif de lectura es la voz del libro. Nunca se intercambian: Fraunces no
compone páginas y Literata no titula la interfaz.

## Layout

Rejilla fluida de Tailwind con ritmo compacto: controles de 32–36px
(`h-8`/`h-9`), tarjetas con padding 16px, contenedor centrado con margen
automático y máximo ancho. La biblioteca respira en una columna única con
rejilla de tarjetas; el lector pasa a escenario a pantalla completa donde el
libro ocupa el ancho que pide la medida cómoda, sin canales laterales en
inmersión. En 390×844 la cabecera envuelve a dos filas y los controles
conservan sus alturas — no se encogen.

## Elevation & Depth

Sombras duras desplazadas, jamás difusas: la profundidad es física, de papel
apilado, no de humo. La sombra es respuesta (hover, pulsación), no ambiente.

### Shadow Vocabulary
- **Brutal** (`var(--brutal-shadow)` = `4px 4px 0 0 oklch(0.07 0.028 258 / 85%)`):
  estado de reposo de tarjetas y paneles con presencia.
- **Brutal LG** (`7px 7px 0 0 ink / 78%`): piezas solemnes (hero de la
  biblioteca, diálogos).
- **Press** (`3px 3px` → `1px 1px` en active): el botón se hunde al pulsarlo.
- **Inset** (`inset 0 1px 2px black / 32%`): solo dentro del riel, para que el
  canal se lea como ranura.

### Named Rules
**The Hard Shadow Rule.** Toda sombra es un bloque de tinta desplazado, con
offset entero y cero blur. El único difuminado permitido en toda la casa es el
halo del sello (`seal-glow`), porque es luz, no sombra.

## Shapes

Cero radio en todo el sistema (`--radius: 0` y derivados anulados): tarjetas,
botones, inputs, imágenes y diálogos son rectángulos perfectos. El lenguaje de
forma lo dan el borde de tinta de 2px y la sombra offset; los únicos óvalos son
los chips de estado del lector (pastillas con `rounded-full`) que marcan
información viva, no acciones. Las imágenes de portadas van enmarcadas en
`page-frame`, con borde fino y sombra plana.

## Components

### Buttons
- **Shape:** rectángulo perfecto (0px), borde de tinta 2px, altura 36px
  (compacto 32px, icono 36px).
- **Primary:** fondo Focus Blue, texto Focus Blue Contrast, sombra `3px 3px`
  tinta; en `:active` se traduce (1px, 1px) y la sombra baja a `1px 1px` —
  el botón se pisa.
- **Outline:** fondo del tema, borde tinta 2px, hover sobre Panel.
- **Secondary:** fondo Panel, texto Text Hi, misma sombra y pisada.
- **Ghost / Link:** sin borde ni sombra; ghost revela Panel en hover, link
  subraya con offset.

### Cards / Containers
- **Corner Style:** 0px.
- **Background:** Card (un paso sobre el fondo), borde tinta 2px.
- **Shadow Strategy:** Brutal en reposo; Brutal LG solo en el hero.
- **Border:** siempre `--ink` 2px; los separadores internos usan Hairline.
- **Internal Padding:** 16px (4 en Tailwind).

### Inputs / Fields
- **Style:** fondo transparente del tema, borde Hairline/Input de tinta, 0px.
- **Focus:** ring azul translúcido (`--ring`, 55–60%) — el halo azul del focus.
- **Error / Disabled:** rojo Alert solo con validación; disabled al 50% sin
  sombra.

### Navigation
Cabecera del lector en dos filas como máximo: título del libro en Fraunces
semibold, controles compactos de 32px, progreso del riel debajo. En
biblioteca, la navegación vive en el hero con el sello. Estados activos con
Focus Blue; hover con Panel; nada subrayado por defecto.

### Rail (componente firma)
El riel es la barra de progreso de la casa: canal hundido con sombra inset,
relleno Focus Blue, nudos de hito (ticks) y un knob con sombra corta. Los
hitos pasados se pintan completos; el resto del canal queda oscuro. Es el único
componente que mezcla inset + offset, y lo hace para leerse como ranura física.

### Teleprompter (componente firma)
Un solo flujo continuo sobre Reader Page, sin tarjeta ni borde: las letras se
encienden de una en una a color Reader Ink pleno; el texto apagado espera a
opacidad 0.55 (0.68 en ≤640px) — legible pero claramente secundario. Los
títulos (h1–h4) aparecen por bloque completo con fundido en Fraunces. El chrome
se auto-oculta a los 3.5s y despierta con cualquier movimiento.

## Do's and Don'ts

### Do:
- **Do** dibujar bordes y sombras con `--ink` (2px, offset entero, cero blur).
- **Do** mantener `--radius: 0` en todo componente nuevo.
- **Do** usar los tokens `--reader-*` en toda superficie de lectura — el libro
  es impermeable al tema de la interfaz.
- **Do** mantener el azul escaso: si el diseño necesita más azul, revisa la
  jerarquía (The Focus-Blue Rule).
- **Do** respetar `prefers-reduced-motion`: todo encendido estático, cero
  transiciones por carácter.
- **Do** medir contraste AA+ al tocar tokens de lectura.

### Don't:
- **Don't** introducir esquinas redondeadas, glassmorphism ni sombras difusas.
- **Don't** usar grises corporativos de dashboard SaaS: el gris de la casa es
  azul (`--muted-*`, `text-soft`), nunca un neutro puro.
- **Don't** volver al papel cálido sepia en el lector — se jubiló a propósito
  por los tokens `--reader-*`.
- **Don't** hardcodear hex: todo color pasa por token, y oklch es el formato
  canónico.
- **Don't** poner texto de interfaz sin clave i18n ni duplicar Fraunces dentro
  del flujo del libro.
