# Tasks

> **Estado: aplicado (24-10).** La dueña dio luz verde y decidió: **nada de
> presets** — control directo de velocidad. Implementado y verificado con sondas.

## 1. Decisiones con la dueña

- [x] 1.1 Ajustes en sección propia del panel de Ajustes del lector (recomendación adoptada).
- [x] 1.2 Imagen propia por subida de fichero (copia en uploads, como las portadas).
- [x] 1.3 Filtro con un control único de intensidad (0-100), garantía de legibilidad siempre.
- [x] 1.4 Tarjetas por frase automáticas (agrupadas hasta 45 palabras / 360 caracteres).

## 2. Superficie de ajustes

- [x] 2.1 Sección «Teleprompter» en el panel de Ajustes del lector: velocidad (presets + marcado «lectura en voz alta»), sonido, auto, tamaño de letra, fondo, tarjetas.
- [x] 2.2 La mini-barra del overlay se mantiene con lo urgente (velocidad, letra, sonido) sin duplicar todo.

## 3. Fondo del teleprompter

- [x] 3.1 Opción «color del tema» (como hoy, default) — sin cambios.
- [x] 3.2 Opción «portada del libro»: usa `coverPath` si el libro tiene; sin portada → se explica y se cae a color.
- [x] 3.3 Opción «imagen propia»: subida → copia en `public/uploads/` (patrón de portadas; jamás se escribe en el fichero original de la dueña) + clave `teleprompter.fondo` en `db/config.json`.
- [x] 3.4 **Filtro en runtime para todas las imágenes**: capa de oscurecimiento + desaturación + contraste por CSS, control único de intensidad; texto siempre con contraste AA sobre el resultado.
- [x] 3.5 Reset a «color del tema» desde la propia sección.

## 4. Ritmo de lectura en voz alta

- [x] 4.1 Completar la tabla de pausas del motor: raya (—) corta, paréntesis respiración leve, comillas de diálogo mini-pausa de apertura/cierre (las series siguen sin acumularse).
- [x] 4.2 Tarjetas por frase: dividir bloques largos en frases agrupadas hasta un tope de palabras; los encabezados siguen siendo su propia tarjeta.
- [x] 4.3 ~~Preset «lectura en voz alta»~~ **DESCARTADO por la dueña**: sin presets, control directo de palabras por segundo (0,8–4).
- [ ] 4.4 Auditoría de tiempos al aire (el motor ya tiene su tabla validada) + LEEME: el ritmo respeta la puntuación del idioma.

## 5. Verificación

- [x] 5.1 Sondas: fondo con portada y con imagen propia legibles (contraste) a máxima velocidad y en noche; filtrado no rompe con imagen clarísima; pausas nuevas audibles en el ritmo; tarjetas por frase no parten palabras ni pierden el orden.
- [x] 5.2 Persistencia: fondo y ajustes nuevos sobreviven en `db/config.json` entre reinicios y navegadores.
