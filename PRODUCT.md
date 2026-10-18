# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

La usuaria principal es la dueña del proyecto: lee sus propios libros en su
máquina (escritorio/portátil), normalmente de noche y en sesiones largas de
libros gordos (cientos de páginas). Audiencia futura confirmada como dirección:
otros lectores que clonen el repo y monten **su propia** biblioteca local —
nunca usuarios de un servicio alojado.

## Product Purpose

Atena es una app de lectura local-first para PDF y EPUB cuyo producto es **la
última página**: que los libros se terminen. Éxito = libros terminados
(`readCount`, `finishedAt`); el mecanismo diario que lleva ahí es el **riel** —
progreso con hitos, racha y ETA honesta a la última página — que te devuelve a
leer hoy. Terminar es la meta; el riel es el instrumento.

## Positioning

«Tu biblioteca nunca sale de tu máquina, y un solo instrumento honesto — el
riel — te lleva a la última página; el teleprompter lee la página a ritmo,
letra a letra.» Un lector vecino (Kindle, Calibre, Readwise) no puede copiar
ambas cosas a la vez: cero cuentas/cero nube **y** la lectura como rito
diario con ritmo propio.

## Operating Context

- Lectura personal nocturna en escritorio; el tema oscuro (*noche egea*) es el
  default de la casa.
- Libros largos reales como banco de prueba: El mundo de Sofía (670 p),
  Don Quijote, Meditaciones.
- Desarrollo y uso en la misma máquina: `bun run dev` en :3000; la lectura
  funciona offline una vez instalada (internet solo para instalar, OCR inicial,
  buscador de portadas y diccionario).
- Estado íntegro en `db/custom.db` + `public/uploads/`: copiar esas dos rutas
  es una copia de seguridad completa.

## Capabilities and Constraints

- Capacidades: PDF digital y escaneado (OCR), EPUB reflow con páginas
  virtuales, modo texto de PDF (reflow + tipografías de lectura), teleprompter
  continuo, diccionario por selección, lectura dual sincronizada, inmersión,
  riel con hitos/racha/ETA, insignias, sesiones de lectura, interfaz es/en/pt.
- Restricciones vinculantes confirmadas: **offline** y **local-first** — la
  biblioteca y el progreso nunca salen de la máquina; no hay cuentas, ni nube,
  ni sincronización.
- Stack existente (no negociable en la práctica): Bun, Next.js 16 + React 19 +
  TypeScript + Tailwind 4, Prisma + SQLite, PDF.js.
- Decisión abierta apuntada: apertura futura = **repo público** (otros lo
  clonan y montan lo suyo). No se compromete demo alojada ni cuentas; cualquier
  feature que exija servidor contradice la restricción local-first.

## Brand Commitments

- Nombre: **Atena** (sello propio `public/atena-seal.svg`, logo `public/logo.svg`).
- Voz nacida en español: *riel*, *insignias*, «la casa de lectura»; los términos
  propios se traducen después (es/en/pt), nunca al revés.
- Decoración de la sala: `atena-capa2-fachada.png` y `atena-capa2-busto.png`
  (capa ambiental de la biblioteca).
- Trato de «la casa»: la interfaz habla de estancias y objetos de lectura, no
  de «features» ni «ajustes de sistema».

## Evidence on Hand

- Libros reales de la dueña cargados en la biblioteca (Sofia, Quijote,
  Meditaciones, cuaderno escaneado).
- README/LEEME con capturas vivas y reglas de la casa escritas.
- Auditorías medibles: `docs/auditoria-impeccable.md` (baselines antes/después
  con capturas y JSON del detector), contrastes AA+ verificados por script.
- Ausencias que el trabajo futuro no debe inventar: no hay usuarias externas,
  testimonios, prensa ni métricas de adopción; no hay archivo LICENSE.

## Product Principles

1. **La última página es el producto.** Toda función existe para terminar el
   libro o para traerte de vuelta hoy; lo que no sirva a eso es ruido.
2. **Un instrumento, no un panel.** El riel carga el progreso completo; sin
   gamificación de adorno ni tableros de métricas.
3. **Tu biblioteca es tuya.** Local-first y offline son arquitectura, no un
   ajuste; ninguna función puede exigir la nube.
4. **El texto manda.** En las superficies de lectura, la letra, el ritmo y la
   inmersión van antes que la decoración; la casa se nota en los detalles.
5. **Números honestos.** Progreso, racha y ETA se calculan de lectura real,
   nunca inflados ni decorativos.
