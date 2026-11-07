import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_SESION,
  cookieDe,
  contraseñaEfectiva,
  esRecursoEstático,
  igualEnTiempoConstante,
} from "@/core/access";

export const config = {
  // proxy corre siempre en Node.js (runtime no configurable en Next 16)
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
export function proxy(req: NextRequest) {
  const password = contraseñaEfectiva();
  // barra final no crea rutas distintas: /api/auth/login/ ES el login
  const ruta = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (!password || ruta === "/api" || ruta === "/api/auth/login") return NextResponse.next();

  // preflight CORS de la copia (Enmienda 1): no lleva cookie ni token, no
  // transporta datos — la respuesta 204 la arma cada ruta con sus cabeceras.
  if (req.method === "OPTIONS") return NextResponse.next();

  // sesión por cookie (navegador) o por cabecera (la copia desde el APK:
  // cross-origin sin credenciales — mismo derivado, misma comparación).
  const recibida =
    req.cookies.get(COOKIE_SESION)?.value ?? req.headers.get("x-athena-token") ?? "";
  const entra = igualEnTiempoConstante(recibida, cookieDe(password));

  if (ruta.startsWith("/api/")) {
    return entra
      ? NextResponse.next()
      : NextResponse.json({ error: "Acceso bloqueado: contraseña requerida" }, { status: 401 });
  }

  if (esRecursoEstático(ruta)) return NextResponse.next();
  if (ruta === "/login") {
    return entra ? NextResponse.redirect(new URL("/", req.nextUrl)) : NextResponse.next();
  }
  if (entra) return NextResponse.next();
  const destino = new URL("/login", req.nextUrl);
  destino.searchParams.set("next", `${ruta}${req.nextUrl.search}`);
  return NextResponse.redirect(destino);
}
