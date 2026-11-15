/**
 * Marca y papel (change marca-portico).
 *
 * El pórtico de Athena vive en cuatro sitios y los cuatro tienen que seguir
 * siendo el MISMO dibujo: el SVG del README, el componente de React, el
 * favicon y el icono del APK. Un cambio de coordenadas en uno solo no rompe
 * el build — simplemente la marca se parte en dos dibujos distintos, y eso
 * solo se nota mirando. Estos tests lo notan sin mirar.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RAIZ = dirname(import.meta.dir);
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** coordenadas del SVG de marca, normalizadas a "x,y" sin decimales */
function puntos(svg: string, etiqueta: string): string[] {
  const m = svg.match(new RegExp(`points="${etiqueta}"`));
  return m ? [m[0]] : [];
}

describe("marca · el pórtico es un solo dibujo en todas partes", () => {
  const icono = leer("public/brand/athena-icon.svg");
  const wordmark = leer("public/brand/athena-wordmark.svg");
  const react = leer("src/components/brand/AthenaPortico.tsx");
  const vector = leer("android/app/src/main/res/drawable/ic_launcher_foreground.xml");

  test("el frontón es la misma geometría (120,20 200,68 40,68)", () => {
    for (const [nombre, texto] of [
      ["athena-icon.svg", icono],
      ["athena-wordmark.svg", wordmark],
      ["AthenaPortico.tsx", react],
    ] as const) {
      expect(`${nombre}:${puntos(texto, "120,20 200,68 40,68").length}`).toBe(`${nombre}:1`);
    }
  });

  test("el icono del APK usa la misma paleta de la casa", () => {
    // bronce, oro y mármol; nada del azul/naranja del mock
    for (const color of ["#B58A3A", "#E0A94E", "#F1EEE6"]) {
      expect(icono.toUpperCase()).toContain(color.toUpperCase());
      expect(vector.toUpperCase()).toContain(color.toUpperCase());
    }
    expect(vector.toUpperCase()).not.toContain("#0044FF");
    expect(vector.toUpperCase()).not.toContain("#FF5500");
  });

  test("el wordmark no depende de fuentes: va hecho con trazos", () => {
    // <text> tomaría la fuente que tenga el visor (GitHub incluido) y el
    // logotipo cambiaría de forma en cada máquina.
    // se mira el marcado, no los comentarios (que sí nombran el elemento)
    const marcado = wordmark.replace(/<!--[\s\S]*?-->/g, "");
    expect(marcado).not.toContain("<text");
    expect(wordmark).toContain("prefers-color-scheme: dark");
  });

  test("el fondo del icono adaptativo ya no es el blanco de plantilla", () => {
    const bg = leer("android/app/src/main/res/values/ic_launcher_background.xml");
    const valor = bg.match(/<color name="ic_launcher_background">(#[0-9A-Fa-f]{6})<\/color>/);
    expect(valor).not.toBeNull();
    expect(valor![1].toLowerCase()).toBe("#211d16");
  });

  test("el favicon es el sello de trazos, no el dibujo detallado", () => {
    const favicon = leer("public/athena-seal.svg");
    // a 16 px el pórtico completo solo deja manchas: el favicon usa 7 trazos
    expect(favicon).toContain('stroke="#E0A94E"');
    expect(favicon).not.toContain("<polygon");
  });
});

describe("papel · las texturas viven en CSS, no en imágenes", () => {
  const css = leer("src/styles/globals.css");

  test("cuaderno (biblioteca) y pergamino (lector) existen y son CSS puro", () => {
    expect(css).toContain(".papel-cuaderno::before");
    expect(css).toContain(".papel-pergamino::before");
    // ni una URL: cero peso en el APK y cero peticiones
    const bloque = css.slice(css.indexOf(".papel-cuaderno"), css.indexOf(".papel-ficha"));
    expect(bloque).not.toContain("url(");
  });

  test("la textura nunca atrapa el puntero ni se pinta encima del texto", () => {
    for (const clase of [".papel-cuaderno::before", ".papel-pergamino::before"]) {
      const ini = css.indexOf(clase);
      const bloque = css.slice(ini, css.indexOf("}", ini));
      expect(bloque).toContain("pointer-events: none");
      expect(bloque).toContain("z-index: -1");
    }
  });

  test("están cableadas donde toca", () => {
    expect(leer("src/components/library/LibraryView.tsx")).toContain("papel-cuaderno");
    expect(leer("src/components/library/BookCard.tsx")).toContain("papel-ficha");
    expect(leer("src/components/reader/ReaderStage.tsx")).toContain("papel-pergamino");
  });
});
