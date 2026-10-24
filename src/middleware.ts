import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_SESION,
  cookieDe,
  contraseñaEfectiva,
  esRecursoEstático,
  igualEnTiempoConstante,
} from "@/lib/access";

export const config = {
  runtime: "nodejs",
  // api por matcher propio; páginas el resto (lo estático y /favicon se
  // filtran en código con esRecursoEstático)
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|api).*)"],
};

/**
 * Candado de la casa (change candado-completo-y-athena; base auth-api y
 * modo-normal-lan): rige solo si hay una contraseña efectiva
 * (ATHENA_PASSWORD del .env / autogenerada en lan; ATHENA_ABIERTO=1 abre).
 * - /api/* sin cookie → 401 (como hoy; abiertas la raíz de salud y el login).
 * - páginas: recurso estático pasa; sin cookie válida → redirect a
 *   /login?next=…; con cookie, /login devuelve al inicio.
 * Sin contraseña efectiva: todo pasa, igual que hoy (localhost y abierto).
 */
export function middleware(req: NextRequest) {
  const password = contraseñaEfectiva();
  const ruta = req.nextUrl.pathname;
  if (!password || ruta === "/api" || ruta === "/api/auth/login") return NextResponse.next();

  const recibida = req.cookies.get(COOKIE_SESION)?.value ?? "";
  const entra = igualEnTiempoConstante(recibida, cookieDe(password));

  if (ruta.startsWith("/api/")) {
    return entra
      ? NextResponse.next()
      : NextResponse.json({ error: "Acceso bloqueado: contraseña requerida" }, { status: 401 });
  }

  if (esRecursoEstático(ruta)) return NextResponse.next();
  if (entra) {
    if (ruta === "/login") return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }
  const destino = new URL("/login", req.nextUrl);
  destino.searchParams.set("next", `${ruta}${req.nextUrl.search}`);
  return NextResponse.redirect(destino);
}
