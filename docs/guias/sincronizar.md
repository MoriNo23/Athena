# Copiar con el ordenador — tu biblioteca viaja por la red de casa

> Sincroniza el móvil (APK) y el ordenador (servidor): biblioteca, progreso,
> racha, insignias, ajustes y vocabulario. A mano, por tu WiFi, sin nube —
> la Enmienda 1 de [`PRODUCT.md`](../PRODUCT.md) lo permite entre máquinas
> tuyas y pone las condiciones: **degradación en silencio, copia bajo tu
> control y cero cuentas**.

## La idea en 20 segundos

- **El teléfono (APK) y el ordenador (servidor) son dos copias de la misma
  biblioteca.** Cada una vive en su máquina: la del móvil dentro de la app
  (IndexedDB/OPFS), la del ordenador en su casa de datos.
- **Tú decides quién manda en cada copia**, con dos botones del menú «⋯» de
  la biblioteca (solo aparecen en la app del móvil):
  - **Traer del ordenador** — lo que dice el ordenador entra en el móvil.
  - **Enviar al ordenador** — lo que dice el móvil entra en el ordenador.
- **Una copia nunca borra**: los libros que solo existen en el receptor se
  quedan donde están. Si quieres un espejo exacto, borra a mano lo que sobre.
- Si el ordenador tiene candado (modo `lan` con contraseña), el móvil te la
  pide; **no se guarda en el teléfono**.

## Paso a paso

### 1. Arranca el ordenador en modo lan

En la máquina del ordenador:

```bash
athena start --lan        # o: bun run start:lan (clon del repo)
```

Apunta la dirección que usa tu red — la misma con la que abrirías Athena en
el navegador del portátil: por ejemplo `http://192.168.1.10:3000`. Si usas
`ATHENA_PASSWORD`, tenla a mano.

### 2. Pon ambos aparatos en la misma red WiFi

La copia va **por tu red de casa, sin internet**: no hace falta que el
móvil tenga datos móviles (de hecho, mejor sin ellos).

### 3. En el móvil: menú «⋯» → «Copiar con el ordenador»

1. Escribe la **dirección del ordenador** (`http://192.168.1.10:3000`).
2. Si tu Athena tiene candado, escribe la **contraseña** (no se guarda).
3. **Probar conexión** → te dice cuántos libros hay al otro lado.
4. **Traer del ordenador** o **Enviar al ordenador**, según quién manda hoy.
5. Al terminar, la biblioteca se recarga sola con la copia recién llegada.

## Qué se copia exactamente

| Dato | Cómo viaja |
|---|---|
| Libros (PDF/EPUB) y sus portadas | Fichero completo, uno por petición (hasta 200 MB cada uno) |
| Progreso, páginas y metas por libro | El dispositivo que manda gana |
| Sesiones de lectura por día (racha, ETA) | El que manda trae su historia |
| Insignias y «terminado» | El que manda gana |
| Fichas (X-Ray), notas con candado, compañero | Los extras del libro viajan; **el PDF compañero no se copia** (vuélvelo a enlazar a mano en el receptor) |
| Ajustes de la interfaz (riel, filtros, fuentes, teleprompter) | El que manda gana; la carpeta de biblioteca es de cada máquina |
| Vocabulario | Reemplazo limpio, sin duplicados (palabra+idioma) |

**Cómo se emparejan los libros entre máquinas**: primero por su id (es una
copia anterior), y si no, por **nombre del fichero + número de páginas** —
la misma convención anti-duplicado de la casa. El mismo PDF subido en las
dos máquinas se reconoce como el mismo libro; ediciones distintas (mismo
nombre, distinto número de páginas) se tratan como libros distintos.

## Límites honestos

- **La copia no es automática ni en segundo plano**: pasa solo cuando pulsas.
  Nada se sincroniza solo — es la condición de la Enmienda 1.
- **Si un fichero no llega** (cayó la WiFi, el libro pesa demasiado), el
  libro entra igual y la casa lo marca como «fichero ausente»: ni la lectura
  ni la biblioteca se bloquean. Vuelve a copiar cuando quieras reintentarlo.
- **El PDF compañero** de la lectura dual no viaja: enlázalo a mano en el
  receptor (ficha del libro → compañero).
- **HTTP de red local**: la copia va sin cifrar por tu WiFi (como el propio
  modo `lan`). Es la confianza que la Enmienda 1 define: estar en TU red.
  No uses la dirección del ordenador fuera de casa.
- Los libros «de carpeta» del ordenador (registrados sin copia) viajan como
  copia nueva al móvil, pero al revés (móvil → ordenador) el fichero se
  guarda en la casa de datos del ordenador como libro subido.

## Si algo falla

| Síntoma | Remedio |
|---|---|
| «Probar conexión» falla | ¿La dirección es la del modo lan? ¿El servidor está arrancado (`athena start --lan`)? ¿Ambos en la misma WiFi? |
| Pide contraseña y no la tienes | Mira `athena home` → `db/athena-lock`, o fija la tuya con `ATHENA_PASSWORD` en el `.env` |
| Un libro llega sin fichero | Se marcó «fichero ausente» por un fallo de red: copia otra vez ese libro |
| Copié y no veo cambios | La biblioteca se recarga sola al terminar; si cerraste antes, reabre Athena |
