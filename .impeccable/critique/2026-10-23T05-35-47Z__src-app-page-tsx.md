---
target: mi app (biblioteca + lector)
total_score: 24.5
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/content/atena/src/app/page.tsx"
target_fingerprint: "sha256:b8b3ecd55ef6ddab07705f4cd228d8c300823b4972e5d627110271b44819303f"
target_path: /content/atena/src/app/page.tsx
timestamp: 2026-10-23T05-35-47Z
slug: src-app-page-tsx
---
Method: dual-agent (A: ses_e98ca3727ffecrwirZAbY21DS3 · B: ses_e98ca3724ffeLBRWY846nxdl1U)
Target: src/app/page.tsx (biblioteca + lector, app completa) · Modo: Operate · Probado en vivo (server dev) por dos agentes aislados + verificación visual del director.

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado del sistema | 3 | Riel/pct/ETA siempre vivos, subida con fases reales; pero la UI del lector desaparece a los 4 s sin ninguna pista (y sin estado activo en tema/idioma) |
| 2 | Correspondencia con el mundo real | 3 | «Noche egea», «Papel/Sepia/Cálido», «Lectura óptima» metafóricas y honestas; «riel» se aprende solo de un subtítulo largo |
| 3 | Control del usuario y libertad | 2 | Sin deshacer tras eliminar/reiniciar; «¿Ya lo leías en otro lado?» es un rescate excelente; Reset-all pegado a la CTA principal |
| 4 | Consistencia y estándares | 3 | ARIA/tab order impecables; rompe: claves i18n crudas (`config.pos-left`) y patrón dock-desktop vs sheet-móvil inconsistente |
| 5 | Prevención de errores | 2.5 | accept=.pdf/.epub, 409-duplicado tranquilo; falla: acciones de card invisibles sin hover y subida sin cancelación a mitad |
| 6 | Reconocimiento antes que memoria | 2 | Peek solo con gesto que se desvanece; atajos solo a pantalla completa; telemetría (🔥601 🎯2/20 ⏱0m) sin leyenda |
| 7 | Flexibilidad y eficiencia | 3.5 | Atajos completos (←→↑↓, +−, F, O, M), metas por libro, hitos; capados a quien no usa teclado |
| 8 | Estética y minimalismo | 2 | Biblioteca staggered fina; lector: toolbar de 13 grupos (6 filas en 390px, ítem huérfano en 1440) y dock de 352px tapando el libro |
| 9 | Recuperación de errores | 2.5 | Toasts con causa específica muy buenos; pero sin reintento inline y el falso «¿protegido con contraseña?» diagnostica mal |
| 10 | Ayuda y documentación | 1 | Cero ayuda in-app: sin «?», sin onboarding de primer uso, sin accesos a las reglas de la casa |
| **Total** | | **24.5/40** | **Aceptable (~61%) — sólido en la casa, cojo en primera sesión, móvil y ayuda** |

## Veredicto de especificidad de diseño

**Arranca aquí: el producto se siente de Atena en las palabras, no en la piel del lector.**

- **LLM (A):** La biblioteca es inequívocamente la casa: sello dórico propio, «riel», «Añadir al riel», empty states que enseñan hitos/ETA, racha/meta/terminados con voz propia, noche egea que oscurece el PDF solo. Nada de eso lo copiarías a Calibre. Pero tres fugas: (1) el lector es una *toolbar de editor de documentos* (13 grupos en una fila, no una sala de lectura); (2) `config.pos-left / pos-bottom / pos-top / pos-right` literales en el panel de ajustes — la única superficie donde la casa habla en inglés de código; (3) un clonador nuevo abre con **fixtures de dev** («Perf denso (fixture de rendimiento)», racha «601 días») presentados como su biblioteca, contradiciendo el principio de «números honestos» en su primera vista.
- **Scan determinista (B):** 118 findings, 3 reglas, todos `advisory`: color fuera de DESIGN.md (54), font-size fuera del ramp (53), radios fuera (11). Cero findings de imagen/motion/layout/a11y. Falsos positivos identificados: los 14 colores de `src/lib/types.ts:285-335` son **datos de insignias** (niveles/tiers), no CSS de tema; los `9999px` son pills circulares intencionales; `rgb(255 158 61)` parece acento intencional de página actual en 3 visores. anomalía del contrato: salió `exit 0` con 118 findings (la convención decía exit 2).
- **Overlays:** no se intentó la inyección del overlay visual (no hay tab [Humano] disponible); se usó evidencia CLI determinista + capturas scripted + verificación visual del director de las capturas clave. Fallback registrado.

## Impresión general

La app tiene **alma y métricas que se ganan el respeto** — y una primera sesión que se las deshace: el lector te recibe tapando el libro con su panel de ajustes abierto por defecto, y a los 4 segundos *toda la UI se desvanece* sin enseñarte por qué. La casa se siente de la casa en biblioteca y copy; el chrome del lector (20+ controles planos, toolbar que desborda incluso a 1440) todavía no. El mayor oportunidad: diseñar el **minuto uno del lector** (página primero, complejidad cuando se la pida).

## Qué funciona

1. **El riel como única métrica dominante.** Progreso/hitos/racha/ETA viven en UN instrumento en biblioteca y lector; los stats nunca se convierten en dashboard. El principio del producto se cumple.
2. **La subida está al servicio del riel, no del archivo.** Título autodeducido del nombre, portada generada antes de confirmar, «N páginas detectadas», «Añadir al riel» en vez de «subir fichero».
3. **Los estados vacíos enseñan y los números son honestos.** «Tu biblioteca está vacía» explica riel/hitos/ETA; «a tu ritmo, terminas el 30 de octubre» se escribe solo con lectura real. La apuesta por la honestidad es coherente y rara.
4. **Cero errores de consola/network en toda la travesía** (藏书 desktop+móvil+lector+subidas+refresh, B): ingeniería limpia detrás del UX.

## Issues prioritarios

1. **[P0] El lector te recibe tapando el libro (dock «Ajustes de lectura» abierto por default).**
   - Por qué: la primera impresión del producto es un panel de settings; en 1440 ocupa 352px; en móvil tapa ~90% del visor Y se corta fuera de la pantalla (aside hasta x=416 en un viewport de 390, sin scroll → contenido inalcanzable). Medido en B, capturado en A; lo vieron ambos y las capturas lo confirman.
   - Arreglo: cerrado por defecto (y por sesión primera: el usuario pide un libro, no ajustes); panel a un tap cuando se necesite; en móvil → sheet/bottom-sheet que no invada.
   - Comando sugerido: `/impeccable distill`
2. **[P0] Auto-inmersión a los 4 s sin pista alguna.**
   - Por qué: header/riel/dock y cursor desaparecen sin aviso (chrome-immersed). Para la dueña entrenada es el modo correcto; para el clonador es «se rompió» — el punto exacto donde un usuario se rinde en el primer minuto. B además registró el caso agrio: lector sin chrome tras tests de teclado, confirma el ocultamiento automático.
   - Arreglo: en el primer hide de la primera sesión, mostrar un hint autodesmontable («el chrome vuelve al mover el mouse») una sola vez; luego estable. Nada de tocar el timing para los veteranos.
   - Comando sugerido: `/impeccable onboard`
3. **[P1] El texto se lee cortado y «Lectura óptima» no hace nada visible.**
   - Por qué: líneas recortadas al borde a 231% en desktop y a 100% en móvil («…que el cerebro»); «O» no cambia ni valor ni feedback. Para la app cuyo lema es «el texto manda», las líneas mutiladas en el default apparel el valle más contradictorio — y mata sesiones largas de madrugada (el caso de la dueña).
   - Arreglo: el default debe dar páginas completas sin recorte; «óptima» debe reflejar estado activo y resultado visible en el indicador. Verificar con libros reales (Sofía/Quijote), no solo el fixture ancho.
   - Comando sugerido: `/impeccable adapt`
4. **[P1] Móvil: la casa se desarma en la primera pantalla.**
   - Por qué: a 390px el hero colapsa a una caja de 0px con el subtítulo una palabra por línea (header: 564px = 67% del alto del viewport) y el botón de tema se superpone al texto; títulos de cards → «Pe…», «At…»; toolbar del lector en 6 filas; botones h-8 (32px < 44px de tap). Casey y el clonador en la cama viven exactamente esto.
   - Arreglo: subtítulo responsive (oculto o compacto), títulos razonables, acciones de card siempre visibles en touch y ≥44px, toolbar del lector reagrupada (menú de desbordamiento).
   - Comando sugerido: `/impeccable adapt`
5. **[P1] Deslizs de la casa: claves i18n crudas y foco invisible de teclado.**
   - Por qué: `config.pos-left/bottom/top/right` visibles en EN/ES/PT justo en el panel más leído por el clonador técnico; botones de card (apuntar/reset/borrar) con `opacity-0 group-hover` sin `group-focus-visible` → con Tab llegan (pasos 6-8) pero no seVEN (Sam pierde el rastro); en el lector móvil hay una parada muerta en un div SIN foco visible.
   - Arreglo: labels fijos «Izquierda/Abajo/Arriba/Derecha» (o claves que existan); variante `group-focus-visible:opacity-100` en las acciones de card; revisar el div de nota del dock.
   - Comando sugerido: `/impeccable clarify`

## Señales rojas por persona

- **Alex (power user):** el header del lector ya desborda a 1440 (ítem huérfano suelto en segunda fila, en todas las capturas); «Lectura óptima» no refleja su activación ni cambia nada visible; el zoom «242%» no conecta con los presets descritos.
- **Sam (accesibilidad):** acciones de card enfocables pero invisibles con foco (opacity-0 sin focus-visible); parada muerta del Tab en un div del dock móvil; telemetría 🔥/🎯/⏱ con tooltip `title` solo — con teclado, no llega.
- **Casey (móvil interrumpida):** primera pantalla a 390px: subtítulo en columna vertical de 1 palabra chocando con el botón de tema y «Añadir libro»; dock del lector cortado fuera de pantalla (x=416 en viewport 390) sin scroll para recuperarlo; tap targets de 32px.
- **Clonador autoalojado (persona del producto, primera sesión):** abre la app y ve «601 días» de racha con fixtures de dev como si fueran suyos; nada señala cómo partir de 0 (hay que borrar los libros uno por uno); dentro del lector, dock tapando + UI desaparecida a los 4 s — **el punto exacto donde se rinde en el primer minuto**. Y al refrescar, vuelve a la biblioteca sin deep-link al libro (la posición se conserva y aparece un «Continuar» — salva, pero es un paso extra que no estaba en su meta mental de «seguir leyendo»).

## Observaciones menores

- Reset-all («Reiniciar todo el progreso») a 24px de «Añadir libro» en el mismo hero — confirmado con alert de B; el costo emocional no lo justifica ahí (ideal: menú).
- El recorte truncado de títulos («Pe…») es `truncate` de diseño, pero en móvil devolvé 2 letras — insignificante para decidir entre libros.
- «pág. 3 de 4 · 50%» (semántica «páginas leídas») es honesto pero contra-intuitivo al primer vistazo: un primerizo dudará.
- Icono Languages del vocabulario en lector = icono idioma de biblioteca: mismo glifo, dos significados.
-	El badge circular «N» de devtools de Next invade la esquina inferior-izquierda en todas las capturas de dev — en las screenshots de README aparecerá.
- El mensaje del falso PDF diagnostica mal: sugiere «¿protegido con contraseña?» sobre un archivo de texto plano (toast real de B).
- Subida al 100% con Cancelar deshabilitado y XHR sin timeout → si la red muere, «Subiendo…» indefinido.
- La banda en biblioteca repite lo que el riel ya dice (75% leído · terminas el 30 de octubre) — redundancia en el lector.
- Hint «Haz click en el libro para activar el teclado» nunca se oculta tras el primer click.

## Preguntas para considerar

1. ¿Qué debe mostrar el primer segundo del lector: la página o los ajustes? Si la respuesta es «la página», ¿por qué el dock abre por default y la UI desaparece antes de que el usuario haya aprendido una sola interacción?
2. ¿«Que los libros se terminen» necesita 6 controles de edición de imagen (brillo/contraste/sepia/saturación/inversión/tinte) consola plana en una sala de lectura? ¿Eso es para la dueña o se le carga a cada clonador?
3. ¿Cuál es la historia del «día 1» del clonador: hoy llegan con fixtures con racha 601. ¿La app debería detectar «sala con fixtures» y ofrecer «vaciar antes de empezar»?
4. ¿El riel merece permanecer visible incluso en inmersión total (un cap feo dedicado), o el riel fuera de sight sobra?
