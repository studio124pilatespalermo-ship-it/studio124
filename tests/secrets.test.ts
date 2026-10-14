import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Red de seguridad contra filtraciones: mira todo lo que git rastrea (lo que se publica en
 * GitHub) y falla si aparece un archivo de credenciales o algo con forma de clave.
 * Corre con `npm run verify`, así que un secreto no llega al repositorio sin que salte.
 */
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

/** Archivos que nunca deben estar rastreados (los `.env.example` sí: están vacíos a propósito). */
const FORBIDDEN_NAME =
  /(^|\/)(\.env(\.(?!example$).+)?|.*\.(pem|key|p12|pfx)|credenciales.*|.*credentials.*\.txt|settings\.local\.json)$|(^|\/)\.data\/|(^|\/)\.claude\//;

/** Formas típicas de una clave real (Mercado Pago, GitHub, Google, Stripe, AWS, claves privadas, base de datos con usuario y clave). */
const SECRET_PATTERNS: readonly [string, RegExp][] = [
  ["token de Mercado Pago", /APP_USR-[0-9A-Za-z-]{10,}/],
  ["credencial de prueba de Mercado Pago", /TEST-[0-9a-f]{8}-[0-9a-f]{4}-/],
  ["token de GitHub", /gh[pousr]_[0-9A-Za-z]{20,}/],
  ["clave de Google", /AIza[0-9A-Za-z_-]{30,}/],
  ["secreto de cliente de Google", /GOCSPX-[0-9A-Za-z_-]{10,}/],
  ["clave de Stripe", /sk_(live|test)_[0-9A-Za-z]{10,}/],
  ["clave de AWS", /AKIA[0-9A-Z]{16}/],
  ["clave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["URL de base de datos con clave", /postgres(ql)?:\/\/[^\s:/@]+:[^\s@]+@/],
  ["clave de cifrado asignada", /APP_ENCRYPTION_KEY\s*=\s*[A-Za-z0-9+/]{32,}/],
];

/** Excepciones revisadas a mano: valores falsos que sólo existen para probar que NO se filtran. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  "api/tests/security.test.ts": ["token de Mercado Pago"],
};

const isText = (file: string) => !/\.(png|jpe?g|webp|avif|gif|ico|mp4|mov|woff2?|pdf|zip)$/i.test(file);
const skipContent = (file: string) => /(^|\/)package-lock\.json$/.test(file) || file === "tests/secrets.test.ts";

describe("lo que se publica en GitHub", () => {
  it("no incluye archivos de credenciales ni configuración local", () => {
    expect(tracked.filter((file) => FORBIDDEN_NAME.test(file))).toEqual([]);
  });

  it("no tiene nada con forma de clave o contraseña", () => {
    const found: string[] = [];
    for (const file of tracked.filter((name) => isText(name) && !skipContent(name))) {
      const content = readFileSync(file, "utf8");
      for (const [label, pattern] of SECRET_PATTERNS) {
        if (pattern.test(content) && !ALLOWED[file]?.includes(label)) found.push(`${file}: ${label}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("los .env.example no traen valores reales", () => {
    for (const file of tracked.filter((name) => /\.env\.example$/.test(name))) {
      const assigned = readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((line) => /^(APP_ENCRYPTION_KEY|CRON_SECRET|GOOGLE_CLIENT_SECRET|DATABASE_URL)=\S+/.test(line));
      expect(assigned, file).toEqual([]);
    }
  });
});
