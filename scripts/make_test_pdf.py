"""Genera un PDF de prueba de 24 páginas con contenido legible."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

OUT = "/home/z/my-project/scripts/test-book.pdf"

c = canvas.Canvas(OUT, pagesize=A4)
W, H = A4

for i in range(1, 25):
    # Fondo levemente cálido
    c.setFillColorRGB(1, 0.99, 0.96)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColorRGB(0.55, 0.36, 0.12)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(2.5 * cm, H - 3.5 * cm, f"Capitulo {i}")

    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.setFont("Helvetica", 12)
    y = H - 5 * cm
    for p in range(6):
        c.drawString(2.5 * cm, y, f"Pagina {i} — linea {p + 1}: el riel avanza mientras lees,")
        c.drawString(2.5 * cm, y - 0.6 * cm, "cada tramo completado es un pequeño triunfo para tu cerebro.")
        y -= 1.5 * cm

    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawCentredString(W / 2, 1.5 * cm, f"— {i} / 24 —")
    c.showPage()

c.save()
print("OK", OUT)
