# Ajustes

Tus ajustes de lectura (idioma, riel, filtros, lectura, inmersión,
teleprompter, modos del lector) viven en **`db/config.json`**, junto a la base
de datos. Es un JSON normal: puedes editarlo con cualquier editor, incluso con
la app cerrada.

## Cómo funciona

- **El panel de ajustes sigue siendo el de siempre**: lo que toques ahí se
  escribe en el fichero (con un pequeño retraso, para no escribir 40 veces
  mientras arrastras un control).
- **Comentarios**: JSON no tiene comentarios, pero el fichero trae una clave
  `_doc` que explica cada bloque en castellano. La app la ignora al leer y la
  **conserva al escribir** — tus anotaciones sobreviven a cada cambio del
  panel. Puedes editarla a mano también.
- **Un valor inválido no te tumba la app**: si te inventas una opción que no
  existe, al arrancar vuelve a su valor por defecto; si te pasas de rango con
  un número (p. ej. 999 tramos), se queda en su límite razonable.
- **Instalación vieja**: si venías de una versión que guardaba los ajustes en
  el navegador (localStorage), el primer arranque los sube al fichero y a
  partir de ahí manda el fichero.
- **Qué NO vive aquí**: el vocabulario (tus palabras) y todo el progreso son
  datos: están en `db/custom.db`, protegidos con el resto.
- **Ubicación**: en instalaciones nuevas el fichero vive en la casa de datos
  (`~/.local/share/athena/db/config.json`); con `ATHENA_HOME` o en modo
  legacy, donde corresponda — ver [Auto-alojamiento](auto-alojamiento.md).

## Esquema

Bloques de primer nivel; cada uno es un objeto con los mismos nombres que ves
en el panel:

```json
{
  "_doc": { "lang": "Idioma de la interfaz: \"es\", \"en\" o \"pt\"." },
  "lang": "es",
  "rail": { "position": "left", "segments": 10, "theme": "egeo", "showLabels": true, "celebrate": true },
  "filters": { "preset": "auto", "brightness": 100, "contrast": 100, "sepia": 0, "saturate": 100, "warmth": 0, "invert": 0 },
  "reading": { "dailyGoal": 20, "scrollStepPct": 40, "wheelBoost": 1, "font": "literata" },
  "immersion": { "enabled": true, "idleSeconds": 4, "toggleKey": "h" },
  "teleprompter": { "wps": 2.5, "instante": false, "sound": true, "auto": false, "fontScale": 1, "fondo": "tema", "fondoRuta": "", "fondoFiltro": 55, "tarjetasPorFrase": true },
  "modes": {
    "toggles": {
      "xray": true, "naturalPauses": false, "argumentSkeleton": false,
      "lockedNotes": false, "dualRead": false, "outline": true, "dictionary": true
    },
    "pauseMinutes": 25
  },
  "biblioteca": { "carpeta": "" }
}
```
