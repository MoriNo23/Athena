/**
 * Banner de arranque del server (change modo-normal-lan, design §3).
 * Informativo: el candado no depende de él — si instrumentation no corre,
 * el helper garantiza el archivo bajo demanda en request.
 */
import { contraseñaEfectiva } from "@/lib/access";

export async function register() {
  const modo = process.env.ATENA_MODO ?? "offline";
  const fija = (process.env.ATENA_PASSWORD ?? "").trim();
  if (modo === "lan") {
    if (fija) {
      console.log("🔒 Modo lan · usando ATENA_PASSWORD del .env como candado");
    } else {
      const pw = contraseñaEfectiva(); // garantiza db/atena-lock y la imprime
      console.log(`🔒 Modo lan · contraseña de la biblioteca: ${pw}`);
      console.log("   (guardada en db/atena-lock · fija la tuya con ATENA_PASSWORD en .env)");
    }
  } else {
    console.log(`🏠 Modo normal · solo localhost${fija ? " · candado local con ATENA_PASSWORD" : " · sin candado"}`);
  }
}
