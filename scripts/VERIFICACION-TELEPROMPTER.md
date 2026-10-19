# Verificación del teleprompter — procedimiento reproducible

Para repetir desde cero en otra máquina (Linux/macOS, bun, node, python3, Chromium de Playwright).

## 1. Preparar

```bash
bun install
pip install reportlab pypdf pillow        # para generar los libros semilla
bunx prisma generate && bun run db:push   # cliente y esquema de la BD
bunx playwright install chromium          # las sondas usan Playwright
bun scripts/seed-library.mjs              # genera los PDFs faltantes y siembra
```

`seed-library.mjs` garantiza «Don Quijote», «Meditations» y «Cuaderno de Atenas»:
si faltan archivos en `public/uploads/` ejecuta `scripts/make-seed-books.py`; si
no puede, dice qué falta. Reinicia el progreso (usa `--no-reset` para conservarlo).

El libro de cámara («Atensayo (fixture de sondas)») lo sube `scripts/tp-fixture.js`
por API, de forma idempotente, cuando una sonda lo pide: no hay que sembrarlo.

## 2. Servidor

`scripts/with-dev.sh <comando>` arranca el dev server (puerto 3000), espera a que
responda, ejecuta el comando y lo apaga. Reinicia el servidor porque Turbopack no
recompila `globals.css` en caliente: cualquier cambio de CSS exige un arranque
nuevo. **Mata lo que haya en el puerto 3000.**

## 3. Recorrido de sondas y resultado esperado

| Comando | Esperado |
|---|---|
| `bun scripts/test-view-anim.ts` (sin servidor) | 5/5 |
| `bun scripts/test-teleprompter-engine.ts` (sin servidor) | «MOTOR SANA» |
| `bash scripts/with-dev.sh node scripts/probe-auto-cruce.js` | 5/5 |
| `bash scripts/with-dev.sh node scripts/probe-flechas-tp.js` | 9/9 |
| `bash scripts/with-dev.sh node scripts/probe-camara-suave.js` | 8/8 (R1, C1, X1, X2, T1, B1) |
| `bash scripts/with-dev.sh node scripts/test-vn-auto.js` | 18/18 |
| `bash scripts/with-dev.sh node scripts/test-vn-stress.js` | completa |
| `bash scripts/with-dev.sh node scripts/test-hotkeys-e2e.js` | completa |

Estáticas: `bunx tsc --noEmit`, `bun run lint`, `bun run crap:changed`,
`openspec validate --all --strict`.

## 4. Si C1 sigue fallando

La cámara (`lib/view-anim.ts`) cede ante cualquier `scrollTop` que no sea el que
ella dejó. Si la sonda aún acaba en ~1257 px (destino de la cámara) en vez de
~1001 px (lugar de la rueda), la causa no es la cámara: instrumenta con
`viewAnimRef` y el `scrollTop` por cuadro, y comprueba sobre qué elemento cae
la rueda de la sonda (`mouse.wheel` actúa donde esté el puntero).
