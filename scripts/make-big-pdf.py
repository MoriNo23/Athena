"""Genera un PDF con capa de texto para pruebas (subida y modo texto).

Sin argumentos mantiene el uso de siempre: 60 páginas + 25MB de relleno tras el
%%EOF para probar la barra de subida (los lectores y PDF.js lo ignoran).

  python3 scripts/make-big-pdf.py                                   # 60 págs, con relleno
  python3 scripts/make-big-pdf.py 670 --nopad --out libro-largo.pdf # tomo para medir la preparación
"""
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

ARGS = sys.argv[1:]
PAGES = next((int(a) for a in ARGS if a.isdigit()), 60)
PAD = "--nopad" not in ARGS
NAME = ARGS[ARGS.index("--out") + 1] if "--out" in ARGS else "gordo-test.pdf"

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), NAME)

# pageCompression=0 deja los streams sin comprimir: el PDF engorda de verdad
c = canvas.Canvas(OUT, pagesize=A4, pageCompression=0)
W, H = A4

RELLENO = ("El riel de la lectura avanza pagina a pagina y cada tramo completado "
           "es un pequeno triunfo que el cerebro celebra. ") * 40

for i in range(1, PAGES + 1):
    c.setFillColorRGB(1, 0.99, 0.96)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColorRGB(0.55, 0.36, 0.12)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(2.5 * cm, H - 3.5 * cm, f"Capitulo gordo {i}")
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.setFont("Helvetica", 9)
    y = H - 5 * cm
    for _ in range(46):
        c.drawString(2.5 * cm, y, f"p{i}: {RELLENO[:120]}")
        y -= 0.55 * cm
        if y < 2 * cm:
            y = H - 5 * cm
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawCentredString(W / 2, 1.5 * cm, f"— {i} / {PAGES} —")
    c.showPage()

c.save()
if PAD:
    # Relleno tras el %%EOF: los lectores (y PDF.js) lo ignoran, pero el archivo
    # pesa de verdad para probar la barra de progreso de subida.
    with open(OUT, "ab") as f:
        f.write(b"% padding para prueba de subida\n")
        f.write(b"% " + b"x" * (25 * 1024 * 1024) + b"\n")
        f.write(b"%%EOF\n")
print("OK", OUT, round(os.path.getsize(OUT) / 1024 / 1024, 1), "MB,", PAGES, "páginas")
