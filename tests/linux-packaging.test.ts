import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * El paquete Linux: icono, metadatos y lo que el AppImage exige.
 *
 * Estos tres avisos del CI (`1 error + 2 warnings` en el job linux, con el job
 * en verde) se veían como ruido y no eran ruido: appimagetool ya rechaza un
 * `.DirIcon` que no sea PNG y avisa de que la próxima versión **negará a
 * construir**. El release se habría caído solo, sin tocar el código.
 */

const RAIZ = join(import.meta.dir, "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("paquete Linux · AppImage y AppStream", () => {
  test("el icono para escritorio es un PNG de 256x256", () => {
    const png = join(RAIZ, "packaging/linux/athena.png");
    expect(existsSync(png)).toBe(true);
    const b = readFileSync(png);
    // firma PNG
    expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // cabecera IHDR: ancho y alto en big-endian
    expect(b.readUInt32BE(16)).toBe(256);
    expect(b.readUInt32BE(20)).toBe(256);
  });

  test("el metainfo cumple lo que appstreamcli exige", () => {
    const xml = leer("packaging/linux/io.github.morino23.athena.appdata.xml");
    const valor = (etiqueta: string) =>
      xml.match(new RegExp(`<${etiqueta}[^>]*>([^<]+)</${etiqueta}>`))?.[1]?.trim();

    // el archivo se llama como el id: packaging/linux/athena.metainfo.xml
    expect(valor("id")).toBe("io.github.morino23.athena");
    // id en DNS inverso, sin guiones ni dígitos al principio de un segmento
    expect(valor("id")).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/);
    for (const segmento of valor("id")!.split(".")) {
      expect(`${segmento} empieza por letra: ${/^[a-z_]/.test(segmento)}`).toBe(
        `${segmento} empieza por letra: true`,
      );
    }
    // metadata_license tiene que ser SPDX y de la lista permitida
    expect(valor("metadata_license")).toBe("MIT");
    expect(valor("project_license")).toBe("MIT");
    expect(valor("name")).toBe("Athena");
    expect(valor("summary")!.length).toBeGreaterThan(10);

    // description va en <p>, nunca texto suelto (appstreamcli lo rechaza)
    expect(xml).toContain("<description>");
    expect(xml.match(/<p>/g)!.length).toBeGreaterThanOrEqual(1);
    // el lanzador apunta al .desktop que instalamos
    expect(valor("launchable")).toBe("io.github.morino23.athena.desktop");
    // las capturas son URLs absolutas, como pide la especificación
    for (const url of xml.match(/<image type="source">([^<]+)<\/image>/g) ?? []) {
      expect(url).toMatch(/https:\/\/[^<]+\.png<\/image>/);
    }
  });

  test("el instalador deja un .DirIcon que es PNG (appimagetool lo exige)", () => {
    const instalador = leer("scripts/linux-install-tree.sh");
    // .DirIcon se copia del PNG, no se enlaza al SVG: SVG es «hard to parse»
    expect(instalador).toContain('cp packaging/linux/athena.png "$DESTINO/.DirIcon"');
    expect(instalador).not.toMatch(/ln -s[^\n]*athena\.svg/);
    // y se comprueba antes de empaquetar, para que el error diga qué pasa
    const appimage = leer("scripts/package-appimage.sh");
    expect(appimage).toContain(".DirIcon");
    expect(appimage).toContain("PNG image");
  });

  test("el smoke test arranca el AppImage de verdad, no solo construirlo", () => {
    const wf = leer(".github/workflows/release-linux.yml");
    // --appimage-extract-and-run: sin FUSE en el runner, y prueba el montaje real
    expect(wf).toContain("--appimage-extract-and-run");
    // y que el AppRun de prueba haya corrido de verdad, no que el fichero exista
    expect(wf).toContain("AppRun de prueba");
    // el smoke test usaba un AppRun inyectado y esperaba a que SIRVIERA: eso no
    // podía funcionar (el AppRun de prueba no arranca servidor) y el job se
    // caía aunque el empaquetado estuviera bien. Ahora comprueba lo que toca.
    expect(wf).not.toContain("el AppImage no llegó a servir");
  });

  test("lo que appimagetool exige viaja DENTRO de la imagen", () => {
    // sin comentarios: el workflow explica por qué NO se usa unsquashfs, y
    // buscar la palabra a pelo se dispara con mi propia explicación
    const wf = leer(".github/workflows/release-linux.yml").replace(/^\s*#.*$/gm, "");
    // no basta con que exista en el AppDir: se extrae la imagen y se mira
    // dentro. Con `--appimage-extract` (nativo del runtime, sin FUSE) y no con
    // unsquashfs: ese obligaba a instalar squashfs-tools y, cuando el apt
    // fallaba, el paso moría sin decir por qué. Un fallo sin anotación es un
    // fallo que no se puede diagnosticar sin leer el log.
    expect(wf).toContain("--appimage-extract");
    expect(wf).not.toContain("unsquashfs");
    // cada fallo deja su anotación: es el canal que queda cuando el log no se
    // puede leer
    expect(wf).toContain('::error::falta $fichero dentro del AppImage');
    // el paso hace `cd /tmp/extraido` antes de usar $APP: con una ruta relativa
    // el AppImage «no existía» y el run se cayó por eso, no por el paquete
    expect(wf).toContain('APP="$PWD/$(ls release/Athena-*-x86_64.AppImage)"');
    expect(wf).toContain(".DirIcon");
    // una sola variable para el id: si se escribe a mano en cada ruta, alguna
    // se queda con el nombre viejo y appimagetool no encuentra los metadatos
    expect(wf).toContain("ID=io.github.morino23.athena");
    expect(wf).toContain('"usr/share/metainfo/$ID.appdata.xml"');
  });

  test("AppImage y .deb salen del MISMO instalador", () => {
    // dos jerarquías paralelas fue justo lo que dejó al .deb sin icono ni
    // metadatos mientras el AppImage sí los tenía
    // la LLAMADA real, no una mención en un comentario (ese error ya lo cometí)
    const llamaAlInstalador = (script: string) =>
      leer(script)
        .split("\n")
        .some((linea) => /^\s*bash scripts\/linux-install-tree\.sh/.test(linea) && !linea.trim().startsWith("#"));
    for (const script of ["scripts/package-appimage.sh", "scripts/package-deb.sh"]) {
      expect(`${script}: ${llamaAlInstalador(script)}`).toBe(`${script}: true`);
    }
    // y solo el AppImage recibe los atajos de raíz del AppDir
    expect(leer("scripts/package-appimage.sh")).toContain("--atajos-appimage");
    expect(leer("scripts/package-deb.sh")).not.toContain("--atajos-appimage");
  });

  test("los runners están fijados: la etiqueta latest se mueve sola", () => {
    // `ubuntu-latest` está migrando a Ubuntu 26.04 (termina el 19-nov-2026).
    // Con la etiqueta flotante cada job escupía un aviso en el resumen del run
    // y, el día del cambio, el pipeline se habría movido sin tocar el código.
    const workflows = ["ci.yml", "release.yml", "release-android.yml", "release-linux.yml"];
    for (const w of workflows) {
      // sin comentarios: el propio workflow explica por qué ya no usa
      // `ubuntu-latest`, y buscar la cadena a pelo se dispara con eso
      const texto = leer(`.github/workflows/${w}`).replace(/^\s*#.*$/gm, "");
      expect(`${w} sin latest: ${!texto.includes("ubuntu-latest")}`).toBe(`${w} sin latest: true`);
      expect(`${w} fijado: ${texto.includes("runs-on: ubuntu-24.04")}`).toBe(`${w} fijado: true`);
    }
  });

  test("el resumen del run no lleva avisos que no sean un problema", () => {
    // El `::notice::` de «todo bien» hacía justo lo contrario de lo que buscaba:
    // añadía otra entrada al resumen que el usuario tenía que leer y descartar.
    // El verde del job ya dice que fue bien.
    const workflows = ["ci.yml", "release.yml", "release-android.yml", "release-linux.yml"];
    for (const w of workflows) {
      expect(`${w}: ${/::notice::/.test(leer(`.github/workflows/${w}`))}`).toBe(`${w}: false`);
    }
  });

  test("el .deb no deja el CLI roto", () => {
    // scripts/athena resuelve ROOT como dirname(readlink -f $0)/.. y arranca
    // $ROOT/server-dist/server.cjs: una copia suelta en usr/bin apuntaría a
    // la raíz del sistema, y un symlink sin el archivo detrás sería peor.
    const instalador = leer("scripts/linux-install-tree.sh");
    expect(instalador).toContain('cp scripts/athena "$APP/scripts/athena"');
    expect(instalador).toContain('ln -sf ../share/athena/scripts/athena');
  });
});
