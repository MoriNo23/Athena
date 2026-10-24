# Proposal

## Why

El teleprompter es el modo estrella de la casa — la página se enciende letra a
letra a pantalla completa — pero le faltan tres cosas que la dueña pidió el
24-10:

1. **No tiene superficie propia de ajustes**: lo poco ajustable (velocidad,
   sonido, auto, tamaño de letra) vive en una mini-barra dentro del overlay,
   escondido entre el fuego cruzado de la lectura.
2. **El fondo es fijo**: un color plano del tema. La dueña quiere poner la
   portada del libro o una imagen de su gusto — con la condición de que
   **toda** imagen lleve filtro en runtime para que las letras se lean bien.
3. **El ritmo aún no es «la manera correcta de leer en voz alta»**: el motor
   ya pausa tras `, ; :` (media pausa) y `. ! ? …` (pausa completa), pero
   faltan la raya (—), los paréntesis y las comillas de diálogo, y las
   tarjetas son párrafos enteros — larguísimos para leer en alto de un tirón.

## What Changes

- **Superficie de ajustes del teleprompter**: una sección «Teleprompter» en el
  panel de Ajustes del lector (hoy no existe ninguno allí), con todo lo
  ajustable en un sitio: velocidad (presets + el ritmo recomendado para leer
  en voz alta), sonido, auto, tamaño de letra, y los nuevos controles de
  fondo y de tarjetas. La mini-barra del overlay se mantiene para lo urgente.
- **Fondo del teleprompter**: tres opciones — color del tema (como hoy),
  **portada del libro** (si el libro tiene) e **imagen propia** (subida, copia
  en `public/uploads/` al estilo de las portadas; jamás se escribe en el
  fichero original de la dueña). **Todas** las opciones de imagen llevan
  filtro en runtime por CSS: capa de oscurecimiento + desaturación + ajuste de
  contraste, con control único de intensidad, y texto siempre por encima con
  contaste AA (DesignSystem). El filtro es de la app: una imagen ilegible se
  vuelve legible sin que la dueña toque nada.
- **Ritmo con sentido de lectura en voz alta**:
  - completar la tabla de pausas del motor: raya (—) → pausa corta;
    paréntesis → respiración leve; comillas de diálogo → mini-pausa de
    apertura/cierre (entonación no se puede, pausa sí).
  - **tarjetas por frase**: dividir los bloques largos en tarjetas cortas
    (frases, agrupadas hasta un tope de palabras) para que leer en alto no
    sea un párrafo entero de carrerilla.
  - un preset de velocidad marcado como **«lectura en voz alta»** (~2,2 pal/s)
  - y documentar en el LEEME que el ritmo ya respeta la puntuación del
    idioma en que se lee (es/en/pt comparten , . ! ? …; la raya y los
  paréntesis también).

## Lo que YA existe (no se repite trabajo)

- Pausas por puntuación en el motor (`TELEPROMPTER_COMMA_PAUSE_LETTERS`,
  `TELEPROMPTER_PERIOD_PAUSE_LETTERS`, series que no se acumulan).
- Presets de velocidad 0,8–4 pal/s + instantánea, sonido de tic, modo auto,
  tamaño de letra 0,8–1,6 — todos ya persistidos en `db/config.json`
  (bloque `teleprompter`).

## Open questions (se cierran antes del apply)

1. ¿Dónde viven los ajustes nuevos: sección del panel de Ajustes del lector,
   o un diálogo propio abierto desde el overlay?
2. ¿Imagen propia por subida de fichero (copia en uploads, como las portadas)
   o por ruta del disco (como la biblioteca por carpeta)?
3. ¿Filtro: un solo control de intensidad (simple) o tres (opacidad,
   desaturación, contraste)?
4. ¿Tarjetas por frase automáticas, o solo para párrafos que pasen de N
   palabras?

## Impact

- Ámbito: `src/components/reader/TeleprompterOverlay.tsx` (fondo + tarjetas),
  `src/lib/teleprompter.ts` (pausas nuevas + corte por frases),
  `src/components/reader/ConfigPanel.tsx` (sección nueva), nuevo
  `/api/books/[id]/fondo-teleprompter` si la imagen es por subida, y claves
  nuevas en el bloque `teleprompter` del fichero de configuración.
- Sin dependencias nuevas: los filtros son CSS puro; la subida reusa el
  patrón de las portadas.
- Fuera de alcance v1: voz leída por TTS, fondos animados, fondos distintos
  por libro con galería, tocar el motor de tiempos validado sin tests nuevos.
