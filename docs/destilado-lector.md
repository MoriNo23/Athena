# Destilado del lector (`/impeccable distill`)

Recorte de ruido sobre el piloto del lector (cabecera, ajustes del riel).
La meta era una: que el texto manda y un solo instrumento — el riel — cargue
el progreso. Nada de esto quita capacidades de lecturas: cada caja sigue
existiendo, solo con menos puertas.

## Qué se retiró y por qué

| Retirado | Por qué | Acceso alternativo |
|---|---|---|
| Sliders de filtros (brillo, contraste, sepia, saturación, invertir, calidez + reinicio) | Los presets con nombre (*auto/normal/papel/sepia/cálido/noche*) ya cargan el render; el camino *custom* era estética de panel, no de lectura. La casa ya jubiló el papel cálido por tokens `--reader-*`. | Presets de «Comodidad visual» |
| Slider de paso de flecha (`scrollStepPct`) y refuerzo de rueda (`wheelBoost`) | Ajuste fino que nadie pide por defecto; quedó en los valores de la casa (40 % del visor; rueda nativa). | — (valores fijos) |
| Slider de segundos de auto-ocultado de la inmersión | Default de casa: 4 s. La tecla de ocultar sigue siendo configurable. | Tecla «H» (editable) |
| «32 % leído» en el subtítulo de la cabecera | Decía lo mismo que el riel (debajo) y el salto «12 de 670». Números honestos, una vez. | Riel + caja de página |
| 4 reglas verticales de la cabecera | Separadores que sumaban ruido, no orden. | Espaciado |
| Botones sueltos de vocabulario y de ajustes del riel en la cabecera | Dos puertas más de baja frecuencia en una fila de 15 mandos. | Menú «⋯» de la cabecera (con contador de vocabulario) |

## Migración (v12)

Los estados guardados (`riel-settings-v1`) suben a versión 12: un preset
`custom` se convierte en `auto` (sigue al tema) y `scrollStepPct`,
`wheelBoost` e `idleSeconds` vuelven a los defaults (40, 1, 4).

## No tocado (a propósito)

- El riel, el teleprompter y el flujo letra a letra (componentes firma).
- Hábito en cabecera (páginas de hoy/meta, racha, minutos): lo pide la
  especificación de hábito de lectura.
- Modo Página/Texto, fuentes de lectura, sincronizar progreso, peek,
  diccionario: capacidades del producto.

## Pendiente detectado fuera de alcance

- El hook de diseño advierte un `text-[10px]` fuera del rampa tipográfica
  (hint del peek, preexistente) — tarea de `/impeccable polish`.
- Dos hallazgos de lint preexisten en `ReaderView` (complejidad 32 y
  `setState` en efecto del hint de inmersión, llegados con trabajo en curso
  de otra sesión): requieren su propio arreglo, no son del destilado.
