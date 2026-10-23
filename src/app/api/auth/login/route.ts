import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, cookieDe, igualEnTiempoConstante } from "@/lib/access";

/** rate limit en memoria de proceso (design §3): 10 fallos/min por IP */
const MAX = 10;
const VENTANA = 60_000;
const fallos = new Map<string, { n: number; reset: number }>();

/**
 * POST /api/auth/login (change auth-api): valida la contraseña contra
 * ATENA_PASSWORD y abre la sesión con la cookie derivada que el guard espera.
 * Sin env, responde 400: no hay candado que abrir.
 */
export async function POST(req: NextRequest) {
  const password = process.env.ATENA_PASSWORD ?? "";
  if (!password) {
    return NextResponse.json({ error: "No hay candado configurado (ATENA_PASSWORD)" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ahora = Date.now();
  const estado = fallos.get(ip);
  if (estado && ahora < estado.reset && estado.n >= MAX) {
    return NextResponse.json({ error: "Demasiados intentos; espera un minuto" }, { status: 429 });
  }

  let enviada = "";
  try {
    const body = await req.json();
    enviada = typeof body?.password === "string" ? body.password : "";
  } catch {
    // cuerpo no-JSON: password vacía
  }
  if (!enviada) {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
  }

  if (!igualEnTiempoConstante(enviada, password)) {
    if (estado && ahora < estado.reset) estado.n += 1;
    else fallos.set(ip, { n: 1, reset: ahora + VENTANA });
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  fallos.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_SESION,
    value: cookieDe(password),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
