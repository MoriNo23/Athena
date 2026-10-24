# Tasks

> **Estado: backlog (propuesta en espera de la dueña).** Antes del apply se
> cierran las 4 preguntas de la proposal. Nada implementado aún.

## 1. Decisiones con la dueña

- [ ] 1.1 Dónde viven los ajustes: sección del panel de Ajustes del lector (recomendado) o diálogo propio desde el overlay.
- [ ] 1.2 Imagen propia: subida de fichero (copia en uploads, como las portadas) o ruta del disco (biblioteca por carpeta).
- [ ] 1.3 Filtro de fondo: un control de intensidad (recomendado, simple) o tres (opacidad/desaturación/contraste).
- [ ] 1.4 Tarjetas: por frase automáticas (recomendado), o solo para párrafos que pasen de N palabras.

## 2. Superficie de ajustes

- [ ] 2.1 Sección «Teleprompter» en el panel de Ajustes del lector: velocidad (presets + marcado «lectura en voz alta»), sonido, auto, tamaño de letra, fondo, tarjetas.
- [ ] 2.2 La mini-barra del overlay se mantiene con lo urgente (velocidad, letra, sonido) sin duplicar todo.

## 3. Fondo del teleprompter

- [ ] 3.1 Opción «color del tema» (como hoy, default) — sin cambios.
- [ ] 3.2 Opción «portada del libro»: usa `coverPath` si el libro tiene; sin portada → se explica y se cae a color.
- [ ] 3.3 Opción «imagen propia»: subida → copia en `public/uploads/` (patrón de portadas; jamás se escribe en el fichero original de la dueña) + clave `teleprompter.fondo` en `db/config.json`.
- [ ] 3.4 **Filtro en runtime para todas las imágenes**: capa de oscurecimiento + desaturación + contraste por CSS, control único de intensidad; texto siempre con contraste AA sobre el resultado.
- [ ] 3.5 Reset a «color del tema» desde la propia sección.

## 4. Ritmo de lectura en voz alta

- [ ] 4.1 Completar la tabla de pausas del motor: raya (—) corta, paréntesis respiración leve, comillas de diálogo mini-pausa de apertura/cierre (las series siguen sin acumularse).
- [ ] 4.2 Tarjetas por frase: dividir bloques largos en frases agrupadas hasta un tope de palabras; los encabezados siguen siendo su propia tarjeta.
- [ ] 4.3 Preset «lectura en voz alta» (~2,2 pal/s) marcado como recomendado para leer en alto.
- [ ] 4.4 Auditoría de tiempos al aire (el motor ya tiene su tabla validada) + LEEME: el ritmo respeta la puntuación del idioma.

## 5. Verificación

- [ ] 5.1 Sondas: fondo con portada y con imagen propia legibles (contraste) a máxima velocidad y en noche; filtrado no rompe con imagen clarísima; pausas nuevas audibles en el ritmo; tarjetas por frase no parten palabras ni pierden el orden.
- [ ] 5.2 Persistencia: fondo y ajustes nuevos sobreviven en `db/config.json` entre reinicios y navegadores.
