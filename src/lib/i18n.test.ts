import { expect, test } from "bun:test";
import { es } from "@/lib/i18n/es";
import { en } from "@/lib/i18n/en";
import { pt } from "@/lib/i18n/pt";

/**
 * Paridad de los diccionarios de la interfaz.
 *
 * La casa habla tres lenguas con diccionarios planos (clave → cadena). Una
 * clave que falta en un idioma no rompe el render (el traductor cae al
 * español), pero al lector le aparece una frase en otra lengua sin avisar.
 * Este test la caza antes de que llegue a pantalla — y vigila las claves
 * que el pulido móvil de la UI añadió a los tres idiomas a la vez.
 */

test("es / en / pt definen exactamente las mismas claves", () => {
  const claves = (d: Record<string, string>) => Object.keys(d).sort();
  const clavesEs = claves(es);

  expect(claves(en)).toEqual(clavesEs);
  expect(claves(pt)).toEqual(clavesEs);
});

test("ninguna traducción queda vacía", () => {
  for (const valor of Object.values(es)) {
    expect(valor.trim().length > 0).toBe(true);
  }
  for (const valor of Object.values(en)) {
    expect(valor.trim().length > 0).toBe(true);
  }
  for (const valor of Object.values(pt)) {
    expect(valor.trim().length > 0).toBe(true);
  }
});

test("las claves del pulido móvil existen en los tres idiomas", () => {
  const nuevas = [
    // pista de inmersión táctil (antes solo existía el consejo del mouse)
    "rv.immerseHintTouch",
    // estado corto del teleprompter para la barra angosta del móvil
    "tp.statusShort",
    // nombres accesibles únicos del fondo y del asa de la hoja del dock
    "dock.backdropAria",
    "dock.handleAria",
  ];
  for (const clave of nuevas) {
    expect(es[clave] != null).toBe(true);
    expect(en[clave] != null).toBe(true);
    expect(pt[clave] != null).toBe(true);
  }
});

test("tp.statusShort interpola página y total", () => {
  expect(es["tp.statusShort"]!.replaceAll("{page}", "7").replaceAll("{total}", "120")).toContain("7");
  expect(es["tp.statusShort"]!.replaceAll("{page}", "7").replaceAll("{total}", "120")).toContain("120");
});
