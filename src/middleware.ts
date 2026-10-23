import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, cookieDe, contraseñaEfectiva, igualEnTiempoConstante } from "@/lib/access";

export const config = { runtime: "nodejs", matcher: ["/api/:path*"] };

/**
 * Candado de /api/* (change auth-api; modos en modo-normal-lan):
 * el candado rige solo si hay una contraseña efectiva (ATENA_PASSWORD del .env
 * o autogenerada en modo lan). Sin ella, el arranque es normal: localhost y abierto.
 * Quedan abiertas la raíz de salud y el login.
 */
export function middleware(req: NextRequest) {
  const password = contraseñaEfectiva();
  const ruta = req.nextUrl.pathname;
  if (!password || ruta === "/api" || ruta === "/api/auth/login") return NextResponse.next();

  const recibida = req.cookies.get(COOKIE_SESION)?.value ?? "";
  if (igualEnTiempoConstante(recibida, cookieDe(password))) return NextResponse.next();

  return NextResponse.json({ error: "Acceso bloqueado: contraseña requerida" }, { status: 401 });
}
