#!/usr/bin/env python3
"""Genera un PDF 'compañero' (traducción simulada) de 12 páginas para probar la lectura dual."""
import os

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import navy

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "upload", "companion-es.pdf")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

c = canvas.Canvas(OUT, pagesize=A4)
width, height = A4

CHUNKS = [
    "Chapter One - The River of Words",
    "Chapter Two - The Reading Rail",
    "Chapter Three - Milestones of the Mind",
    "Chapter Four - The Duolingo Trick",
    "Chapter Five - Filters for the Eyes",
    "Chapter Six - Zoom and Comfort",
    "Chapter Seven - The Paper Trail",
    "Chapter Eight - Three Passes",
    "Chapter Nine - Natural Pauses",
    "Chapter Ten - The Vocabulary Vault",
    "Chapter Eleven - Predictions",
    "Chapter Twelve - The End of the Rail",
]

for i, title in enumerate(CHUNKS, start=1):
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 150, title)
    c.setFont("Helvetica", 12)
    c.setFillColorRGB(0.25, 0.25, 0.3)
    c.drawCentredString(width / 2, height - 200, f"(Companion edition - page {i} of {len(CHUNKS)})")
    body = (
        "This companion volume mirrors the progress of the main book. "
        "When you turn a page in the primary edition, this translation follows you, "
        "aligned by relative progress so that both readings advance together, "
        "even when the two editions differ in length and typography."
    )
    y = height - 280
    for _ in range(6):
        c.drawString(90, y, body[: 88])
        y -= 20
    c.showPage()

c.save()
print(f"OK {OUT}")
