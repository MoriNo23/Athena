#!/usr/bin/env python3
"""Genera un EPUB de prueba para los tests de Atena.

Estructura válida de EPUB 3: mimetype (stored, primero), container.xml, OPF
con metadata dc:title/dc:creator, portada (cover-image), nav mecánico (que el
parser DEBE saltar) y tres capítulos con títulos, párrafos con énfasis, una
cita, una lista, una imagen inline y un párrafo gigante de 600 palabras para
ejercitar splitLongTextBlocks.

Uso: python3 scripts/make_test_epub.py [salida.epub]
"""

import struct
import sys
import zipfile
import zlib
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "scripts/test-epub-libro.epub")


def png(w: int, h: int, rgb: tuple[int, int, int]) -> bytes:
    """PNG mínimo válido (RGB sin alpha) hecho a mano."""
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


P = lambda n: " ".join(f"palabra{i}" for i in range(n))  # noqa: E731


def para(text: str) -> str:
    return f"<p>{text}</p>"


CAP1 = f"""<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Capítulo I — La estación</title></head>
<body>
  <h1>Capítulo I — La estación</h1>
  {para("El riel arranca frío, como todas las mañanas en la estación del sur. Atena cuenta los tramos mientras el vapor sube y el reloj de la fachada avanza un minuto, indiferente a las promesas.")}
  {para("Nada en este andén dice que hoy será distinto, salvo el libro bajo el brazo: ochenta páginas de Prometeo, un lápiz mordido y la terquedad de quien decidió terminar lo que empieza.")}
  {para("El primer tramo siempre es el más difícil. La máquina huele a hierro tibio, los paneles muestran números que aún no significan nada, y el riel brilla vacío de extremo a extremo.")}
  {para("Pero la constancia no es un golpe de suerte: es un horario. Quien vuelve cada día al mismo andén descubre que el tren estaba ahí desde siempre, esperando únicamente constancia.")}
  {para("Atena sube al vagón tercero porque el tercero tiene la luz azul del amanecer y porque ahí, entre desconocidos, se lee mejor: el murmullo de los motores es una marea que mece la atención.")}
  {para("Página a página el riel se llena: primero un tramo, luego otro, y el primero ya no parece tan frío cuando el segundo muestra su color. Cada hito encendido es una pequeña victoria silenciosa.")}
  {para("Hay días de niebla, claro, días en que el andén entero desaparece y la mano duda antes de abrir el libro. Esos días también cuentan: aparecer es la mitad de todo el trabajo.")}
  {para("El maquinista le dijo una vez que los tramos no miden distancia, miden decisión. Que el riel no lleva a la última página por azar, sino por suma tenaz de páginas normales.")}
  {para("Con esa frase escrita en el margen empieza el viaje de este libro: ocho estaciones, tres cambios de aguja y una promesa que solo se cumple si nadie baja del tren a mitad de camino.")}
  {para("El vagón tercero cruza el túnel del caballo blanco y sale al valle: ahí, donde la luz pinta el papel de ámbar, el primer capítulo termina y el segundo ya está pidiendo paso.")}
</body>
</html>"""

CAP2 = f"""<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Capítulo II — El vagón</title></head>
<body>
  <h1>Capítulo II — El vagón</h1>
  <p>El vagón tercero tiene tres reglas no escritas que todos los lectores serios aprenden antes del segundo tramo.</p>
  <ul>
    <li>Primera regla: el libro se abre antes de que el tren arranque, para que la lectura nazca ya en movimiento.</li>
    <li>Segunda regla: la marca del lápiz se hace al final del tramo, nunca a mitad de página, para respetar el corte natural.</li>
    <li>Tercera regla: nadie interrumpe a quien sostiene un libro con las dos manos, ni siquiera para preguntar la hora.</li>
  </ul>
  <p>El mapa del trayecto cuelga entre dos ventanas, amarillo por el sol de mil mañanas, y señala con tinta azul los hitos donde el riel celebra.</p>
  <img src="images/mapa.png" alt="Mapa del trayecto con hitos marcados"/>
  <p>Las estaciones se suceden con la paciencia de los relojes buenos: ninguna llega antes de tiempo, ninguna se salta la que le sigue. Leer así es subir y bajar con método.</p>
  <blockquote>
    <p>El que lee todos los días no lee más horas: lee mejores horas, porque el hábito afila el minuto hasta volverlo filo.</p>
  </blockquote>
  <p>La cita está escrita también en el cristal del vagón, en letra tan pequeña que solo la ve quien acerca la cara, curioso, a la ventanilla del hábito.</p>
  <p>Atena sonríe: el maquinista colecciona frases de pasajeros anónimos. Hay una por cada libro terminado en el vagón tercero desde que la línea existe, y el cristal ya no alcanza.</p>
  <p>El segundo tramo termina justo cuando el valle se estrecha y el río aparece, plateado, corriendo en paralelo al riel como si quisiera competir en constancia con la lectura.</p>
  <p>Nadie gana esa carrera: el río llega siempre primero y el lector siempre más lejos. Ambos vuelven al día siguiente, que es la única victoria que aquí se celebra.</p>
  <p>Entre la cuarta y la quinta estación el tren cruza el puente de hierro donde el viento hojea las páginas sin permiso, y hay que sostener el libro con la firmeza de las decisiones tomadas.</p>
  <p>Al otro lado del puente el paisaje se vuelve azul profundo: es la garganta de Egeo, donde la luz del mediodía cae vertical y el papel brilla como una vela encendida en el vagón.</p>
</body>
</html>"""

GIANT = " ".join(
    f"La racha del día {i} amanece tersa y el lector sostiene el tramo con la calma de quien sabe que los rieles no se rompen de un día para otro, sino de un descuido para otro."
    for i in range(1, 25)
)

CAP3 = f"""<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Capítulo III — La garganta</title></head>
<body>
  <h2>El pacto</h2>
  <p>El pacto de la garganta es simple y antiguo: quien la cruza leyendo, sale del otro lado con el libro terminado o con la certeza honesta de por qué no.</p>
  <p>{GIANT}</p>
  <h2>La racha</h2>
  <p>Después del pacto, la racha se vuelve costumbre y la costumbre, carácter. Ya no hace falta coraje para abrir el libro: basta con sentarse, que es la parte mecánica del milagro.</p>
  <p>El vagón tercero se vacía y se llena, se vacía y se llena, como un pulmón de ciudad. El libro permanece: es lo único en el tren que no baja en ninguna estación.</p>
  <p>El último tramo llega siempre antes de lo que la memoria prometió. La última página pesa menos que la primera y sin embargo cuesta más soltarla, porque cerrar un libro es despedirse de un lugar habitado.</p>
  <p>Atena baja en la estación final con el riel completo, la insignia tib todavía en la mano y la lista de los próximos tres libros ya escrita en el reverso del billete.</p>
  <p>La mañana termina. El tren sigue. La estación del sur prepara otro frío amanecer para otro lector terco, y el riel, paciente, vuelve a brillar vacío de extremo a extremo.</p>
</body>
</html>"""

NAV = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es">
<head><title>Índice</title></head>
<body>
  <nav epub:type="toc">
    <h1>Índice</h1>
    <ol>
      <li><a href="cap1.xhtml">Capítulo I</a></li>
      <li><a href="cap2.xhtml">Capítulo II</a></li>
      <li><a href="cap3.xhtml">Capítulo III</a></li>
    </ol>
  </nav>
</body>
</html>"""

CONTAINER = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""

OPF = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="es">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:atena-test-epub-0001</dc:identifier>
    <dc:title>La Sombra del Riel</dc:title>
    <dc:creator id="creator">Athena Veridis</dc:creator>
    <dc:language>es</dc:language>
    <meta property="dcterms:modified">2026-10-17T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-image" href="images/portada.png" media-type="image/png" properties="cover-image"/>
    <item id="cap1" href="cap1.xhtml" media-type="application/xhtml+xml"/>
    <item id="cap2" href="cap2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cap3" href="cap3.xhtml" media-type="application/xhtml+xml"/>
    <item id="mapa" href="images/mapa.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="cap1"/>
    <itemref idref="cap2"/>
    <itemref idref="cap3"/>
  </spine>
</package>"""


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w") as z:
        # mimetype: PRIMERO y sin comprimir (requisito del formato)
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", CONTAINER)
        z.writestr("OEBPS/content.opf", OPF)
        z.writestr("OEBPS/nav.xhtml", NAV)
        z.writestr("OEBPS/cap1.xhtml", CAP1)
        z.writestr("OEBPS/cap2.xhtml", CAP2)
        z.writestr("OEBPS/cap3.xhtml", CAP3)
        z.writestr("OEBPS/images/portada.png", png(120, 180, (28, 60, 140)))
        z.writestr("OEBPS/images/mapa.png", png(200, 120, (200, 170, 60)))
    words = sum(len(p.split()) for p in (CAP1, CAP2, CAP3))
    print(f"EPUB de prueba: {OUT} ({OUT.stat().st_size} bytes, ~{words} palabras de cuerpo)")


if __name__ == "__main__":
    main()
