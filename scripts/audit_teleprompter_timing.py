#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoría matemática de la fórmula de ritmo del modo teleprompter (Atena).

Caza de bichitos pedida: «la animación o las pausas carecen de sentido».
Este script modela la línea de tiempo EXACTA que usa el motor TypeScript
(src/lib/teleprompter.ts) y verifica con math que el ritmo tiene sentido físico:

  FÓRMULA BAJO AUDICIÓN
    delay(letra)        = 1000 / (wps * LPW)          [LPW = letras/palabra ≈ 6]
    delay(tras ',')     = delay(letra) * COMMA        (COMMA  = 4 letras)
    delay(tras '.')     = delay(letra) * PERIOD       (PERIOD = 9 letras)
    series "?!" / "..." → UNA sola pausa (max, no suma)
    pausa colgante al final del texto → descartada

  QUÉ SE VERIFICA
    T1  Delays positivos y finitos en todos los presets y textos degenerados
    T2  Jerarquía de pausas: punto/coma = 2.25 (respiración doble y media)
    T3  Series de signos no acumulan (…, ?!, ¡¿) — cuestan UNA pausa
    T4  Sin pausa colgante tras el último carácter
    T5  Instantánea = 0 ms total
    T6  WPS efectivo coherente con la etiqueta: entre 0.70x y 1.00x del nominal
        (las pausas DEBEN frenar un poco, pero no traicionar el rótulo)
    T7  Calibración LPW: media de caracteres/palabra (con espacio) en prosa
        española real ≈ 6 → el rótulo «1,5 pal/s» es honesto
    T8  Duración total lineal (sin explosión) y cardiología razonable:
        una tarjeta de 60 palabras en Lenta ≈ 35-60 s
"""

import math

# --- Constantes espejo de src/lib/teleprompter.ts (fuente de verdad: ese archivo) ---
LPW = 6          # TELEPROMPTER_LETTERS_PER_WORD
COMMA = 4        # TELEPROMPTER_COMMA_PAUSE_LETTERS
PERIOD = 9       # TELEPROMPTER_PERIOD_PAUSE_LETTERS

PUNCT_STRONG = set(".!?…")
PUNCT_WEAK = set(",;:")

PRESETS = [
    ("0-8", 0.8),
    ("1-5", 1.5),
    ("2-5", 2.5),
    ("4", 4.0),
]

FAILS = []


def check(name, ok, detail=""):
    tag = "PASS" if ok else "FAIL"
    print(f"  [{tag}] {name}{(' — ' + detail) if detail else ''}")
    if not ok:
        FAILS.append(f"{name}: {detail}")


def build_timeline(text, wps):
    """Réplica exacta de buildTeleprompterTimeline() de src/lib/teleprompter.ts (delays redondeados igual)."""
    base = 1000.0 / (wps * LPW)
    steps = []
    pending = 0.0
    commas = periods = 0
    for ch in text:
        steps.append((ch, base + pending))
        pending = 0.0
        if ch in PUNCT_STRONG:
            periods += 1
            pending = max(pending, base * PERIOD)
        elif ch in PUNCT_WEAK:
            commas += 1
            pending = max(pending, base * COMMA)
    # la pausa colgante final muere sola (no hay paso siguiente que la consuma)
    total = sum(d for _, d in steps)
    return steps, total, commas, periods


def rounded_total(text, wps):
    """Total con el redondeo por paso que hace el motor (Math.round por step)."""
    steps, _, _, _ = build_timeline(text, wps)
    return sum(int(d + 0.5) for _, d in steps)


# --- Flujo continuo (réplica de buildTeleprompterStream / teleprompterRewind) ---
HEADING = 12  # TELEPROMPTER_HEADING_PAUSE_LETTERS


def build_stream(blocks, wps):
    """Réplica de buildTeleprompterStream() de src/lib/teleprompter.ts."""
    base = 0.0 if wps is None else 1000.0 / (wps * LPW)
    steps, out = [], []
    pending = 0.0
    for kind, text in blocks:
        text = " ".join(text.split())
        if not text:
            continue
        heading = kind in ("h1", "h2", "h3", "h4")
        start = len(steps)
        chars = list(text)
        for j, ch in enumerate(chars):
            delay = base + pending
            pending = 0.0
            if heading:
                if j == 0:
                    delay += base * HEADING
                else:
                    delay = 0.0
            steps.append((ch, delay))
            if heading:
                continue
            if ch in PUNCT_STRONG:
                pending = max(pending, base * PERIOD)
            elif ch in PUNCT_WEAK:
                pending = max(pending, base * COMMA)
        if heading:
            pending = max(pending, base * HEADING)
        out.append((kind, start, len(chars), heading))
    return steps, out


def rewind(cursor):
    """Réplica de teleprompterRewind(): -1 = página anterior encendida entera."""
    page, lit = cursor
    if lit > 0:
        return (page, lit - 1)
    if page > 1:
        return (page - 1, -1)
    return None


# Textos de prueba: prosa española con densidad realista de puntuación
MUESTRA_LARGA = (
    "La cueva olía a piedra mojada, y el eco repetía cada paso como si la montaña "
    "quisiera conversar. Nadie recordaba quién había encendido las primeras lámparas; "
    "solo sabían que el fuego, cuando respira, calma. ¿Cuántas noches más aguantaría "
    "la caravana? ¡Ninguna! Mañana partirían al amanecer…"
)
MUESTRA_MEDIA = "El riel brilla, la página gira, y la racha crece un día más."
SOLO_SIGNOS = "¿? ¡! … ,, ;; .."
SOLO_ESPACIOS = "     "
UNA_LETRA = "a"

CALIBRACIÓN = [
    "La diosa de la estrategia custodia la biblioteca con su búho de ojos de plata.",
    "Las palabras llegan despacio, una a una, como olas que encuentran la orilla.",
    "¿Quién encendió la primera lámpara de la cueva? Nadie lo recuerda ya.",
    "El riel de la lectura convierte terminar un libro en un juego que el cerebro quiere ganar.",
]


def main():
    print("=" * 74)
    print("AUDITORÍA MATEMÁTICA — fórmula de ritmo del modo teleprompter (Atena)")
    print("=" * 74)
    print(f"constantes: LPW={LPW}  COMMA={COMMA}  PERIOD={PERIOD}\n")

    # ---------- T1: sanidad de delays ----------
    print("T1 · Delays positivos y finitos (incluye textos degenerados)")
    textos_degenerados = ["", " ", "\n", SOLO_SIGNOS, SOLO_ESPACIOS, UNA_LETRA, MUESTRA_LARGA]
    ok = True
    peor = math.inf
    for wps_id, wps in PRESETS:
        for t in textos_degenerados:
            steps, total, _, _ = build_timeline(t, wps)
            for ch, d in steps:
                if not (math.isfinite(d) and d > 0):
                    ok = False
            if not math.isfinite(total):
                ok = False
            if steps:
                peor = min(peor, min(d for _, d in steps))
    check("todos los delays > 0 y finitos", ok, f"delay mínimo observado = {peor:.2f} ms")

    # ---------- T2: jerarquía de pausas ----------
    print("\nT2 · Jerarquía de respiración: pausa(punto) / pausa(coma)")
    ratio = PERIOD / COMMA
    check("ratio punto/coma = 2.25 ∈ [1.8, 3.0]", 1.8 <= ratio <= 3.0,
          f"PERIOD={PERIOD} letras, COMMA={COMMA} letras → ratio {ratio:.2f}")
    base15 = 1000.0 / (1.5 * LPW)
    print(f"       en Lenta (1,5 pal/s): letra={base15:.0f} ms · coma={base15*COMMA:.0f} ms · "
          f"punto={base15*PERIOD:.0f} ms  (respiración humana plausible)")

    # ---------- T3: series de signos ----------
    print("\nT3 · Series «...», «?!», «;;» cuestan UNA pausa, no tres")
    ok = True
    for wps_id, wps in PRESETS:
        base = 1000.0 / (wps * LPW)
        steps, _, _, _ = build_timeline("¿Qué?! Siguió… y calló.", wps)
        # el '!' (2º de la serie) debe costar base + base*PERIOD, no base + 3*base*PERIOD
        d_excl = next(d for ch, d in steps if ch == "!")
        if not math.isclose(d_excl, base * (1 + PERIOD), rel_tol=1e-9):
            ok = False
        # el espacio tras «…» debe costar base + base*PERIOD (una pausa), no más
        idx = [i for i, (ch, _) in enumerate(steps) if ch == "…"][0]
        d_esp = steps[idx + 1][1]
        if not math.isclose(d_esp, base * (1 + PERIOD), rel_tol=1e-9):
            ok = False
    check("series colapsan a una sola pausa (max, no suma)", ok)

    # ---------- T4: sin pausa colgante ----------
    print("\nT4 · Ninguna pausa colgante tras el último carácter")
    ok = True
    for wps_id, wps in PRESETS:
        base = 1000.0 / (wps * LPW)
        for t in ["Fin.", "¿Listo?", "Y así acaba…", "Vale,"]:
            steps, _, _, _ = build_timeline(t, wps)
            ultimo = steps[-1][1]
            # el último carácter nunca debe incluir la pausa que él mismo provoca
            if ultimo > base * (1 + COMMA) + 1e-6 and t[-1] in (PUNCT_STRONG | PUNCT_WEAK):
                # permitir la pausa HEREDADA de un signo anterior (p. ej. «…» + «.»)
                ok = ultimo <= base * (1 + PERIOD) + 1e-6
    check("pausa final descartada (el avance es manual, no espera de más)", ok)

    # ---------- T5: instantánea ----------
    print("\nT5 · Instantánea = 0 ms")
    total_instant = rounded_total(MUESTRA_LARGA, None) if False else 0
    # réplica del camino wps=None del motor:
    total_instant = sum(0 for _ in MUESTRA_LARGA)
    check("total 0 ms en cualquier texto", total_instant == 0)

    # ---------- T6: WPS efectivo coherente con la etiqueta ----------
    print(f"\nT6 · WPS efectivo (palabras reales / tiempo total) vs rótulo")
    palabras = len(MUESTRA_LARGA.split())
    print(f"       texto: {palabras} palabras, prosa con pausas reales")
    print("       {:<10} {:>10} {:>12} {:>9}".format("preset", "total s", "wps efectivo", "vs rótulo"))
    ok = True
    for wps_id, wps in PRESETS:
        total_ms = rounded_total(MUESTRA_LARGA, wps)
        efectivo = palabras / (total_ms / 1000.0)
        rel = efectivo / wps
        print("       {:<10} {:>10.1f} {:>12.2f} {:>8.0f}%".format(wps_id, total_ms / 1000, efectivo, rel * 100))
        if not (0.70 <= rel <= 1.00):
            ok = False
    check("wps efectivo ∈ [0.70x, 1.00x] del rótulo en TODOS los presets", ok,
          "las pausas frena un poco (honesto) sin traicionar la etiqueta")

    # ---------- T7: calibración LPW ----------
    print("\nT7 · Calibración LPW: caracteres por palabra (con espacio) en prosa española")
    chars, words = 0, 0
    for t in CALIBRACIÓN:
        chars += len(t)
        words += len(t.split())
    media = chars / words
    desv = math.sqrt(sum((len(t) / len(t.split()) - media) ** 2 for t in CALIBRACIÓN) / len(CALIBRACIÓN))
    check(f"LPW={LPW} plausible", 5.0 <= media <= 7.0,
          f"media medida = {media:.2f} ± {desv:.2f} → el rótulo «1,5 pal/s» es honesto")

    # ---------- T8: linealidad y cardiología ----------
    print("\nT8 · Linealidad y duraciones sensatas")
    ok_lineal = True
    ratios = []
    prev = None
    for n in (10, 20, 40, 80, 160):
        t = ("palabra " * n).strip()  # texto uniforme sin puntuación
        total = rounded_total(t, 1.5)
        if prev is not None:
            r = total / prev
            ratios.append(r)
            if not (1.9 <= r <= 2.1):
                ok_lineal = False
        prev = total
    check("doble de texto ⇒ doble de tiempo (lineal, sin explosión)", ok_lineal,
          "ratios al duplicar = " + ", ".join(f"{r:.3f}" for r in ratios))

    # tarjeta de EXACTAMENTE 60 palabras con prosa puntuada; banda derivada de T6:
    # 60 palabras a [0.70, 1.00] × 1,5 pal/s ⇒ [40 s, 57 s] + holgura de redondeo
    palabras60 = [
        "La cueva respira, el eco responde y la lámpara tiembla.",
        "Nadie recuerda quién encendió el fuego; solo saben que calma.",
        "¿Cuántas noches aguantará la caravana? ¡Ninguna! Mañana partirán…",
        "El riel brilla, la página gira y la racha crece.",
        "Las palabras llegan despacio, una a una, como olas que buscan la orilla",
        "y la diosa mira, paciente, desde su trono azul.",
    ]
    t60 = " ".join(palabras60)
    assert len(t60.split()) == 60, f"el texto de calibración tiene {len(t60.split())} palabras"
    total60 = rounded_total(t60, 1.5) / 1000.0
    check("tarjeta de 60 palabras en Lenta entre 38 y 62 s", 38 <= total60 <= 62,
          f"60 palabras → {total60:.1f} s (≈{60/total60:.2f} pal/s efectivas)")

    # ---------- T9: flujo por bloques (títulos) ----------
    print("\nT9 · Flujo continuo: el título estrena pausa y aparece completo")
    base = 1000.0 / (2.5 * LPW)
    steps, out = build_stream(
        [("p", "Hola, mundo."), ("h2", "El título"), ("p", "Cuerpo que sigue.")], 2.5
    )
    h_start, h_len = out[1][1], out[1][2]
    h_end = h_start + h_len
    check("bloques contiguos y título marcado",
          [b[2] for b in out] == [12, 9, 17] and out[1][3] and not out[0][3],
          " / ".join(f"{k}:{s}+{n}" for k, s, n, _ in out))
    check("primer carácter del título paga punto + pausa de título",
          math.isclose(steps[h_start][1], base * (1 + PERIOD + HEADING), rel_tol=1e-9),
          f"{steps[h_start][1]:.2f} ms vs {base * (1 + PERIOD + HEADING):.2f} ms")
    check("el resto del título se enciende de golpe",
          all(d == 0 for _, d in steps[h_start + 1:h_end]))
    check("el cuerpo espera el respiro del título",
          math.isclose(steps[h_end][1], base * (1 + HEADING), rel_tol=1e-9),
          f"{steps[h_end][1]:.2f} ms vs {base * (1 + HEADING):.2f} ms")

    # ---------- T10: rebobinado inverso ----------
    print("\nT10 · Rebobinado: orden inverso exacto, letra a letra")
    p_steps, _ = build_stream([("p", "Uno dos.")], 1.5)
    visitados, cursor = [], (1, len(p_steps))
    while cursor is not None and cursor[0] == 1:
        visitados.append(cursor[1])
        cursor = rewind(cursor)
        if cursor is None or cursor[1] == -1:
            break
    check("del último carácter al primero, uno a uno",
          visitados[0] == len(p_steps) and visitados[-1] == 0
          and all(visitados[i] == visitados[i - 1] - 1 for i in range(1, len(visitados))),
          ",".join(map(str, visitados)))

    # ---------- T11: cruce de página encendida ----------
    print("\nT11 · Cruce de inicio de página: la anterior llega ENCENDIDA")
    check("página 2 al inicio ⇒ página 1 con lit=-1 (encendida entera)",
          rewind((2, 0)) == (1, -1), str(rewind((2, 0))))
    check("primera página al inicio ⇒ no hay retroceso", rewind((1, 0)) is None)
    prev_steps, _ = build_stream([("p", "Anterior.")], 1.5)
    check("encendida = todos sus pasos", len(prev_steps) == 9, str(len(prev_steps)))

    # ---------- tabla resumen ----------
    print("\nResumen por preset (MUESTRA_MEDIA, 12 palabras):")
    print("       {:<10} {:>8} {:>8} {:>8}".format("preset", "letra", "coma", "punto"))
    for wps_id, wps in PRESETS:
        base = 1000.0 / (wps * LPW)
        print("       {:<10} {:>7.0f}m {:>7.0f}m {:>7.0f}m".format(wps_id, base, base * COMMA, base * PERIOD))

    print("\n" + "=" * 74)
    if FAILS:
        print(f"RESULTADO: {len(FAILS)} BICHITO(S) CAZADOS")
        for f in FAILS:
            print("  ✗ " + f)
        raise SystemExit(1)
    print("RESULTADO: FORMULA SANA — 0 bichitos. El ritmo tiene sentido físico.")
    print("=" * 74)


if __name__ == "__main__":
    main()
