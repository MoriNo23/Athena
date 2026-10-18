# Proposal

## Why

La dirección confirmada de `PRODUCT.md` es repo público: otros clonan y auto-hospedan. Hoy faltan las piezas que vuelven real esa entrega: no existe `LICENSE` (sin licencia nadie puede reusar el código legalmente), el arranque de un clon limpio es dudoso (`DATABASE_URL` difiere entre el `.env` vivo, `.env.example` y el README, y hay un `prisma/db/` vacío), y no hay checklist de release para terceros.

## What Changes

- **LICENSE MIT** (decidido con la dueña): licencia permisiva, cero fricción para clonar, modificar y auto-hospedar.
- **Arranque de clon limpio confiable**: una sola forma canónica de `DATABASE_URL` en `.env`, `.env.example` y README/LEEME, decidida empíricamente (probar ambas contra un clon limpio) y verificada con `scripts/clean-install-test.sh`.
- **Onboarding de terceros**: revisar README «RUN IT» y LEEME con ojos de recién llegado (prereqs, copia de `.env`, `db push`, primera subida de un libro, OCR/idiomas, backup).
- **Checklist de release** documentado para quien clone (build de producción, lint, tsc, crap).
- **PRODUCT.md**: la ausencia de `LICENSE` y la decisión abierta de apertura pública dejan de figurar como pendientes.

## Capabilities

### New Capabilities

(Ninguna.)

### Modified Capabilities

(Ninguna: sin cambios de comportamiento del producto; el change se marca `skip_specs` en `.openspec.yaml`.)

## Impact

- Archivos: `LICENSE` (nuevo), `.env`, `.env.example`, `README.md`, `LEEME.md`, `PRODUCT.md`; verificación con `scripts/clean-install-test.sh` sobre un clon limpio.
- Sin cambios de comportamiento de la app, de datos ni de dependencias.
