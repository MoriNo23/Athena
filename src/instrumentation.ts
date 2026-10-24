/**
 * Banner de arranque del server (change modo-normal-lan, design §3;
 * renombrado ATHENA_* con fallback legado en candado-completo-y-athena).
 * Informativo: el candado no depende de él — si instrumentation no corre,
 * el helper garantiza el archivo bajo demanda en request.
 */
import { contraseñaEfectiva } from "@/lib/access";

export async function register() {
  const modo = (process.env.ATHENA_MODO ?? process.env.ATENA_MODO) ?? "offline";
  const fija = ((process.env.ATHENA_PASSWORD ?? process.env.ATENA_PASSWORD) ?? "").trim();
  if (modo === "lan") {
    if (fija) {
      console.log("🔒 Modo lan · usando ATHENA_PASSWORD del .env como candado");
    } else if ((process.env.ATHENA_ABIERTO ?? process.env.ATENA_ABIERTO) === "1") {
      console.log("🔓 Modo lan · abierto a elección (ATHENA_ABIERTO=1), sin candado");
    } else {
      const pw = contraseñaEfectiva(); // garantiza db/athena-lock y la imprime
      console.log(`🔒 Modo lan · contraseña de la biblioteca: ${pw}`);
      console.log("   (guardada en db/athena-lock · fija la tuya con ATHENA_PASSWORD en .env)");
    }
  } else {
    console.log(`🏠 Modo normal · solo localhost${fija ? " · candado local con ATHENA_PASSWORD" : " · sin candado"}`);
  }
}
