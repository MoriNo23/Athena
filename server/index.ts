/**
 * Athena · servidor de la casa (Express) — sustituye a `next start`.
 *
 * Qué hace:
 *  - sirve la web compilada por Vite (dist/): index.html, login.html y assets;
 *  - monta el API bajo /api (server/api.ts, el contrato que espeja el motor
 *    offline del APK);
 *  - aplica el candado de la casa (antes src/proxy.ts): sin contraseña
 *    efectiva todo pasa; con ella, /api/* pide cookie o X-Athena-Token y las
 *    páginas saltan a /login?next=…;
 *  - banner de arranque (antes src/instrumentation.ts).
 *
 * Entorno:
 *  - PORT        puerto (3000)
 *  - ATHENA_HOST interfaz (127.0.0.1; 0.0.0.0 abre a la LAN)
 *  - ATHENA_MODO offline (sin candado) | lan (con candado)
 *  - ATHENA_PASSWORD / ATHENA_ABIERTO / ATHENA_HOME — ver src/core/access.ts
 *
 * En dev corre con Bun (`bun --watch server/index.ts`) y el Vite dev-server
 * proxya /api; en producción es un bundle Node (server-dist/server.cjs) que
 * sirve dist/ directamente.
 */
import express from "express";
import path from "node:path";
import {
  COOKIE_SESION,
  cookieDe,
  contraseñaEfectiva,
  esRecursoEstático,
  igualEnTiempoConstante,
} from "@/core/access";
import { asegurarEsquemaDb, urlAFichero } from "@/core/ensure-db";
import { db } from "@/lib/db";
import { api } from "./api";

const app = express();

// ---------------------------------------------------------------- cuerpo --
app.use(express.json({ limit: "2mb" }));

// --------------------------------------------------------------- candado --
/** cookie de sesión por nombre (sin dependencias: la cookie es un hex simple) */
function cookieValor(req: express.Request, nombre: string): string {
  const cab = req.headers.cookie;
  if (!cab) return "";
  for (const parte of cab.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    if (parte.slice(0, i).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim());
      } catch {
        return parte.slice(i + 1).trim();
      }
    }
  }
  return "";
}

/**
 * Candado (antes src/proxy.ts, change candado-completo-y-athena): rige solo
 * si hay contraseña efectiva (ATHENA_PASSWORD del .env / autogenerada en lan;
 * ATHENA_ABIERTO=1 abre). /api/* sin sesión → 401; páginas → redirect a
 * /login?next=…; recursos estáticos y preflight pasan siempre.
 */
app.use((req, res, next) => {
  const password = contraseñaEfectiva();
  // barra final no crea rutas distintas: /api/auth/login/ ES el login
  const ruta = req.path.replace(/\/+$/, "") || "/";
  if (!password || ruta === "/api" || ruta === "/api/auth/login") return next();

  // preflight CORS de la copia (Enmienda 1): no lleva cookie ni token
  if (req.method === "OPTIONS") return next();

  // sesión por cookie (navegador) o por cabecera (la copia desde el APK)
  const recibida = cookieValor(req, COOKIE_SESION) || req.get("x-athena-token") || "";
  const entra = igualEnTiempoConstante(recibida, cookieDe(password));

  if (ruta.startsWith("/api/")) {
    if (entra) return next();
    return res.status(401).json({ error: "Acceso bloqueado: contraseña requerida" });
  }

  if (esRecursoEstático(ruta)) return next();
  if (ruta === "/login") {
    return entra ? res.redirect("/") : next();
  }
  if (entra) return next();
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  return res.redirect(`/login?next=${encodeURIComponent(`${ruta}${qs}`)}`);
});

// ------------------------------------------------------------------- api --
app.use("/api", api);

// ------------------------------------------------------------- estáticos --
const WEB = path.join(process.cwd(), "dist");

// assets con hash: cacheables; index/login SIEMPRE frescos
app.use(
  express.static(WEB, {
    index: false,
    fallthrough: true,
    maxAge: "1h",
    setHeaders(res, rutaFichero) {
      if (rutaFichero.endsWith("index.html") || rutaFichero.endsWith("login.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.get("/", (_req, res) => res.sendFile(path.join(WEB, "index.html")));
app.get("/login", (_req, res) => res.sendFile(path.join(WEB, "login.html")));

// 404 de app: JSON para /api, página simple para el resto
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Ruta no encontrada" });
    return;
  }
  res.status(404).send("404");
});

// errores no capturados por las rutas: el contrato de la casa
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("error no manejado", err);
  if (!res.headersSent) res.status(500).json({ error: "Error interno" });
});

// ---------------------------------------------------------------- banner --
/** Banner de arranque (antes src/instrumentation.ts, con fallbacks legados). */
function banner() {
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

// --------------------------------------------------------------- escuchar --
const PORT = Number(process.env.PORT ?? 3000);
/** ATHENA_HOST manda; HOSTNAME solo si parece una IP (bash lo predefine con
    el nombre de la máquina y no es una interfaz). Default honesto: localhost. */
function hostEscucha(): string {
  const ip = /^[0-9.]+$/;
  const deHost = process.env.ATHENA_HOST?.trim();
  if (deHost) return deHost;
  const hn = process.env.HOSTNAME?.trim() ?? "";
  if (ip.test(hn)) return hn;
  return "127.0.0.1";
}

// BD cero-config: el esquema se aplica (si falta) ANTES de abrir el puerto.
// Con la biblioteca al día no escribe nada; recién creada se anuncia.
const ficheroBd =
  urlAFichero((process.env.DATABASE_URL ?? "").trim()) ?? "la BD del entorno";
banner();
asegurarEsquemaDb(db)
  .then((info) => {
    if (info.aplicado && info.migraciones.length > 0) {
      console.log(`📚 Biblioteca nueva creada: ${ficheroBd}`);
    } else {
      console.log(`📖 Biblioteca lista: ${ficheroBd}`);
    }
    app.listen(PORT, hostEscucha(), () => {
      console.log(`Athena escuchando en http://${hostEscucha()}:${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error("No se pudo preparar la base de datos:", err);
    process.exit(1);
  });
