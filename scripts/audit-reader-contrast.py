#!/usr/bin/env python3
"""Auditoría de contraste de los tokens de lectura (change «Teleprompter y
lector», task 3.1).

Lee `--reader-bg`, `--reader-ink`, `--reader-title` y `--reader-rule` desde
`src/app/globals.css` (:root claro y .dark), convierte oklch → sRGB →
luminancia relativa WCAG y calcula el contraste:

  · cuerpo (ink vs bg)     ≥ 4.5:1  (AA texto normal)
  · títulos (title vs bg)  ≥ 3:1    (AA texto grande)
  · regla (rule vs bg)     ≥ 3:1    (WCAG 1.4.11, componentes no textuales)

Sale con código 1 si algún umbral falla.

  python3 scripts/audit-reader-contrast.py
"""
import math
import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "src/app/globals.css"
text = CSS.read_text(encoding="utf-8")


def block(selector: str) -> str:
    m = re.search(rf"^{re.escape(selector)}\s*\{{", text, re.M)
    if not m:
        raise SystemExit(f"bloque {selector} no encontrado")
    brace = text.index("{", m.start())
    depth = 0
    for i in range(brace, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[brace : i + 1]
    raise SystemExit(f"bloque {selector} sin cerrar")


def token(block_text: str, name: str) -> tuple[float, float, float]:
    m = re.search(rf"--{name}:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)", block_text)
    if not m:
        raise SystemExit(f"token --{name} no encontrado")
    return tuple(float(g) for g in m.groups())  # type: ignore[return-value]


def oklch_to_linear_rgb(L: float, C: float, H: float) -> tuple[float, float, float]:
    """oklch → oklab → sRGB lineal (Björn Ottosson), con recorte a gamut."""
    h = math.radians(H)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(min(1.0, max(0.0, v)) for v in (r, g, bb))  # type: ignore[return-value]


def luminance(rgb: tuple[float, float, float]) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def ratio(fg: tuple[float, float, float], bg: tuple[float, float, float]) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def hexof(rgb: tuple[float, float, float]) -> str:
    def ch(v: float) -> int:
        s = v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
        return round(min(1.0, max(0.0, s)) * 255)

    return "#%02X%02X%02X" % tuple(ch(v) for v in rgb)


THEMES = [("claro", block(":root")), ("oscuro", block(".dark"))]
CHECKS = [("cuerpo", "ink", 4.5), ("títulos", "title", 3.0), ("regla", "rule", 3.0)]
fail = 0

print(f"Fuente: {CSS.relative_to(CSS.parent.parent)}")
for theme, css in THEMES:
    bg = oklch_to_linear_rgb(*token(css, "reader-bg"))
    print(f"\n=== tema {theme} — fondo {hexof(bg)} ===")
    for label, prop, minimum in CHECKS:
        fg = oklch_to_linear_rgb(*token(css, f"reader-{prop}"))
        r = ratio(fg, bg)
        ok = r >= minimum
        fail += 0 if ok else 1
        print(f"  [{'PASS' if ok else 'FAIL'}] {label:<8} {hexof(fg)} vs fondo: {r:5.2f}:1 (mín {minimum})")

print("\nCONTRASTE SANO — todos los umbrales AA+" if not fail else f"\n{fail} umbral(es) sin cumplir")
sys.exit(1 if fail else 0)
