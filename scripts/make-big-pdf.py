"""Genera un PDF grande (~25MB, sin compresión) para probar la barra de subida."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

OUT = "/home/z/my-project/scripts/gordo-test.pdf"

# pageCompression=0 deja los streams sin comprimir: el PDF engorda de verdad
c = canvas.Canvas(OUT, pagesize=A4, pageCompression=0)
W, H = A4

RELLENO = ("El riel de la lectura avanza pagina a pagina y cada tramo completado "
           "es un pequeno triunfo que el cerebro celebra. ") * 40

for i in range(1, 61):
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
    c.drawCentredString(W / 2, 1.5 * cm, f"— {i} / 60 —")
    c.showPage()

c.save()
import os
# Relleno tras el %%EOF: los lectores (y PDF.js) lo ignoran, pero el archivo
# pesa de verdad para probar la barra de progreso de subida.
with open(OUT, "ab") as f:
    f.write(b"% padding para prueba de subida\n")
    f.write(b"% " + b"x" * (25 * 1024 * 1024) + b"\n")
    f.write(b"%%EOF\n")
print("OK", OUT, round(os.path.getsize(OUT) / 1024 / 1024, 1), "MB")
