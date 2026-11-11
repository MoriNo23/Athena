# tests/archive/ — tests archivados

Carpeta de archivo de la regla de la casa: **todo test con más de 7 días de
antigüedad se archiva, no se reutiliza**. Se conserva la estructura original
del proyecto dentro de cada carpeta con fecha:

```
tests/archive/<YYYY-MM-DD>/<ruta-original-del-test>
```

La fecha de la carpeta es la **última modificación real** del test según
`git log -1 --format=%as -- <archivo>` (no la fecha de archivo).

## Contenido actual

| Fecha | Archivo original | Motivo |
| --- | --- | --- |
| 2026-10-29 | `src/lib/camera.test.ts` | Test con más de 7 días sin tocar |
| 2026-11-02 | `src/lib/teleprompter-images.test.ts` | Test con más de 7 días sin tocar |

## Reglas

- **No se ejecutan**: `bunfig.toml` los excluye vía `pathIgnorePatterns`.
- **No se borran**: quedan como referencia histórica.
- **No se reutilizan**: nada de importar, copiar, adaptar o reciclar sus
  assertions, mocks o helpers para tests nuevos. Los tests nuevos se
  escriben desde cero.
- Al archivar un test se hace con `git mv` para conservar la historia.
