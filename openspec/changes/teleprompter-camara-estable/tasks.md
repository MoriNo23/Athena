# Tasks: teleprompter-camara-estable

> Estado real del parche (aplicado y verificado con `tsc` + `bun test` +
> `bun run lint` + `bun run build` + smoke test de producción). Algunos
> detalles del SDD se implementaron de forma equivalente pero no idéntica;
> la nota en cada tarea lo dice.

## 1. Módulo de cámara

- [x] 1.1 Crear `src/lib/camera.ts` con `CameraController` — API final:
      `order(target, { instant })`, `cancel()`, `isActive()` (un controlador
      único con objetivo mutable; `attach/detach` no hizo falta: el host se
      lee por `el()` y el desmontaje mata el bucle con `attached()`)
- [x] 1.2 Bucle rAF único con lerp exponencial normalizado por tiempo
      (`1 - e^(-dt/τ)`, τ = 90 ms, `CAMERA_TAU_MS` configurable)
- [x] 1.3 Detección de cesión (yield): `scrollTop` real vs último escrito
      (umbral 2 px, `CAMERA_YIELD_PX`); la cámara duerme hasta nueva orden
- [x] 1.4 Deadzone de asentamiento (0,75 px, `CAMERA_SETTLE_PX`): escribe
      exacto y para el bucle; a reposo no hay rAF activo
- [x] 1.5 Tests unitarios del paso con `bun test` (`src/lib/camera.test.ts`):
      convergencia exacta, monotonicidad (sin sobrepaso), retarget continuo,
      cesión, `instant`, desmontaje y cancelación — 7 casos

## 2. Reserva de banda

- [x] 2.1 Banda de lectura — implementada con el ancla existente del
      escenario (carácter activo a `clientHeight · 0.4` en `scrollToChar`),
      que es la banda del SDD sin tocar CSS (0 regresiones de layout)
- [x] 2.2 El objetivo se calcula contra rects frescos del carácter activo en
      cada orden (sin cachear posiciones viejas)
- [ ] 2.3 Verificación con capturas del primer/último carácter en banda
      (pendiente de pasada visual con libro real)

## 3. Integración

- [x] 3.1 `scrollToChar()` → `camera.order(target)`; `instant` escribe exacto
      y sin bucle (rebobinado)
- [x] 3.2 Cesión conectada: rueda y ↑ ya cancelaban el vuelo
      (`cancelViewAnim()` → `camera.cancel()`); la siguiente orden re-engancha
      desde la posición real
- [x] 3.3 Ancla atómica de cruce intacta: el layout effect sobre `[win]`
      cancela la cámara y compensa `scrollTop` antes del pintado
- [x] 3.4 `view-anim.ts` retirado del teleprompter (el módulo quedó en el
      repo: nadie lo importa; eliminarlo es trivial si el upstream prefiere)
- [x] 3.5 `prefers-reduced-motion` e Instantánea: escritura directa
      (`viewInstantRef`), sin interpolación

## 4. Validación

- [x] 4.1 Trayectoria auditada por los tests: distancia al objetivo
      monótona (0 oscilaciones) en avance y en retarget
- [ ] 4.2 Performance trace con libro real (pendiente; el coste por cuadro
      es una resta + exp + una escritura de `scrollTop`)
