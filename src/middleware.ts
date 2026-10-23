import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, cookieDe, igualEnTiempoConstante } from "@/lib/access";

export const config = { runtime: "nodejs", matcher: ["/api/:path*"] };

/**
 * Candado de /api/*: opt-in por ATENA_PASSWORD (change auth-api, design §1).
 * Sin env, la API queda abierta (dev y sondas int). Con env, toda ruta exige
 * la cookie de sesión válida; quedan abiertas la raíz de salud y el login.
 */
export function middleware(req: NextRequest) {
  const password = process.env.ATENA_PASSWORD ?? "";
  const ruta = req.nextUrl.pathname;
  if (!password || ruta === "/api" || ruta === "/api/auth/login") return NextResponse.next();

  const recibida = req.cookies.get(COOKIE_SESION)?.value ?? "";
  if (igualEnTiempoConstante(recibida, cookieDe(password))) return NextResponse.next();

  return NextResponse.json({ error: "Acceso bloqueado: contraseña requerida" }, { status: 401 });
}
