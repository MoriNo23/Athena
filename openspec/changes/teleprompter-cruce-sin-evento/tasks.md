# Tasks: teleprompter-cruce-sin-evento

## 1. Fundamento puro (lib)

- [x] 1.1 `teleprompterPageOffsets`: offsets acumulados por página de la
      ventana (las ranuras null aportan 0)
- [x] 1.2 `teleprompterPageContaining` / `teleprompterPageEnd`: página que
      contiene al carácter activo y su fin (las mudas no contienen a nadie)
- [x] 1.3 `teleprompterPrunableLimit`: techo teórico de poda — solo páginas
      superadas por el activo, medibles y con ancla detrás; la última de la
      ventana nunca se poda

## 2. Ventana viva (use-teleprompter-window)

- [x] 2.1 `StreamWindow` de longitud variable: leídas + en curso + siguiente
- [x] 2.2 `pageLens`/`pageOffsets` derivados de la ventana; fuera `firstLen`
- [x] 2.3 `pruneMeasure`: mide cuántas páginas del frente salieron del
      encuadre (pie por encima del borde superior − 30 % de respeto); la
      poda la ejecuta el jugador

## 3. Motor (use-teleprompter-player)

- [x] 3.1 Fuera `slide()` y `allowCross`: el cruce ya no intercambia la
      ventana ni toca el DOM
- [x] 3.2 `appendNext`: la página siguiente se AÑADE al final de la columna
      al entrar en la última cargada (relleno con geometría viva: una poda
      en el ínterin no estropea la ranura)
- [x] 3.3 `crossBoundaries`: anuncio de progreso una sola vez por frontera
      (ida y vuelta no duplica conteo — `lastFired`) + prefetch
- [x] 3.4 `pruneFront`: poda frontal con ancla (`stageViewAnchor(prunedLen, 0)`),
      rebase de `lit`/`crossed`/`dueRef` y re-arranque del motor sin pérdida
      de espera
- [x] 3.5 Sin Auto: pageDone al final de la página; `forward` anuncia y
      continúa; `Shift+→` enciende el resto de la página, anuncia y sigue
- [x] 3.6 `rewindOne` re-cuenta fronteras al retroceder; `Shift+←` conserva
      el prepend con ancla sobre la ventana viva (sin descartar páginas)
- [x] 3.7 Reconstrucción de ventana SOLO si la página pedida sale de ella

## 4. Interfaz (TeleprompterOverlay)

- [x] 4.1 Render POR PÁGINAS (`.tp-page[data-page]`): claves estables al
      añadir y podar — los bloques no se re-montan
- [x] 4.2 Progreso de página real (barra + cabecera) vía página contenedora
- [x] 4.3 Corte natural del aviso de descanso por `pageNum` (cruce real)

## 5. Validación

- [x] 5.1 Tests: offsets, página contenedora, fin de página, techo de poda
      (mudas frenan, última página protegida)
- [x] 5.2 `bun test` + `tsc --noEmit` + `bun run lint` + `bun run build`
- [ ] 5.3 Pasada visual de la dueña: el texto leído se va SOLO por el scroll
      (nada desaparece al cruzar), la poda no salta, pausa/reanudar y
      rebobinado intactos
