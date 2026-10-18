#!/usr/bin/env python3
"""Forja los libros gratuitos de prueba para la biblioteca de Atena.

Genera en <repo>/public/uploads:
  1. don-quijote-atena.pdf     — PDF digital en español (40 págs), texto buscable.
  2. meditaciones-atena.pdf    — PDF digital en inglés (24 págs) para el diccionario.
  3. atena-escaneado.pdf       — PDF «capturado» (img): páginas solo-imagen, para OCR.
  4. Portadas PNG para cada uno + seed-manifest.json con totalPages reales.

Domínio público: Quijote (Cervantes 1605) y Meditations (Marco Aurelio,
trad. George Long 1862). Textos condensados para prueba.
"""
import json
import os
import random
import shutil

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{BASE}/public/uploads"
os.makedirs(OUT, exist_ok=True)

DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJAVU_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# ---------------------------------------------------------------- textos ----
QUIJOTE_CAPS = [
    ("Capítulo {i}. En un lugar de la Mancha",
     ["En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.",
      "Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lentejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda.",
      "Es, pues, de saber que este sobredicho hidalgo, los ratos que estaba ocioso —que eran los más del año—, se daba a leer libros de caballerías, con tanta afición y gusto, que olvidó casi de todo punto el ejercicio de la caza y aun la administración de su hacienda."]),
    ("Capítulo {i}. Que trata del ingenioso hidalgo",
     ["El hidalgo fingió que tenía por nombre el Quijote de la Mancha, y limpió unas armas viejas, y se puso en camino por el mundo a buscar aventuras, como los caballeros andantes de los libros.",
      "Y pues dice la historia que andaba tan delgado el caballero y tan flaco el rocín, no es maravilla que el hambre llegase a los huesos del uno y del otro.",
      "Sosegóse un poco el ánimo del hidalgo al ver la mañana clara y fresca; pero le turbaba pensar que aún no había sido armado caballero, y que así no podía legalmente andar por las aventuras."]),
    ("Capítulo {i}. De la desventura del molino",
     ["En esto, descubrieron treinta o cuarenta molinos de viento que hay en aquel campo; y así como don Quijote los vio, dijo a su escudero: la fortuna guía nuestras cosas mejor de lo que acertáramos a desear.",
      "Mira, respondió, allí ves amigo Sancho Panza cómo se mueven más de treinta desaforados gigantes con quienes pienso hacer batalla.",
      "¿Qué gigantes? —dijo Sancho Panza. —Aquellos que allí ves —respondió su amo—, de los brazos largos, que los suelen tener algunos de casi dos leguas. —Mire —dijo Sancho—, que aquellos que allí se parecen no son gigantes, sino molinos de viento."]),
    ("Capítulo {i}. El yelmo de Mambrino",
     ["En esto, comenzó a llover un poco, y parecióle a Sancho que iban a cobijarse bajo el yelmo de Mambrino, que un barbero traía en la cabeza por el camino.",
      "¿Ves —dijo don Quijote— aquel caballero que trae en la cabeza un yelmo de oro, el más famoso de todo el mundo? Pues yo tengo prometido de vencerle y haceme señor de él.",
      "No hubo manera de detener al caballero: arrancó a Rocinante y fue derecho contra el barbero, que dejó el yelmo en el suelo por no perder la bacía y el asno, y se puso en salvo."]),
]

MEDITATIONS_SECTIONS = [
    ("Book {i}. Of the nature of the gods",
     ["Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil.",
      "But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, can neither be injured by any of them, nor can I be angry with my kinsman, nor hate him.",
      "We were all born together, to work together, like feet, like hands, like eyelids, like the rows of the upper and lower teeth. To act against one another then is contrary to nature."]),
    ("Book {i}. That the soul is a sphere",
     ["Let it be thy constant method to do every act of thy life as though it were the last act of it, and with a quiet disposition, free from rashness and from hypocrisy.",
      "The soul becomes dyed with the colour of its thoughts. Dye it then with a continual series of such thoughts as these: that where a man can live, there he can also live well.",
      "He who lives in harmony with himself lives in harmony with the universe, just as the eye which is disposed according to its nature sees all visible things well."]),
    ("Book {i}. On the river of time",
     ["Time is a river of passing events, and strong is its current; no sooner is a thing brought to sight than it is swept by and another takes its place, and this too will be taken away.",
      "Confine thyself to the present. Nothing is so productive of elevation of mind as to be able to examine methodically and truly every object presented to thee in life.",
      "Wipe out imagination, check desire, extinguish appetite, keep the governing faculty in its own power; and this will suffice for the life that is worth living."]),
]

ATENAS_PAGES = [
    ("Cuaderno de Atenas", [
        "La acropolis de Atenas corona la ciudad desde hace veinticinco siglos. Sus muros de caliza guardan el Parthenon, templo dedicado a Atenea Parthenos, la virgen guerrera.",
        "Fue construido entre 447 y 432 antes de Cristo bajo el gobierno de Pericles, con la direccion del escultor Fidias y los arquitectos Ictino y Calicrates.",
    ]),
    ("El agora y la vida publica", [
        "El agora era el corazon de la ciudad: mercado, tribunal y asamblea al aire libre. Alli caminaba Socrates haciendo preguntas a los artesanos y a los politicos.",
        "La stoa de Attalo, reconstruida en el siglo veinte, alberga hoy el museo del agora, donde descansan pesas de balanza, dados y la clepsidra de los juicios.",
    ]),
    ("La estatua de Atenea", [
        "Fidias esculpio una Atenea de doce metros, armada con lanza, escudo y casco, de marfil y oro sobre armazon de madera. Los peregrinos veian su brillo desde el mar.",
        "El oro del manto era desmontable: la ciudad podia fundirlo en caso de guerra. Nada queda de la estatua salvo copias pequenas y las palabras de los viajeros.",
    ]),
    ("El teatro de Dioniso", [
        "Al pie de la acropolis se levanta el teatro de Dioniso, cuna de la tragedia. Esquilo, Sofocles y Euripides compitieron alli ante diecisiete mil espectadores.",
        "Las gradas de piedra conservan sillas de honor con nombres tallados. El publico votaba con abucheos, risas y olivos; el premio era una corona de hiedra.",
    ]),
    ("Los talleres del ceramico", [
        "En el barrio del Ceramico los alfareros cocian vasijas de figuras negras y rojas. El torno giraba, el pintor trazaba mitos en el barro y el horno decidia el color final.",
        "Las piezas firmadas por Exequias o por el pintor de Andocides viajaron por todo el Mediterraneo y hoy llenan salas de museos de medio mundo.",
    ]),
]

# ------------------------------------------------- helpers de portadas ----
FONT_COVER_T = None
FONT_COVER_A = None
FONT_COVER_S = None


def cover_fonts():
    global FONT_COVER_T, FONT_COVER_A, FONT_COVER_S
    FONT_COVER_T = ImageFont.truetype(DEJAVU_B, 54)
    FONT_COVER_A = ImageFont.truetype(DEJAVU, 30)
    FONT_COVER_S = ImageFont.truetype(DEJAVU, 22)


def meander_border(d, x0, y0, x1, y1, color, step=22, width=4):
    """Cenefa griega simple: cuadrados encajados a lo largo del borde."""
    y = y1 - step
    x = x0
    while x + step * 2 <= x1:
        d.rectangle([x, y, x + step, y + step], outline=color, width=width)
        d.line([x, y + step, x + step, y + step], fill=color, width=width)
        x += step * 2


def wrap_title(d, text, font, max_w, x, y, color, line_h):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    for ln in lines:
        d.text((x, y), ln, font=font, fill=color)
        y += line_h
    return y


def cover_from_photo(src_png, out_png, title, author):
    img = Image.open(src_png).convert("RGB")
    tw, th = 480, 680
    # recorte central a proporción 480x680
    iw, ih = img.size
    target_ratio = tw / th
    crop_w = int(ih * target_ratio)
    left = (iw - crop_w) // 2
    img = img.crop((left, 0, left + crop_w, ih)).resize((tw, th), Image.LANCZOS)
    # velo oscuro para contraste (noche egeo)
    veil = Image.new("RGB", (tw, th), (13, 20, 34))
    img = Image.blend(img, veil, 0.52)
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, tw - 10, th - 10], outline=(116, 166, 216), width=3)
    y = 60
    y = wrap_title(d, title, FONT_COVER_T, tw - 80, 40, y, (232, 238, 246), 62)
    d.text((40, y + 8), author, font=FONT_COVER_A, fill=(150, 190, 230))
    meander_border(d, 26, 26, tw - 26, th - 26, (116, 166, 216))
    d.text((40, th - 74), "SELECCIÓN ATENA · DOMINIO PÚBLICO", font=FONT_COVER_S, fill=(140, 165, 195))
    img.save(out_png, quality=92)


def cover_typographic(out_png, title, author, subtitle):
    tw, th = 480, 680
    img = Image.new("RGB", (tw, th), (15, 22, 36))
    d = ImageDraw.Draw(img)
    d.rectangle([14, 14, tw - 14, th - 14], outline=(116, 166, 216), width=4)
    d.rectangle([24, 24, tw - 24, th - 24], outline=(116, 166, 216), width=2)
    y = 150
    y = wrap_title(d, title, FONT_COVER_T, tw - 100, 50, y, (232, 238, 246), 62)
    d.text((50, y + 10), author, font=FONT_COVER_A, fill=(150, 190, 230))
    d.text((50, th - 130), subtitle, font=FONT_COVER_S, fill=(140, 165, 195))
    meander_border(d, 34, 34, tw - 34, th - 34, (196, 154, 74), step=20, width=3)
    img.save(out_png, quality=92)


# ------------------------------------------------------ PDFs digitales ----
S_H1 = ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=24, leading=30,
                      textColor=HexColor("#1d2a3d"), spaceAfter=14)
S_H2 = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=17, leading=22,
                      textColor=HexColor("#24344d"), spaceAfter=10)
S_BODY = ParagraphStyle("Body", fontName="Times-Roman", fontSize=11.5, leading=17,
                        textColor=HexColor("#22262e"), spaceAfter=9)
S_FOOT = ParagraphStyle("Foot", fontName="Helvetica", fontSize=9, leading=12,
                        textColor=HexColor("#6b7280"))


def page_furniture(c, doc_title, page_no, total):
    W, H = A4
    c.setFillColor(HexColor("#6b7280"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(W / 2, 1.35 * cm, f"— {page_no} —")
    c.setFont("Helvetica", 8)
    c.drawString(2 * cm, H - 1.5 * cm, doc_title)
    c.drawRightString(W - 2 * cm, H - 1.5 * cm, "Atena · dominio público")
    c.setStrokeColor(HexColor("#c9d2de"))
    c.setLineWidth(0.6)
    c.line(2 * cm, H - 1.8 * cm, W - 2 * cm, H - 1.8 * cm)


def build_digital_pdf(out_path, doc_title, author, cover_png, blocks, front_matter):
    W, H = A4
    total_pages_hint = None
    story = []
    # portada interior
    story.append(Spacer(1, 5.2 * cm))
    story.append(Paragraph(doc_title, S_H1))
    story.append(Paragraph(author, ParagraphStyle("Au", parent=S_H2, textColor=HexColor("#4b5b74"))))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(front_matter, S_BODY))
    story.append(PageBreak())
    for cap_idx, (cap_title, paras) in enumerate(blocks):
        story.append(Paragraph(cap_title, S_H2))
        for p in paras:
            story.append(Paragraph(p, S_BODY))
        story.append(Spacer(1, 0.4 * cm))
        if cap_idx != len(blocks) - 1:
            story.append(PageBreak())

    # contamos páginas con pypdf tras construir
    tmp = out_path + ".tmp.pdf"
    doc = SimpleDocTemplate(tmp, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=2.4 * cm, bottomMargin=2.2 * cm, title=doc_title, author=author)

    def _decor(canvas, _doc):
        page_no = canvas.getPageNumber()
        page_furniture(canvas, doc_title, page_no, 0)

    doc.build(story, onFirstPage=_decor, onLaterPages=_decor)
    total = len(PdfReader(tmp).pages)
    os.replace(tmp, out_path)
    return total


def build_quijote():
    blocks = []
    n_pages_target = 40
    n_caps = n_pages_target - 2
    for i in range(1, n_caps + 1):
        t, ps = QUIJOTE_CAPS[i % len(QUIJOTE_CAPS)]
        blocks.append((t.format(i=i), [p for p in ps]))
    # última página de colofón
    blocks.append(("Colofón de la selección", [
        "Esta selección reúne pasajes del Ingenioso Hidalgo Don Quijote de la Mancha, publicado por Miguel de Cervantes en dos partes, en 1605 y 1615.",
        "El texto original está en dominio público desde hace siglos; esta edición de prueba fue compuesta por la casa de Atena para poblar la biblioteca y ejercitar el riel, los hitos y la racha.",
    ]))
    out = f"{OUT}/don-quijote-atena.pdf"
    cover = f"{OUT}/don-quijote-atena-cover.png"
    cover_from_photo(f"{BASE}/public/atena-capa2-fachada.png", cover,
                     "Don Quijote de la Mancha", "Miguel de Cervantes")
    total = build_digital_pdf(
        out, "Don Quijote de la Mancha — Selección Atena", "Miguel de Cervantes", cover, blocks,
        "Selección de pasajes en dominio público (1605/1615), compuesta como libro de prueba para la lectora Atena: capítulos numerados de prosa castellana con paginación al pie.")
    return {"file": "don-quijote-atena.pdf", "title": "Don Quijote de la Mancha (Selección Atena)",
            "author": "Miguel de Cervantes", "pages": total, "cover": "don-quijote-atena-cover.png"}


def build_meditations():
    blocks = []
    n_caps = 22
    for i in range(1, n_caps + 1):
        t, ps = MEDITATIONS_SECTIONS[i % len(MEDITATIONS_SECTIONS)]
        blocks.append((t.format(i=i), list(ps)))
    blocks.append(("A note on this edition", [
        "The Meditations of Marcus Aurelius entered the public domain long ago; this test edition uses George Long's English translation (1862), condensed for the Atena reader.",
        "It exists to exercise the dictionary, word selection and dual-view flows of the library.",
    ]))
    out = f"{OUT}/meditaciones-atena.pdf"
    cover = f"{OUT}/meditaciones-atena-cover.png"
    cover_typographic(cover, "Meditations", "Marcus Aurelius — tr. George Long",
                      "PUBLIC DOMAIN · GEORGE LONG, 1862")
    total = build_digital_pdf(
        out, "Meditations — Atena Reading Copy", "Marcus Aurelius (tr. George Long)", cover, blocks,
        "George Long's 1862 public-domain translation, condensed into a compact reading copy for exercising the dictionary and English text flows.")
    return {"file": "meditaciones-atena.pdf", "title": "Meditations (Atena Reading Copy)",
            "author": "Marcus Aurelius — tr. George Long", "pages": total, "cover": "meditaciones-atena-cover.png"}


# --------------------------------------------- PDF «capturado» (img) ----
def build_scanned():
    W, H = 1240, 1754  # A4 a ~150 dpi
    rng = random.Random(1605)
    pages = []
    # portada escaneada
    pages.append(("Cuaderno de Atenas", ["Archivo Atenea — copia escaneada", "Papel de prueba · solo imagen, sin capa de texto"]))
    for t, ps in ATENAS_PAGES * 2:
        pages.append((t, ps))

    imgs = []
    for i, (title, paras) in enumerate(pages[:10]):
        img = Image.new("RGB", (W, H), (238, 233, 220))
        d = ImageDraw.Draw(img)
        # grano y manchas de papel
        for _ in range(2600):
            x, y = rng.randrange(W), rng.randrange(H)
            g = rng.randrange(180, 230)
            d.point((x, y), fill=(g, g - 6, g - 14))
        for _ in range(6):
            cx, cy = rng.randrange(W), rng.randrange(H)
            r = rng.randrange(20, 90)
            d.ellipse([cx, cy, cx + r, cy + r], fill=(226, 219, 203))
        margin = 110
        f_title = ImageFont.truetype(DEJAVU_B, 54)
        f_body = ImageFont.truetype(DEJAVU, 36)
        f_page = ImageFont.truetype(DEJAVU, 30)
        d.text((margin, 120), title, font=f_title, fill=(48, 42, 38))
        d.line([margin, 200, W - margin, 200], fill=(120, 108, 96), width=3)
        y = 260
        for p in paras:
            y = wrap_title(d, p, f_body, W - margin * 2, margin, y, (58, 52, 46), 56) + 26
        d.text((W // 2 - 40, H - 110), f"— {i + 1} —", font=f_page, fill=(110, 100, 90))
        # borde de escáner levemente oscurecido
        d.rectangle([0, 0, W - 1, H - 1], outline=(210, 202, 188), width=6)
        tmp_png = f"{OUT}/_scan-{i}.jpg"
        img.save(tmp_png, quality=72)
        imgs.append(tmp_png)

    out = f"{OUT}/atena-escaneado.pdf"
    first = Image.open(imgs[0]).convert("RGB")
    rest = [Image.open(p).convert("RGB") for p in imgs[1:]]
    first.save(out, save_all=True, append_images=rest, quality=72)
    for p in imgs:
        os.remove(p)
    cover = f"{OUT}/atena-escaneado-cover.png"
    cover_from_photo(f"{BASE}/public/atena-capa2-busto.png", cover,
                     "Cuaderno de Atenas", "Archivo Atenea (escaneado)")
    total = len(PdfReader(out).pages)
    return {"file": "atena-escaneado.pdf", "title": "Cuaderno de Atenas (libro capturado, img)",
            "author": "Archivo Atenea", "pages": total, "cover": "atena-escaneado-cover.png"}


def main():
    cover_fonts()
    manifest = {"books": []}
    manifest["books"].append(build_quijote())
    manifest["books"].append(build_meditations())
    manifest["books"].append(build_scanned())
    # compañero de lectura dual (idempotente: ya puede estar en uploads)
    companion = None
    for cand in (f"{BASE}/upload/companion-es.pdf", f"{OUT}/companion-es.pdf"):
        if os.path.exists(cand):
            companion = cand
            break
    if companion:
        if os.path.dirname(companion) != OUT:
            shutil.move(companion, f"{OUT}/companion-es.pdf")
        manifest["companion"] = {"file": "companion-es.pdf",
                                 "pages": len(PdfReader(f"{OUT}/companion-es.pdf").pages)}
    with open(f"{BASE}/scripts/seed-manifest.json", "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    print("OK manifest ->", f"{BASE}/scripts/seed-manifest.json")


if __name__ == "__main__":
    main()
