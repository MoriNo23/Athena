# teleprompter — Delta de especificación (aviso de descanso)

## ADDED Requirements

### Requirement: Aviso de descanso
El modo SHALL ofrecer un aviso de descanso configurable: tras
`descansoMin` minutos de lectura REAL (0 = desactivado, default de la casa;
el tiempo en pausa y con la pestaña oculta SHALL NOT sumar), el modo SHALL
sugerir un descanso de 20 s en el PRÓXIMO corte natural —pausa de la lectora
o cruce de página— y SHALL NOT interrumpir a mitad de frase ni pausar el
flujo por su cuenta. Aceptar el descanso SHALL detener el flujo y SHALL
mostrar una cuenta atrás de 20 s con el consejo 20-20-20; la reanudación
SHALL ser explícita. El aviso y el velo SHALL solo transicionar opacidad y
con movimiento reducido SHALL NOT animarse.

#### Scenario: Armado en corte natural
- **WHEN** el contador alcanza los minutos configurados mientras el flujo avanza
- **THEN** la píldora de descanso aparece en el próximo corte natural (pausa de la lectora o cruce de página), no a mitad de frase, y el flujo sigue hasta que ella decida

#### Scenario: Descanso aceptado
- **WHEN** la lectora elige «Descansar»
- **THEN** el flujo se detiene, un velo muestra la cuenta atrás de 20 s con el consejo 20-20-20 y la lectura solo se reanuda cuando ella pulsa «Continuar leyendo» (o Esc)

#### Scenario: Descanso descartado
- **WHEN** la lectora elige «Seguir leyendo»
- **THEN** la píldora desaparece, el contador vuelve a cero y el aviso se rearma al cumplir de nuevo los minutos

#### Scenario: Solo lectura real
- **WHEN** el flujo está en pausa o la pestaña está oculta
- **THEN** el contador de lectura no avanza

#### Scenario: Ajuste persistido
- **WHEN** la lectora cambia el aviso de descanso (Nunca/15/20/30/45) en la sheet del modo o en el panel
- **THEN** el ajuste persiste entre sesiones (persist v16) y en `db/config.json` (dominio 0-120; un valor roto vuelve a 0)
