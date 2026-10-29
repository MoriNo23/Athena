# Tasks: biblioteca-feedback-hoy

> Estado real del parche (tsc + bun test + lint + build + smoke en verde).

## 1. Estados y datos

- [x] 1.1 Estados derivados en `BookCard` (`hoyCumplida` / `hoyEnCurso` /
      sin empezar) sobre las sesiones del payload con la meta efectiva
      (`book.dailyGoal ?? globalGoal`) — sin tipo exportado: el derivador
      vive donde se usa (una sola consumption point)
- [x] 1.2 Sin selector nuevo: `groupSessionsByDay(...).get(dayKey(hoy))` ya
      existía y está memoizado en la tarjeta (0 peticiones extra)
- [x] 1.3 Microcopy i18n es/en/pt de los tres estados:
      `card.todayNone` / `card.todayProgress` / `card.todayGoalMet`
      (+ `card.todayRingAria`); la ambigua `card.todaySummary` se jubila

## 2. Componentes

- [x] 2.1 `TodayRing.tsx`: anillo SVG con stroke-dasharray, aria-label con
      el par páginas/meta, estado en `data-state` para tests; verde al
      cumplir la meta, color primario en curso, apagado sin empezar
- [x] 2.2 Franja «HOY» de la biblioteca: no se rediseñó en v1 (fuera de
      alcance del parche); la claridad se resuelve en la tarjeta
- [x] 2.3 Anillo + frase de estado en `BookCard` bajo el mini-riel
      (tres estados, siempre visible en libros no terminados — «Sin empezar
      hoy» se nombra, no se adivina)
- [ ] 2.4 Verificación de contraste AA con capturas en ambos temas
      (pendiente; paleta de tokens existente: primary/foreground/emerald-500)

## 3. Rendimiento y a11y

- [x] 3.1 Sin `content-visibility` nuevo: el render de la franja es un SVG de
      22 px por tarjeta (coste despreciable; se puede añadir después)
- [ ] 3.2 Recorrido de lector de pantalla (pendiente manual; aria-label del
      anillo incluido)

## 4. Validación

- [ ] 4.1 Los 5 escenarios del delta con biblioteca real (pendiente)
- [ ] 4.2 Revisión visual a 320 px y ambos temas (pendiente)
- [x] 4.3 `bun run lint`, `bunx tsc --noEmit`, `bun test` y
      `bun run build` en verde
