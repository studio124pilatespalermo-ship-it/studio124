import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * La CSP de vercel.json no puede leer variables de entorno: el dominio de la API va escrito.
 * Si la API cambia de dominio y no se actualiza acá, el navegador bloquea en producción
 * todas las llamadas del panel, del portal y los precios de la landing (en local no se nota).
 */
describe("política de seguridad de Vercel", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const csp = config.headers.flatMap((rule) => rule.headers).find((header) => header.key === "Content-Security-Policy");

  it("deja que el sitio hable con la API de producción", () => {
    const example = readFileSync(".env.example", "utf8");
    const production = /En producción: (https:\/\/\S+)/.exec(example)?.[1];
    expect(production).toBeDefined();
    const connect = csp?.value.split(";").find((directive) => directive.trim().startsWith("connect-src"));
    expect(connect).toContain(production);
  });
});
