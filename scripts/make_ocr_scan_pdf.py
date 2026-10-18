#!/usr/bin/env python3
"""Genera un PDF 'escaneado' sintético: páginas solo-imagen (JPEG), sin capa de texto.
Simula un libro escaneado real para probar el OCR de Riel."""
import os

from PIL import Image, ImageDraw, ImageFont

Image.init()  # PdfImagePlugin indexa Image.SAVE["JPEG"] sin registrar plugins

W, H = 1240, 1754  # A4 a ~150 dpi
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

PAGE1_TITLE = "El invento de la imprenta"
PAGE1_BODY = [
    "La imprenta de tipos movibles cambio por completo la forma",
    "en que la humanidad guarda y comparte el conocimiento.",
    "Antes de su llegada, cada libro era copiado a mano por",
    "escribas que dedicaban meses enteros a una sola obra.",
    "",
    "Johannes Gutenberg perfecciono la aleacion de los metales,",
    "la tinta grasosa y la prensa de tornillo hacia el ano 1450.",
    "Su primera gran produccion fue la Biblia de cuarenta y dos",
    "lineas, considerada hoy una joya de la tipografia mundial.",
    "",
    "El precio del libro cayo de manera tan dramatica que la",
    "lectura dejo de ser un privilegio del clero y la nobleza.",
    "En pocas decadas, Europa contaba con miles de talleres y",
    "la palabra escrita se convirtio en un bien comun.",
]

PAGE2_TITLE = "Reading as a superpower"
PAGE2_BODY = [
    "Deep reading builds a particular kind of attention that",
    "scrolling can never reproduce. The reader must hold",
    "characters, arguments and symbols in working memory",
    "while the story unfolds across hundreds of pages.",
    "",
    "Studies of habitual readers show stronger vocabulary,",
    "better emotional recognition and a wider general",
    "knowledge base than matched non-readers.",
    "",
    "The humble printed page remains one of the most",
    "efficient interfaces ever invented for transmitting",
    "complex ideas between human minds.",
]

FOOTER = "Pagina escaneada de prueba - Riel OCR"


def render_page(title, body, page_num):
    img = Image.new("RGB", (W, H), (250, 247, 240))
    d = ImageDraw.Draw(img)
    f_title = ImageFont.truetype(FONT_BOLD, 52)
    f_body = ImageFont.truetype(FONT_PATH, 34)
    f_foot = ImageFont.truetype(FONT_PATH, 24)

    # ligera rotación/ruido simulando escaneo no perfecto
    d.text((110, 150), title, fill=(30, 30, 30), font=f_title)
    d.line((110, 230, W - 110, 230), fill=(120, 120, 120), width=3)
    y = 300
    for line in body:
        d.text((110, y), line, fill=(45, 45, 45), font=f_body)
        y += 58
    d.text((W // 2 - 220, H - 90), FOOTER + f" · {page_num}", fill=(100, 100, 100), font=f_foot)

    # rotar 0.4 grados y recortar para que parezca scan
    img = img.rotate(0.4, fillcolor=(250, 247, 240), resample=Image.BICUBIC)
    return img


pages = [
    render_page(PAGE1_TITLE, PAGE1_BODY, 1),
    render_page(PAGE2_TITLE, PAGE2_BODY, 2),
    render_page("Notas del editor", ["Este libro de prueba contiene dos paginas", "escaneadas en espanol y una en ingles."], 3),
]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "libro-escaneado-ocr.pdf")
pages[0].save(out, save_all=True, append_images=pages[1:], resolution=150.0, quality=82)
print("OK:", out)
